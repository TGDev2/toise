"""Le service CV n'avait aucune authentification : sa seule protection etait
l'isolement reseau, hypothese qu'aucune ligne du depot n'enoncait.

Ces tests exercent la dependance seule, sans monter l'application complete :
`app.main` charge les modeles au demarrage (torch/transformers), ce que la CI
n'installe pas.
"""

import asyncio

import pytest
from fastapi import HTTPException

from app.api.auth import require_service_token
from app.config import Settings, settings


@pytest.fixture
def with_token(monkeypatch):
    monkeypatch.setattr(settings, "api_token", "secret-de-service", raising=False)
    return "secret-de-service"


def call(token):
    return asyncio.run(require_service_token(token))


def test_rejette_un_appel_sans_entete(with_token):
    with pytest.raises(HTTPException) as exc:
        call(None)
    assert exc.value.status_code == 401


def test_rejette_un_jeton_faux(with_token):
    with pytest.raises(HTTPException) as exc:
        call("mauvais-jeton")
    assert exc.value.status_code == 401


def test_rejette_un_prefixe_correct(with_token):
    # La comparaison est a temps constant : un prefixe valide ne doit rien
    # reveler, et surtout ne pas passer.
    with pytest.raises(HTTPException):
        call("secret-de-servic")


def test_accepte_le_bon_jeton(with_token):
    assert call("secret-de-service") is None


def test_reste_ouvert_sans_secret_configure(monkeypatch):
    # Developpement local : comportement inchange par rapport a avant.
    monkeypatch.setattr(settings, "api_token", "", raising=False)
    assert call(None) is None


class TestValidationAuDemarrage:
    def test_refuse_de_demarrer_sans_secret_hors_developpement(self, monkeypatch):
        monkeypatch.setenv("CV_SERVICE_ENV", "production")
        with pytest.raises(RuntimeError, match="CV_SERVICE_TOKEN"):
            Settings(api_token="").validate_runtime()

    def test_demarre_avec_un_secret(self, monkeypatch):
        monkeypatch.setenv("CV_SERVICE_ENV", "production")
        Settings(api_token="x").validate_runtime()

    def test_demarre_sans_secret_en_developpement(self, monkeypatch):
        monkeypatch.setenv("CV_SERVICE_ENV", "development")
        Settings(api_token="").validate_runtime()
