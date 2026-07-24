"""Fusion multi-images et groupement des ouvertures détectées.

Extrait de DimensionCalculator (CV-6) pour conserver la provenance : chaque
groupe final garde la liste des boîtes contributrices par image — y compris
les doublons inter-images éliminés par la déduplication, qui restent des
détections valides dans *leur* image et servent de labels au ré-entraînement.

Module pur (stdlib + dataclasses du détecteur) : importable sans torch,
testé en CI.
"""

from dataclasses import dataclass, field

from app.services.opening_detector import DetectedOpening

# Sémantique historique de _merge_openings / _group_openings (inchangée) :
# deux détections de même type sont des doublons inter-images si leurs
# dimensions cm concordent à > 70 % ; deux groupes sont identiques si leurs
# dimensions concordent à ±10 cm.
MERGE_DIM_RATIO = 0.7
GROUP_DIM_TOL_CM = 10


@dataclass
class OpeningGroup:
    """Une ouverture consolidée (type + dimensions) et sa provenance."""

    type: str
    width_cm: int
    height_cm: int
    count: int
    confidence: float
    boxes: list[dict] = field(default_factory=list)


def serialize_box(image_path: str, opening: DetectedOpening) -> dict:
    return {
        "image_path": image_path,
        "bbox_xywh": [int(v) for v in opening.bbox],
        "confidence": opening.confidence,
        "width_cm": opening.width_cm,
        "height_cm": opening.height_cm,
    }


def serialize_group(group: OpeningGroup) -> dict:
    return {
        "type": group.type,
        "width_cm": group.width_cm,
        "height_cm": group.height_cm,
        "count": group.count,
        "confidence": group.confidence,
        "boxes": group.boxes,
    }


def _dims_match_ratio(a: DetectedOpening, b: DetectedOpening) -> bool:
    w_ratio = min(a.width_cm, b.width_cm) / max(a.width_cm, b.width_cm, 1)
    h_ratio = min(a.height_cm, b.height_cm) / max(a.height_cm, b.height_cm, 1)
    return w_ratio > MERGE_DIM_RATIO and h_ratio > MERGE_DIM_RATIO


def merge_and_group(
    per_image: list[tuple[str, list[DetectedOpening]]],
) -> list[OpeningGroup]:
    """
    Fusionne les détections de plusieurs images en groupes consolidés.

    Deux étages, comportement identique à l'ancien
    _merge_openings + _group_openings de DimensionCalculator :

    1. Déduplication inter-images : tri par confiance décroissante, une
       détection est absorbée par la première retenue de même type dont les
       dimensions concordent (ratio > MERGE_DIM_RATIO sur les deux axes).
    2. Groupement : les représentants restants de même type et de dimensions
       à ±GROUP_DIM_TOL_CM sont groupés (count cumulés, confiance max).

    Chaque groupe conserve toutes les boîtes contributrices (représentants
    et absorbées) avec leur image d'origine.
    """
    flat: list[tuple[str, DetectedOpening]] = [
        (image_path, opening)
        for image_path, openings in per_image
        for opening in openings
    ]
    flat.sort(key=lambda item: item[1].confidence, reverse=True)

    # Étage 1 — déduplication, en mémorisant les boîtes absorbées.
    representatives: list[tuple[DetectedOpening, list[dict]]] = []
    for image_path, opening in flat:
        box = serialize_box(image_path, opening)
        absorbed = False
        for kept, boxes in representatives:
            if opening.type == kept.type and _dims_match_ratio(opening, kept):
                boxes.append(box)
                absorbed = True
                break
        if not absorbed:
            representatives.append((opening, [box]))

    # Étage 2 — groupement des représentants.
    groups: list[OpeningGroup] = []
    for opening, boxes in representatives:
        matched = False
        for group in groups:
            if (
                group.type == opening.type
                and abs(group.width_cm - opening.width_cm) <= GROUP_DIM_TOL_CM
                and abs(group.height_cm - opening.height_cm) <= GROUP_DIM_TOL_CM
            ):
                group.count += 1
                group.confidence = max(group.confidence, opening.confidence)
                group.boxes.extend(boxes)
                matched = True
                break
        if not matched:
            groups.append(
                OpeningGroup(
                    type=opening.type,
                    width_cm=opening.width_cm,
                    height_cm=opening.height_cm,
                    count=1,
                    confidence=opening.confidence,
                    boxes=list(boxes),
                )
            )

    return groups
