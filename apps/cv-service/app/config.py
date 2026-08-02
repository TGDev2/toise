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

    # ── Contrat d'admission ────────────────────────────────────────────
    # Le service tient dans un seul processus uvicorn (cf. Dockerfile) sous une
    # limite memoire de 4 Go (docker-compose.prod.yml). Sans borne ecrite, une
    # requete peut a elle seule le saturer. L'API appelante en impose deja
    # (5 photos, 20 Mo) mais c'est sa politique a elle, pas un contrat opposable
    # ici : le service doit tenir face a n'importe quel appelant qui l'atteint.

    # Nombre d'images par requete. Volontairement au-dessus des 5 de
    # `photos.service.ts` : le service ne suit pas les evolutions de l'API, il
    # refuse seulement l'absurde.
    max_images_per_request: int = 8

    # Budget en pixels par image. Au-dela, l'image est *reduite*, pas rejetee
    # (cf. `image_loader.load_rgb`). 50 Mpx laisse passer tel quel le capteur le
    # plus large du marche grand public (48 Mpx) et borne le pic memoire d'une
    # image a ~1,2 Go, toutes allocations intermediaires comprises.
    max_image_pixels: int = 50_000_000

    # Analyses simultanees. 1 par defaut : le pipeline est lie au CPU et le
    # conteneur n'a qu'un processus. Au-dela du slot, la requete est refusee
    # (429) plutot que mise en file — une file invisible se paie en timeouts
    # cote appelant pendant que le travail continue sans destinataire.
    max_concurrent_analyses: int = 1

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
