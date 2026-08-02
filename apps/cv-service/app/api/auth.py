"""Authentification du service CV par secret partagé.

Jusqu'ici la seule protection de ce service était l'isolement réseau, et cette
intention était visible dans le déploiement — pas de ``ports:`` en production,
montage ``uploads`` en lecture seule. Mais elle n'était écrite nulle part comme
un invariant : une ligne ``ports:`` ajoutée le temps d'un débogage, un ingress,
un proxy mal configuré, et un service d'inférence coûteux devient anonyme. En
développement, ``docker-compose.yml`` l'expose déjà sur 8000.

Un secret partagé ne remplace pas l'isolement réseau, il le double. Le point
n'est pas de rendre le service publiable : c'est que la garantie cesse de
dépendre d'un fichier de composition que personne ne relit.

Le secret est **obligatoire dès qu'il est configuré** et le service **refuse de
démarrer sans lui hors développement** (cf. ``app.config``) : un secret optionnel
silencieusement absent reproduirait exactement le défaut qu'on corrige.
"""

import hmac

from fastapi import Header, HTTPException, status

from app.config import settings

API_TOKEN_HEADER = "X-CV-Token"


async def require_service_token(
    x_cv_token: str | None = Header(default=None, alias=API_TOKEN_HEADER),
) -> None:
    """Rejette tout appel dont le jeton ne correspond pas au secret configuré.

    La comparaison est à temps constant : ``==`` sur des chaînes s'arrête au
    premier octet différent, ce qui laisse mesurer un préfixe correct.
    """
    if not settings.api_token:
        # Développement local sans secret configuré : le service reste ouvert,
        # comme avant. `Settings.validate_runtime()` interdit ce cas hors dev.
        return

    if x_cv_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"En-tete {API_TOKEN_HEADER} requise.",
        )

    if not hmac.compare_digest(x_cv_token, settings.api_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Jeton de service invalide.",
        )
