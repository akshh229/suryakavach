from __future__ import annotations

import numpy as np
import pytest

from suryakavach.config import load_config
from suryakavach.engines.bocpd import BOCPD
from suryakavach.engines.evt import intensity_quantiles
from suryakavach.engines.forecast import DiscreteHazard, rolling_features, vectorize
from suryakavach.engines.impact import compute_impact, map_severity
from suryakavach.engines.neupert import neupert_correlation
from suryakavach.engines.nowcast import run_nowcast
from suryakavach.goes import class_letter, class_meets_min, goes_class
from suryakavach.ingest.synthetic import build_all_days, build_day, catalogue_injections


def test_goes_class():
    assert goes_class(5e-4) == "X5.0"
    assert goes_class(2.5e-5) == "M2.5"
    assert goes_class(1.2e-6) == "C1.2"
    assert goes_class(3.4e-7) == "B3.4"
    assert goes_class(5.0e-8) == "A5.0"
    assert goes_class(0.0) == "A0.0"

    assert class_letter("X6.3") == "X"
    assert class_letter("m2.1") == "M"
    assert class_meets_min("X1.0", "M") is True
    assert class_meets_min("C5.0", "M") is False


def test_bocpd():
    bocpd = BOCPD(hazard=0.004, max_run=100)
    data = np.concatenate([np.random.normal(0, 0.1, 50), np.random.normal(5, 0.1, 50)])
    cps = bocpd.run(data)
    assert len(cps) == 100
    # Change point should be detected around index 50
    assert np.max(cps[45:55]) > 0.1


def test_neupert_correlation():
    t = np.linspace(0, 10, 100)
    sxr = np.sin(t)
    # Derivative of SXR as HXR for ideal Neupert effect
    hxr = np.gradient(sxr)
    corr = neupert_correlation(sxr, hxr, window=20)
    assert isinstance(corr, float)


def test_impact_and_severity():
    cfg = load_config()
    weights = cfg["impact"]["weights"]
    bands = cfg["severity_bands"]

    res = compute_impact(
        peak_flux_sxr=6.3e-4,
        hardness=0.05,
        impulsivity=10.0,
        duration_min=50,
        weights=weights,
        suit_available=False,
    )
    assert "index" in res
    assert 0.0 <= res["index"] <= 10.0

    sev = map_severity(res["index"], bands)
    assert "band" in sev
    assert "r_level" in sev


def test_forecast_hazard():
    dh = DiscreteHazard()
    X = np.random.randn(50, 8)
    yc = np.random.choice([0.0, 1.0], size=50)
    ym = np.random.choice([0.0, 1.0], size=50)
    dh.fit(X, yc, ym)

    feat = np.random.randn(8)
    preds = dh.predict_horizons(feat)
    assert "p_flare_20m" in preds
    assert "p_mplus_20m" in preds


def test_synthetic_ingest():
    injections = catalogue_injections()
    assert len(injections) > 0

    days = build_all_days(seed=42)
    assert "2024-02-22" in days
    d = days["2024-02-22"]
    assert len(d["solexs"]) == 1440
    assert len(d["hel1os"]) == 1440


def test_run_nowcast():
    cfg = load_config()
    days = build_all_days(seed=42)
    d = days["2024-02-22"]
    sxr = np.nan_to_num(d["solexs"], nan=np.nanmedian(d["solexs"]))
    hxr = np.nan_to_num(d["hel1os"], nan=np.nanmedian(d["hel1os"]))

    res = run_nowcast(sxr, hxr, cfg)
    assert len(res.posterior) == 1440
    assert len(res.events) > 0
