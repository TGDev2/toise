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

# Deux détections de même type sont des doublons **inter-images** si leurs
# dimensions cm concordent à > 70 % ; deux groupes sont identiques si leurs
# dimensions concordent à ±10 cm.
#
# « Inter-images » est une contrainte, pas une description : la concordance
# dimensionnelle ne prouve pas l'identité d'objet (deux portes standard font
# toutes deux 90×204). Elle n'est utilisable comme critère d'identité que
# bornée par l'invariant ci-dessous — un même objet physique ne peut pas
# apparaître deux fois dans la même photo.
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

    Deux étages :

    1. Déduplication **inter-images** : tri par confiance décroissante, une
       détection est absorbée par le premier représentant de même type dont
       les dimensions concordent (ratio > MERGE_DIM_RATIO sur les deux axes)
       **et qui n'a pas déjà absorbé une détection de la même image**.
    2. Groupement : les représentants restants de même type et de dimensions
       à ±GROUP_DIM_TOL_CM sont groupés (count cumulés, confiance max).

    L'invariant « au plus une boîte par image et par représentant » est ce
    qui distingue *le même objet vu deux fois* de *deux objets distincts* :
    le NMS intra-image (`OpeningDetector._nms`) a déjà supprimé les
    recouvrements IoU > 0.5, donc deux détections survivantes dans une même
    photo sont deux ouvertures différentes — même si elles font toutes deux
    90×204. Sans cet invariant, deux portes standard d'une même pièce
    remontaient en `count=1` (avec pourtant leurs deux boîtes en provenance).

    Chaque groupe conserve toutes les boîtes contributrices (représentants
    et absorbées) avec leur image d'origine.
    """
    flat: list[tuple[str, DetectedOpening]] = [
        (image_path, opening)
        for image_path, openings in per_image
        for opening in openings
    ]
    flat.sort(key=lambda item: item[1].confidence, reverse=True)

    # Étage 1 — déduplication, en mémorisant les boîtes absorbées et les
    # images déjà représentées (cf. invariant du docstring).
    representatives: list[tuple[DetectedOpening, list[dict], set[str]]] = []
    for image_path, opening in flat:
        box = serialize_box(image_path, opening)
        absorbed = False
        for kept, boxes, source_images in representatives:
            if (
                opening.type == kept.type
                and image_path not in source_images
                and _dims_match_ratio(opening, kept)
            ):
                boxes.append(box)
                source_images.add(image_path)
                absorbed = True
                break
        if not absorbed:
            representatives.append((opening, [box], {image_path}))

    # Étage 2 — groupement des représentants.
    groups: list[OpeningGroup] = []
    for opening, boxes, _source_images in representatives:
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
