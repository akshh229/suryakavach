from datetime import datetime, timedelta, timezone

import numpy as np

from suryakavach.ingest import goes_live

UTC = timezone.utc


def _rec(ts: datetime, flux: float, energy: str) -> dict:
    return {
        "time_tag": ts.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "satellite": 18,
        "flux": flux,
        "observed_flux": flux * 1.1,
        "energy": energy,
    }


def test_build_live_day_maps_channels_and_grid():
    t0 = datetime(2026, 9, 19, 0, 0, tzinfo=UTC)
    recs: list[dict] = []
    for i in range(60):
        t = t0 + timedelta(minutes=i)
        recs.append(_rec(t, 2e-7 + i * 1e-9, goes_live.SXR_ENERGY))
        recs.append(_rec(t, 1e-7, goes_live.HXR_ENERGY))
    day = goes_live.build_live_day(recs)
    assert day["source_state"] == "observed_calibrated"
    assert day["provenance"]["source"] == "noaa.goes.xrs"
    assert len(day["ts"]) == 60
    assert isinstance(day["truth"], list)
    assert day["provenance"]["label_recipe"] == "goes-threshold-v1"
    assert np.all(np.isfinite(day["solexs"]))
    assert day["coverage"]["minutes"] == 60
    assert day["coverage"]["quality_minutes"] == 60


def test_build_live_day_requires_sxr():
    t0 = datetime(2026, 9, 19, 0, 0, tzinfo=UTC)
    recs = [_rec(t0 + timedelta(minutes=i), 1e-7, goes_live.HXR_ENERGY) for i in range(5)]
    try:
        goes_live.build_live_day(recs)
    except ValueError:
        pass
    else:  # pragma: no cover
        raise AssertionError("expected ValueError for missing SXR channel")


def test_refresh_goes_live_persists_compatible_csvs(tmp_path):
    t0 = datetime(2026, 9, 19, 0, 0, tzinfo=UTC)
    recs: list[dict] = []
    for i in range(30):
        t = t0 + timedelta(minutes=i)
        recs.append(_rec(t, 3e-7, goes_live.SXR_ENERGY))
        recs.append(_rec(t, 1.5e-7, goes_live.HXR_ENERGY))
    key, day, meta = goes_live.refresh_goes_live(tmp_path, records=recs)
    assert key == "2026-09-19"
    assert (tmp_path / "real_days" / key / "solexs_sxr.csv").exists()
    assert (tmp_path / "real_days" / key / "hel1os_hxr.csv").exists()
    assert (tmp_path / "real_days" / key / "labels.csv").exists()
    assert (tmp_path / "real_days" / key / "label_manifest.json").exists()
    assert meta["source"] == "noaa.goes.xrs"
    assert meta["label_recipe"] == "goes-threshold-v1"
    # Same layout load_real_day_files reads back without error.
    from suryakavach.ingest.pradan import load_real_day_files

    back = load_real_day_files(key, tmp_path / "real_days" / key)
    assert len(back["ts"]) == 1440


def test_is_stale_decides_refetch():
    from datetime import datetime, timezone

    assert goes_live.is_stale(None) is True
    assert goes_live.is_stale("not-a-time") is True
    fresh = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    assert goes_live.is_stale(fresh, 5.0) is False
    old = "2020-01-01T00:00:00Z"
    assert goes_live.is_stale(old, 5.0) is True
