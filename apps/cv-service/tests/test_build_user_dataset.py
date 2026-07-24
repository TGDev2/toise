"""Tests des fonctions pures de training/build_user_dataset.py (CV-6).

Sémantique des labels prudents : suppressions jamais converties en négatifs,
appariement strict, validation implicite gated. CI-safe (stdlib uniquement).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "training"))

import build_user_dataset as bud  # noqa: E402


# ─── Fixtures ─────────────────────────────────────────────────────────────


def box(img, conf=0.8, bbox=(10, 10, 50, 120)):
    return {"image_path": img, "bbox_xywh": list(bbox), "confidence": conf,
            "width_cm": 90, "height_cm": 204}


def group(type_="door", w=90, h=204, count=1, conf=0.8, boxes=None):
    return {"type": type_, "width_cm": w, "height_cm": h, "count": count,
            "confidence": conf, "boxes": boxes or []}


def snap(oid="op-1", type_="door", w=90, h=204, count=1):
    return {"opening_id": oid, "type": type_, "width_cm": w, "height_cm": h,
            "count": count, "cv_confidence": 0.8}


def log(field, cv, uv, created="2026-07-02T00:00:00+00:00"):
    return {"id": f"log-{field}", "field": field, "cv_value": cv,
            "user_value": uv, "created_at": created}


def job(groups, corrections=None, job_id="job-1", project_id="p-1"):
    return {
        "job_id": job_id,
        "project_id": project_id,
        "completed_at": "2026-07-01T00:00:00+00:00",
        "opening_detector": "yolo",
        "openings_detail": groups,
        "corrections": corrections or [],
        "project_correction_counts": {"dimension": 1, "opening": 0},
    }


# ─── collate_corrections ──────────────────────────────────────────────────


def test_collate_counts_added_reports():
    collated, added = bud.collate_corrections([
        log("added", {"missed": True}, snap()),
    ])
    assert collated == {}
    assert added == 1


def test_collate_removed_and_field_edits():
    collated, _ = bud.collate_corrections([
        log("width_cm", snap(), snap(w=120), created="2026-07-02T00:00:00+00:00"),
        log("width_cm", snap(w=120), snap(w=130), created="2026-07-03T00:00:00+00:00"),
        log("removed", snap(oid="op-2"), {"deleted": True}),
    ])
    assert collated["op-1"]["final"]["width_cm"] == 130  # dernier gagne
    assert collated["op-1"]["removed"] is False
    assert collated["op-2"]["removed"] is True
    # le snapshot d'appariement reste celui du PREMIER log (valeurs d'origine)
    assert collated["op-1"]["first_cv"]["width_cm"] == 90


def test_collate_count_decrease_means_removed():
    collated, _ = bud.collate_corrections([
        log("count", snap(count=2), snap(count=1)),
    ])
    assert collated["op-1"]["removed"] is True


def test_collate_count_increase_is_not_removed():
    collated, _ = bud.collate_corrections([
        log("count", snap(count=1), snap(count=2)),
    ])
    assert collated["op-1"]["removed"] is False


def test_collate_without_snapshot_is_unusable():
    collated, _ = bud.collate_corrections([
        log("removed", 90, {"deleted": True}),  # ancien format scalaire
    ])
    assert collated is None


# ─── match_group ──────────────────────────────────────────────────────────


def test_match_group_exact():
    groups = [group(w=120), group(w=90)]
    assert bud.match_group(snap(w=90), groups) == 1


def test_match_group_none_or_ambiguous():
    assert bud.match_group(snap(w=91), [group(w=90)]) is None  # strict
    assert bud.match_group(snap(), [group(), group()]) is None  # 2 candidats


# ─── build_job_labels ─────────────────────────────────────────────────────


def test_untouched_boxes_gated_by_confidence():
    j = job([group(boxes=[box("a.jpg", conf=0.6), box("b.jpg", conf=0.4)])])
    labels, triage, stats = bud.build_job_labels(j, min_conf=0.5)

    assert set(labels) == {"a.jpg"}
    assert stats["boxes_low_conf"] == 1
    assert triage == []


def test_corrected_group_bypasses_confidence_gate():
    j = job(
        [group(boxes=[box("a.jpg", conf=0.3)])],
        [log("width_cm", snap(), snap(w=120))],
    )
    labels, _, _ = bud.build_job_labels(j, min_conf=0.5)
    assert set(labels) == {"a.jpg"}  # un humain a validé cette ouverture


def test_type_flip_rewrites_class_on_all_boxes():
    j = job(
        [group(boxes=[box("a.jpg"), box("b.jpg")])],
        [log("type", snap(), snap(type_="window"))],
    )
    labels, _, _ = bud.build_job_labels(j, min_conf=0.5)
    assert [cls for cls, _ in labels["a.jpg"]] == [bud.CLASS_IDS["window"]]
    assert [cls for cls, _ in labels["b.jpg"]] == [bud.CLASS_IDS["window"]]


def test_removed_group_excludes_its_images_never_negatives():
    j = job(
        [
            group(boxes=[box("a.jpg"), box("b.jpg")]),
            group(type_="window", w=120, h=100,
                  boxes=[{"image_path": "b.jpg", "bbox_xywh": [1, 2, 3, 4],
                          "confidence": 0.9, "width_cm": 120, "height_cm": 100}]),
        ],
        [log("removed", snap(), {"deleted": True})],
    )
    labels, triage, _ = bud.build_job_labels(j, min_conf=0.5)

    # a.jpg ET b.jpg portaient une boîte du groupe supprimé → écartées toutes
    # les deux, même si b.jpg portait aussi une fenêtre valide
    assert labels == {}
    assert any(t["reason"] == "ouverture_supprimee" for t in triage)


def test_unmatched_correction_excludes_the_whole_job():
    j = job(
        [group(boxes=[box("a.jpg")])],
        [log("removed", snap(w=999), {"deleted": True})],  # aucun groupe à 999
    )
    labels, triage, _ = bud.build_job_labels(j, min_conf=0.5)
    assert labels == {}
    assert triage[0]["reason"] == "appariement_ambigu"


# ─── to_yolo_line ─────────────────────────────────────────────────────────


def test_to_yolo_line_normalizes():
    line = bud.to_yolo_line(0, [0, 0, 50, 100], 100, 200)
    assert line == "0 0.250000 0.250000 0.500000 0.500000"


def test_to_yolo_line_clamps_out_of_bounds():
    line = bud.to_yolo_line(1, [-10, -10, 60, 60], 100, 100)
    cls, cx, cy, w, h = line.split()
    assert cls == "1"
    assert float(w) == 0.5  # 50 px restants après clamp
    assert float(cx) == 0.25


def test_to_yolo_line_rejects_degenerate():
    assert bud.to_yolo_line(0, [200, 200, 50, 50], 100, 100) is None
    assert bud.to_yolo_line(0, [0, 0, 1, 1], 100, 100) is None


# ─── split_projects ───────────────────────────────────────────────────────


def test_split_takes_newest_projects_for_val():
    projects = [
        ("p-old", "2026-06-01T00:00:00+00:00", 100),
        ("p-new", "2026-07-01T00:00:00+00:00", 40),
    ]
    assert bud.split_projects(projects, 0.2, 30) == {"p-new"}


def test_split_disabled_below_min_val_images():
    projects = [
        ("p-old", "2026-06-01T00:00:00+00:00", 50),
        ("p-new", "2026-07-01T00:00:00+00:00", 10),
    ]
    assert bud.split_projects(projects, 0.2, 30) == set()


def test_split_never_swallows_every_project():
    projects = [("p-only", "2026-07-01T00:00:00+00:00", 200)]
    assert bud.split_projects(projects, 0.2, 30) == set()
