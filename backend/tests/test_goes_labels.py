from datetime import datetime, timedelta, timezone

import numpy as np

from suryakavach.ingest import goes_labels
from suryakavach.ingest.goes_labels import RECIPE_ID

UTC = timezone.utc


def _day(n: int = 240, base: float = 2e-7):
    t0 = datetime(2026, 9, 19, 0, 0, tzinfo=UTC)
    ts = np.array([t0 + timedelta(minutes=i) for i in range(n)], dtype=object)
    sxr = np.full(n, base)
    return ts, sxr


def test_quiet_sun_yields_no_labels():
    ts, sxr = _day()
    assert goes_labels.label_day(ts, sxr) == []


def test_bump_yields_one_label_with_right_shape():
    ts, sxr = _day()
    # triangular B7-like bump peaking at minute 120
    for i in range(100, 141):
        sxr[i] += 5e-7 * (1 - abs(i - 120) / 20)
    evs = goes_labels.label_day(ts, sxr)
    assert len(evs) == 1
    ev = evs[0]
    assert ev.peak_sxr > 6e-7
    assert ev.onset <= ev.peak <= ev.end
    assert ev.impulsive is False
    assert (ev.end - ev.onset).total_seconds() / 60 <= 121


def test_x_bump_is_impulsive():
    ts, sxr = _day()
    sxr[50:70] = 6.3e-4
    evs = goes_labels.label_day(ts, sxr)
    assert len(evs) == 1
    assert evs[0].impulsive is True
    assert evs[0].peak_sxr == 6.3e-4


def test_close_bumps_merge():
    ts, sxr = _day()
    sxr[60:70] = 8e-7
    sxr[80:90] = 8e-7  # 10-min gap < 30-min merge window
    evs = goes_labels.label_day(ts, sxr)
    assert len(evs) == 1


def test_persist_load_roundtrip_and_manifest(tmp_path):
    ts, sxr = _day()
    sxr[60:80] = 8e-7
    evs = goes_labels.label_day(ts, sxr)
    assert len(evs) == 1
    (tmp_path / "solexs_sxr.csv").write_text("x", encoding="utf-8")
    (tmp_path / "hel1os_hxr.csv").write_text("y", encoding="utf-8")
    goes_labels.persist_labels("2026-09-19", evs, tmp_path)
    back = goes_labels.load_labels(tmp_path)
    assert len(back) == 1
    assert abs(back[0].peak_sxr - evs[0].peak_sxr) < 1e-12
    mp = goes_labels.write_label_manifest(
        "2026-09-19", evs, tmp_path, "https://example.invalid/x.json"
    )
    import json

    raw = json.loads(mp.read_text(encoding="utf-8"))
    assert raw["recipe"] == RECIPE_ID
    assert raw["source_state"] == "observed_calibrated"
    assert raw["event_count"] == 1
    assert len(raw["data_hashes"]) == 3
    assert "circular" in raw["note"]


def test_missing_labels_file_is_empty():
    assert goes_labels.load_labels("/nonexistent-dir-xyz") == []
