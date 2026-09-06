from __future__ import annotations

import math


GOES_THRESHOLDS = (
    ("A", 1e-8),
    ("B", 1e-7),
    ("C", 1e-6),
    ("M", 1e-5),
    ("X", 1e-4),
)

CLASS_RANK = {"A": 0, "B": 1, "C": 2, "M": 3, "X": 4}


def goes_class(flux_wm2: float) -> str:
    if flux_wm2 <= 0 or math.isnan(flux_wm2):
        return "A0.0"
    if flux_wm2 >= 1e-4:
        return f"X{flux_wm2 / 1e-4:.1f}"
    if flux_wm2 >= 1e-5:
        return f"M{flux_wm2 / 1e-5:.1f}"
    if flux_wm2 >= 1e-6:
        return f"C{flux_wm2 / 1e-6:.1f}"
    if flux_wm2 >= 1e-7:
        return f"B{flux_wm2 / 1e-7:.1f}"
    return f"A{max(flux_wm2 / 1e-8, 0.1):.1f}"


def class_letter(label: str) -> str:
    return (label or "A")[0].upper()


def class_meets_min(label: str, min_class: str) -> bool:
    return CLASS_RANK.get(class_letter(label), 0) >= CLASS_RANK.get(class_letter(min_class), 0)


def iso(ts) -> str:
    if hasattr(ts, "strftime"):
        return ts.strftime("%Y-%m-%dT%H:%M:%SZ")
    return str(ts)
