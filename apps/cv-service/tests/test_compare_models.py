"""Tests des gates de non-régression de training/compare_models.py (CV-6).

Logique pure uniquement (pas de torch) — CI-safe.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "training"))

from compare_models import evaluate_gates  # noqa: E402


def metrics(door=0.80, window=0.70, map50_95=0.50):
    return {
        "classes": {"door": {"map50": door}, "window": {"map50": window}},
        "map50_95": map50_95,
    }


def test_pass_when_candidate_within_epsilon():
    checks, verdict = evaluate_gates(
        baseline=metrics(),
        candidate=metrics(door=0.79, window=0.69, map50_95=0.49),
        eps=0.02, user=None, min_user_val=30,
    )
    assert verdict == "PASS"
    assert checks["user_val_map50"] is None  # gate inactif sans user-val


def test_fail_on_single_class_collapse_even_if_other_improves():
    checks, verdict = evaluate_gates(
        baseline=metrics(),
        candidate=metrics(door=0.95, window=0.60),  # window s'effondre
        eps=0.02, user=None, min_user_val=30,
    )
    assert verdict == "FAIL"
    assert checks["map50_window"] is False
    assert checks["map50_door"] is True


def test_fail_on_map50_95_regression():
    _, verdict = evaluate_gates(
        baseline=metrics(map50_95=0.50),
        candidate=metrics(map50_95=0.40),
        eps=0.02, user=None, min_user_val=30,
    )
    assert verdict == "FAIL"


def test_user_gate_inactive_below_min_images():
    checks, verdict = evaluate_gates(
        baseline=metrics(), candidate=metrics(), eps=0.02,
        user={"val_images": 10, "baseline_map50": 0.9, "candidate_map50": 0.1},
        min_user_val=30,
    )
    # 10 images = bruit statistique → gate consigné inactif, non bloquant
    assert checks["user_val_map50"] is None
    assert verdict == "PASS"


def test_user_gate_active_requires_candidate_at_least_baseline():
    checks, verdict = evaluate_gates(
        baseline=metrics(), candidate=metrics(), eps=0.02,
        user={"val_images": 50, "baseline_map50": 0.70, "candidate_map50": 0.65},
        min_user_val=30,
    )
    assert checks["user_val_map50"] is False
    assert verdict == "FAIL"

    checks, verdict = evaluate_gates(
        baseline=metrics(), candidate=metrics(), eps=0.02,
        user={"val_images": 50, "baseline_map50": 0.70, "candidate_map50": 0.71},
        min_user_val=30,
    )
    assert checks["user_val_map50"] is True
    assert verdict == "PASS"
