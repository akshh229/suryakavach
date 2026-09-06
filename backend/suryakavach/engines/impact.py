from __future__ import annotations

import math
from typing import Any


def _clip(x: float, lo: float = 0.0, hi: float = 10.0) -> float:
    return max(lo, min(hi, x))


def peak_sxr_score(peak_flux: float) -> float:
    if peak_flux <= 0:
        return 0.0
    # C1 (1e-6) ~ 2.5; M1 ~ 5; X1 ~ 7.5; X10 ~ 10
    return _clip(2.5 + 2.5 * math.log10(peak_flux / 1e-6))


def hardness_score(hardness: float) -> float:
    return _clip(10.0 * math.tanh(max(hardness, 0.0) / 8.0))


def impulsivity_score(impulsivity: float) -> float:
    return _clip(10.0 * math.tanh(max(impulsivity, 0.0) / 3.0))


def duration_score(duration_min: float) -> float:
    return _clip(10.0 * math.tanh(max(duration_min, 0.0) / 90.0))


def compute_impact(
    peak_flux_sxr: float,
    hardness: float,
    impulsivity: float,
    duration_min: float,
    weights: dict[str, float],
    suit_available: bool = False,
    suit_nuv: float = 0.0,
) -> dict[str, Any]:
    subs = {
        "peak_sxr": peak_sxr_score(peak_flux_sxr),
        "hardness": hardness_score(hardness),
        "impulsivity": impulsivity_score(impulsivity),
        "suit_nuv": _clip(suit_nuv) if suit_available else 0.0,
        "duration": duration_score(duration_min),
    }
    w = dict(weights)
    if not suit_available:
        # Renormalize remaining weights so the index stays 0–10 without inventing SUIT.
        rest = 1.0 - w.get("suit_nuv", 0.0)
        for k in ("peak_sxr", "hardness", "impulsivity", "duration"):
            w[k] = w[k] / rest if rest else w[k]
        w["suit_nuv"] = 0.0
    index = sum(w[k] * subs[k] for k in subs)
    index = round(_clip(index), 2)
    return {"index": index, "subscores": {k: round(v, 2) for k, v in subs.items()}, "weights_used": w}


def map_severity(index: float, bands: list[dict[str, Any]]) -> dict[str, Any]:
    for b in bands:
        if index < float(b["max"]):
            return {"band": b["band"], "r_level": b["r_level"]}
    last = bands[-1]
    return {"band": last["band"], "r_level": last["r_level"]}
