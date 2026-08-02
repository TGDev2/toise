"""Tests de opening_merge (CV-6) : identité d'objet, conservation de la
provenance des boîtes, et cadrage de l'écart avec l'ancien comportement
(_merge_openings + _group_openings de DimensionCalculator). Aucune dépendance
ML (CI-safe)."""

import random
from collections import Counter

from app.services.opening_detector import DetectedOpening
from app.services.opening_merge import (
    OpeningGroup,
    merge_and_group,
    serialize_box,
    serialize_group,
)


def make(type_, w, h, conf, bbox=(0, 0, 10, 10)):
    return DetectedOpening(
        type=type_, bbox=bbox, width_cm=w, height_cm=h, confidence=conf
    )


# ─── Référence : l'algorithme historique, reproduit à l'identique ─────────


def legacy_merge_and_group(all_openings):
    """Copie fidèle de _merge_openings + _group_openings (avant extraction)."""
    openings = list(all_openings)
    openings.sort(key=lambda o: o.confidence, reverse=True)
    merged = []
    for opening in openings:
        is_duplicate = False
        for m in merged:
            if opening.type == m.type:
                w_ratio = min(opening.width_cm, m.width_cm) / max(
                    opening.width_cm, m.width_cm, 1
                )
                h_ratio = min(opening.height_cm, m.height_cm) / max(
                    opening.height_cm, m.height_cm, 1
                )
                if w_ratio > 0.7 and h_ratio > 0.7:
                    is_duplicate = True
                    break
        if not is_duplicate:
            merged.append(opening)

    groups = []  # (type, width, height, count, confidence)
    for o in merged:
        matched = False
        for g in groups:
            if (
                g["type"] == o.type
                and abs(g["width_cm"] - o.width_cm) <= 10
                and abs(g["height_cm"] - o.height_cm) <= 10
            ):
                g["count"] += 1
                g["confidence"] = max(g["confidence"], o.confidence)
                matched = True
                break
        if not matched:
            groups.append({
                "type": o.type,
                "width_cm": o.width_cm,
                "height_cm": o.height_cm,
                "count": 1,
                "confidence": o.confidence,
            })
    return groups


def as_tuples(groups):
    return [
        (g.type, g.width_cm, g.height_cm, g.count, g.confidence)
        if isinstance(g, OpeningGroup)
        else (g["type"], g["width_cm"], g["height_cm"], g["count"], g["confidence"])
        for g in groups
    ]


# ─── Cas nominaux ─────────────────────────────────────────────────────────


def test_cross_image_duplicate_is_absorbed_but_boxes_are_kept():
    per_image = [
        ("a.jpg", [make("door", 90, 204, 0.8, bbox=(10, 10, 50, 120))]),
        ("b.jpg", [make("door", 88, 200, 0.6, bbox=(20, 5, 48, 118))]),
    ]
    groups = merge_and_group(per_image)

    assert len(groups) == 1
    g = groups[0]
    assert (g.type, g.width_cm, g.height_cm, g.count) == ("door", 90, 204, 1)
    # provenance : la boîte absorbée par la dédup reste rattachée au groupe
    assert [b["image_path"] for b in g.boxes] == ["a.jpg", "b.jpg"]
    assert g.boxes[1]["bbox_xywh"] == [20, 5, 48, 118]


def test_ratio_at_threshold_is_not_a_duplicate():
    # ratio exactement 0.7 → strictement supérieur exigé → deux représentants
    per_image = [
        ("a.jpg", [make("door", 70, 204, 0.8)]),
        ("b.jpg", [make("door", 100, 204, 0.6)]),
    ]
    groups = merge_and_group(per_image)
    assert len(groups) == 2


def test_grouping_accumulates_count_and_boxes():
    # dims ≤ ±10 mais ratio ≤ 0.7 (petites valeurs) : groupés sans être
    # dédupliqués — le count s'accumule comme dans l'ancien code
    per_image = [
        ("a.jpg", [make("window", 10, 100, 0.9)]),
        ("b.jpg", [make("window", 18, 100, 0.5)]),
    ]
    groups = merge_and_group(per_image)
    assert len(groups) == 1
    assert groups[0].count == 2
    assert groups[0].confidence == 0.9
    assert len(groups[0].boxes) == 2


def test_two_distinct_openings_in_one_image_are_not_merged():
    """Deux portes standard d'une même pièce sont deux portes.

    Le NMS intra-image a laissé passer ces deux boîtes (IoU = 0), donc ce sont
    deux objets distincts — leurs dimensions identiques (90×204 est la porte
    standard) ne sont pas une preuve du contraire.
    """
    per_image = [
        (
            "salon.jpg",
            [
                make("door", 90, 204, 0.82, bbox=(10, 50, 45, 102)),
                make("door", 90, 204, 0.77, bbox=(400, 50, 45, 102)),
            ],
        )
    ]
    groups = merge_and_group(per_image)

    assert len(groups) == 1
    assert groups[0].count == 2
    assert len(groups[0].boxes) == 2


def test_same_two_openings_seen_in_two_images_still_count_two():
    """La dédup inter-images reste active par-dessus l'invariant intra-image."""
    pair = lambda c1, c2: [  # noqa: E731
        make("door", 90, 204, c1, bbox=(10, 50, 45, 102)),
        make("door", 88, 200, c2, bbox=(400, 50, 45, 102)),
    ]
    groups = merge_and_group(
        [("a.jpg", pair(0.9, 0.85)), ("b.jpg", pair(0.8, 0.75))]
    )

    assert len(groups) == 1
    assert groups[0].count == 2  # deux portes, pas quatre
    assert len(groups[0].boxes) == 4  # les quatre détections restent traçables
    assert Counter(b["image_path"] for b in groups[0].boxes) == {
        "a.jpg": 2,
        "b.jpg": 2,
    }


def test_types_never_mix():
    per_image = [
        ("a.jpg", [make("door", 90, 204, 0.8), make("window", 90, 204, 0.7)]),
    ]
    groups = merge_and_group(per_image)
    assert sorted(g.type for g in groups) == ["door", "window"]


def test_groups_ordered_by_confidence_desc():
    per_image = [
        ("a.jpg", [make("window", 120, 100, 0.5)]),
        ("b.jpg", [make("door", 90, 204, 0.9)]),
    ]
    groups = merge_and_group(per_image)
    assert [g.type for g in groups] == ["door", "window"]


def test_serialization_is_json_friendly():
    box = serialize_box("a.jpg", make("door", 90, 204, 0.8, bbox=(1.9, 2, 3, 4)))
    assert box["bbox_xywh"] == [1, 2, 3, 4]  # ints

    g = merge_and_group([("a.jpg", [make("door", 90, 204, 0.8)])])[0]
    data = serialize_group(g)
    assert data["type"] == "door"
    assert data["boxes"][0]["image_path"] == "a.jpg"


# ─── Cadrage de l'écart avec l'ancien algorithme (fuzz) ──────────────────


def _random_scene(rng, max_per_image):
    per_image, flat = [], []
    for i in range(rng.randint(1, 4)):
        openings = [
            make(
                rng.choice(["door", "window"]),
                rng.randint(5, 300),
                rng.randint(5, 300),
                round(rng.random(), 3),
            )
            for _ in range(rng.randint(0, max_per_image))
        ]
        per_image.append((f"img{i}.jpg", openings))
        flat.extend(openings)
    return per_image, flat


def test_equivalence_with_legacy_when_one_detection_per_image():
    """L'écart avec l'historique est strictement borné au cas qu'il ratait.

    Tant qu'aucune image ne porte deux détections, l'invariant « une boîte par
    image et par représentant » ne peut pas mordre : le résultat doit rester
    bit-pour-bit celui de l'ancien algorithme.
    """
    rng = random.Random(42)
    for _ in range(200):
        per_image, flat = _random_scene(rng, max_per_image=1)
        assert as_tuples(merge_and_group(per_image)) == as_tuples(
            legacy_merge_and_group(flat)
        )


def test_invariants_hold_with_several_detections_per_image():
    rng = random.Random(1789)
    for _ in range(300):
        per_image, flat = _random_scene(rng, max_per_image=4)
        groups = merge_and_group(per_image)

        # provenance : chaque détection d'entrée est dans exactement un groupe
        assert sum(len(g.boxes) for g in groups) == len(flat)

        for g in groups:
            assert g.count >= 1
            # Cœur du correctif : un groupe de N ouvertures ne peut pas avoir
            # absorbé plus de N boîtes d'une même photo, chaque représentant
            # n'y contribuant qu'une fois. C'est ce qu'affirmait à tort
            # `count = 1` sur deux portes distinctes d'un même cliché.
            per_source = Counter(b["image_path"] for b in g.boxes)
            assert max(per_source.values()) <= g.count
