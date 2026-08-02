import os

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    uploads_path: str = "./uploads"
    model_name: str = "depth-anything-v2-small"
    opening_model_path: str = "models/door-window-yolov8n.pt"
    host: str = "0.0.0.0"
    port: int = 8000
    # Secret partage avec l'API (`CV_SERVICE_TOKEN` des deux cotes). Vide en
    # developpement uniquement -- cf. `validate_runtime`.
    api_token: str = ""

    class Config:
        env_prefix = ""
        case_sensitive = False

    def validate_runtime(self) -> None:
        """Refuse de demarrer sans secret hors developpement.

        Le service n'etait protege que par son isolement reseau, hypothese
        jamais ecrite nulle part. La rendre explicite ne sert a rien si elle
        peut etre desactivee par omission : une variable d'environnement
        oubliee doit arreter le demarrage, pas ouvrir le service en silence.
        """
        env = os.getenv("CV_SERVICE_ENV", os.getenv("NODE_ENV", "development"))
        if env != "development" and not self.api_token:
            raise RuntimeError(
                "CV_SERVICE_TOKEN est requis hors developpement : sans lui le "
                "service d'inference accepte n'importe quel appelant capable "
                "de l'atteindre."
            )


settings = Settings()
