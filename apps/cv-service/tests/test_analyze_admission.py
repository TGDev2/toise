"""Contrat d'admission du service CV — constat 2.13.

Le service tient dans **un** processus uvicorn sous 4 Go. Avant ces tests, une
seule requête pouvait le saturer sur trois axes indépendants :

- le pipeline synchrone tournait *dans* la boucle d'événements, donc `/health`
  ne répondait plus pendant toute l'analyse ;
- ni le nombre d'images ni leur surface en pixels n'étaient bornés ;
- les cartes de profondeur pleine résolution étaient retenues pour toutes les
  images jusqu'à la fin de la requête.

Aucune dépendance ML : le routeur n'importe Torch nulle part (`DepthEstimator`
n'est typé qu'en `TYPE_CHECKING`), donc l'application de test se monte avec un
estimateur factice.
"""

import asyncio
import threading

import numpy as np
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image
from pydantic import ValidationError

import app.services.dimension_calculator as dimension_calculator_module
from _synthetic_room import build_scenarios
from app.api import routes
from app.config import settings
from app.models.schemas import AnalyzeRequest, AnalyzeResponse
from app.services.dimension_calculator import DimensionCalculator
from app.services.image_loader import load_rgb


class _FixedDepthEstimator:
    """Sert une carte de profondeur connue, à la résolution demandée."""

    def __init__(self, depth_map: np.ndarray):
        self._depth_map = depth_map

    def estimate(self, image) -> np.ndarray:
        if image.size == self._depth_map.shape[::-1]:
            return self._depth_map
        import cv2

        return cv2.resize(self._depth_map, image.size).astype(np.float32)


# ── Bornes de la requête ──────────────────────────────────────────────


def test_refuse_plus_d_images_que_la_borne():
    trop = [f"p{i}.jpg" for i in range(settings.max_images_per_request + 1)]
    with pytest.raises(ValidationError, match="must not exceed"):
        AnalyzeRequest(image_paths=trop)


def test_accepte_la_borne_exacte():
    pile = [f"p{i}.jpg" for i in range(settings.max_images_per_request)]
    assert len(AnalyzeRequest(image_paths=pile).image_paths) == len(pile)


def test_la_borne_est_relue_a_chaque_validation(monkeypatch):
    """Une borne figée à l'import ne suivrait pas la configuration déployée."""
    monkeypatch.setattr(settings, "max_images_per_request", 2)
    AnalyzeRequest(image_paths=["a.jpg", "b.jpg"])
    with pytest.raises(ValidationError):
        AnalyzeRequest(image_paths=["a.jpg", "b.jpg", "c.jpg"])


# ── Budget en pixels ──────────────────────────────────────────────────


def _write_jpeg(path, width, height):
    Image.fromarray(np.full((height, width, 3), 128, dtype=np.uint8)).save(
        path, format="JPEG", quality=20
    )
    return path


def test_une_image_sous_le_budget_n_est_pas_touchee(tmp_path):
    path = _write_jpeg(tmp_path / "petite.jpg", 400, 300)
    assert load_rgb(path, max_pixels=1_000_000).size == (400, 300)


def test_une_image_hors_budget_est_reduite_sans_deformation(tmp_path):
    path = _write_jpeg(tmp_path / "grande.jpg", 4000, 2000)
    budget = 200_000

    reduced = load_rgb(path, max_pixels=budget)

    assert reduced.width * reduced.height <= budget
    # Rapport d'aspect conservé : les mesures du pipeline sont des rapports de
    # longueurs, une réduction anisotrope les fausserait toutes.
    assert reduced.width / reduced.height == pytest.approx(2.0, rel=0.02)


def test_sans_budget_l_image_reste_en_pleine_resolution(tmp_path):
    path = _write_jpeg(tmp_path / "grande.jpg", 4000, 2000)
    assert load_rgb(path).size == (4000, 2000)


def test_le_pipeline_applique_le_budget_configure(tmp_path, monkeypatch):
    """Le chemin serveur ne doit pas pouvoir oublier la borne."""
    monkeypatch.setattr(settings, "uploads_path", str(tmp_path))
    monkeypatch.setattr(settings, "max_image_pixels", 123_456)
    _write_jpeg(tmp_path / "photo.jpg", 4000, 2000)

    budgets: list = []
    original = dimension_calculator_module.load_rgb

    def _spy(path, max_pixels=None):
        budgets.append(max_pixels)
        return original(path, max_pixels=max_pixels)

    monkeypatch.setattr(dimension_calculator_module, "load_rgb", _spy)

    depth = _FixedDepthEstimator(np.zeros((10, 10), dtype=np.float32))
    DimensionCalculator(depth, None).process(["photo.jpg"])

    assert budgets == [123_456]


def test_les_dimensions_survivent_a_une_reduction(tmp_path, monkeypatch):
    """Réduire plutôt que rejeter n'est légitime que si la mesure est
    invariante d'échelle : chaque longueur est divisée par un `px_per_cm`
    mesuré dans la *même* image. On le prouve en photographiant la scène de
    référence deux fois plus grande, puis en la ramenant par le budget.
    """
    monkeypatch.setattr(settings, "uploads_path", str(tmp_path))
    scenario = build_scenarios()[1]  # door_medium_room
    h, w = scenario.depth_map.shape
    depth = _FixedDepthEstimator(scenario.depth_map)

    # PNG : sans perte, pour que la seule différence entre les deux runs soit
    # le rééchantillonnage, pas des artefacts de compression.
    rgb = Image.fromarray(scenario.image[:, :, ::-1])
    rgb.save(tmp_path / "salon.png")
    rgb.resize((w * 2, h * 2), Image.LANCZOS).save(tmp_path / "salon-2x.png")

    monkeypatch.setattr(settings, "max_image_pixels", 0)  # borne désactivée
    reference = DimensionCalculator(depth, None).process(
        ["salon.png"], reference_object=scenario.reference_object
    )
    assert reference.status == "success", reference.error

    # Budget = la surface d'origine ⇒ l'image doublée revient exactement à
    # l'échelle sur laquelle la non-régression CV-7 est calibrée.
    monkeypatch.setattr(settings, "max_image_pixels", w * h)
    reduced = DimensionCalculator(depth, None).process(
        ["salon-2x.png"], reference_object=scenario.reference_object
    )

    assert reduced.status == "success", reduced.error
    for axis in ("length_cm", "width_cm", "height_cm"):
        assert getattr(reduced.dimensions, axis) == pytest.approx(
            getattr(reference.dimensions, axis), abs=3
        ), f"{axis} dérive avec la réduction : la mesure n'est plus invariante"


# ── Mémoire : plus de tableau pleine résolution retenu ────────────────


def _write_scene(tmp_path, scenario):
    Image.fromarray(scenario.image[:, :, ::-1]).save(tmp_path / "salon.png")
    return "salon.png"


def test_aucun_tableau_pleine_resolution_n_est_retenu(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "uploads_path", str(tmp_path))
    scenario = build_scenarios()[1]
    name = _write_scene(tmp_path, scenario)

    calculator = DimensionCalculator(_FixedDepthEstimator(scenario.depth_map), None)
    result = calculator._process_single_image(name, scenario.reference_object)

    assert result is not None
    assert not any(isinstance(v, np.ndarray) for v in vars(result).values()), (
        "PerImageResult retient un tableau : la mémoire redevient "
        "proportionnelle au nombre d'images de la requête"
    )
    # Les statistiques, elles, restent disponibles pour `raw_output`.
    assert set(result.depth_stats) == {"min", "max", "mean", "std"}


def test_les_statistiques_de_profondeur_restent_publiees(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "uploads_path", str(tmp_path))
    scenario = build_scenarios()[1]
    name = _write_scene(tmp_path, scenario)

    response = DimensionCalculator(
        _FixedDepthEstimator(scenario.depth_map), None
    ).process([name], reference_object=scenario.reference_object)

    stats = response.raw_output["per_image"][0]["depth_map_stats"]
    assert stats["max"] == pytest.approx(float(np.max(scenario.depth_map)))
    assert stats["min"] == pytest.approx(float(np.min(scenario.depth_map)))


# ── Admission : hors boucle, et un seul travail à la fois ─────────────


class _CalculatorEspion:
    """Remplace `DimensionCalculator` dans le module de la route.

    Enregistre s'il a été exécuté dans un thread *portant une boucle
    d'événements* : c'est la question posée par le constat, et la seule
    formulation qui ne dépende pas de la façon dont `TestClient` héberge
    l'application.
    """

    dans_une_boucle: list = []
    entree = threading.Event()
    liberation = threading.Event()

    def __init__(self, *_args):
        pass

    def process(self, image_paths, reference_object=None):
        try:
            asyncio.get_running_loop()
            _CalculatorEspion.dans_une_boucle.append(True)
        except RuntimeError:
            _CalculatorEspion.dans_une_boucle.append(False)
        _CalculatorEspion.entree.set()
        _CalculatorEspion.liberation.wait(timeout=10)
        return AnalyzeResponse(status="success", num_images_processed=1)


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(settings, "api_token", "", raising=False)
    monkeypatch.setattr(routes, "_analysis_slots", None)
    monkeypatch.setattr(routes, "DimensionCalculator", _CalculatorEspion)
    _CalculatorEspion.dans_une_boucle = []
    _CalculatorEspion.entree = threading.Event()
    _CalculatorEspion.liberation = threading.Event()

    app = FastAPI()
    app.include_router(routes.router)
    app.state.depth_estimator = object()
    app.state.opening_detector = None

    @app.get("/ping")
    async def ping():  # tient lieu de `/health` : la boucle répond-elle ?
        return {"pong": True}

    with TestClient(app) as c:
        yield c
    routes._analysis_slots = None


def test_le_pipeline_ne_tourne_pas_dans_la_boucle(client):
    _CalculatorEspion.liberation.set()

    response = client.post("/analyze", json={"image_paths": ["a.jpg"]})

    assert response.status_code == 200
    assert _CalculatorEspion.dans_une_boucle == [False], (
        "le pipeline tourne dans le thread de la boucle : `/health` reste "
        "muet pendant toute l'analyse et le healthcheck finit par basculer"
    )


def test_une_seconde_analyse_est_refusee_pendant_la_premiere(client):
    resultats: dict = {}

    def _lente():
        resultats["lente"] = client.post(
            "/analyze", json={"image_paths": ["a.jpg"]}
        )

    t = threading.Thread(target=_lente)
    t.start()
    try:
        assert _CalculatorEspion.entree.wait(timeout=10), "l'analyse n'a pas démarré"

        # La boucle répond toujours : c'est tout l'intérêt du thread.
        assert client.get("/ping").status_code == 200

        refusee = client.post("/analyze", json={"image_paths": ["b.jpg"]})
        assert refusee.status_code == 429
        assert refusee.headers["Retry-After"] == "30"
    finally:
        _CalculatorEspion.liberation.set()
        t.join(timeout=10)

    assert resultats["lente"].status_code == 200
    # Le slot est rendu : la suivante repasse.
    assert (
        client.post("/analyze", json={"image_paths": ["c.jpg"]}).status_code == 200
    )


def test_la_borne_d_images_est_refusee_avant_tout_travail(client):
    _CalculatorEspion.liberation.set()
    trop = [f"p{i}.jpg" for i in range(settings.max_images_per_request + 1)]

    response = client.post("/analyze", json={"image_paths": trop})

    assert response.status_code == 422
    assert not _CalculatorEspion.dans_une_boucle, (
        "une requête hors contrat a fait travailler le pipeline"
    )


def test_le_semaphore_est_cree_dans_la_boucle():
    """Construit à l'import, il serait lié à une autre boucle que celle qui
    l'utilise — panne silencieuse et dépendante de l'ordre des imports."""
    routes._analysis_slots = None
    try:

        async def _dans_la_boucle():
            return routes.analysis_slots()

        semaphore = asyncio.run(_dans_la_boucle())
        assert semaphore is routes.analysis_slots()
    finally:
        routes._analysis_slots = None
