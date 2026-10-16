from __future__ import annotations

from datetime import datetime, timedelta, timezone
from threading import Event, Thread
from types import SimpleNamespace

import numpy as np

from suryakavach.runtime import Runtime


def _live_day() -> dict:
    start = datetime(2026, 10, 16, tzinfo=timezone.utc)
    ts = np.array([start + timedelta(minutes=i) for i in range(90)], dtype=object)
    return {
        "ts": ts,
        "solexs": np.full(90, 2e-7),
        "hel1os": np.full(90, 1e-7),
        "quality": np.ones(90, dtype=np.int8),
        "t0": start,
        "truth": [],
        "source_state": "observed_calibrated",
        "provenance": {"source": "test"},
    }


def test_readiness_starts_false_without_opening_database():
    runtime = Runtime(boot=False)

    assert runtime.ready is False
    assert runtime.readiness()["state"] == "starting"
    assert runtime._conn is None


def test_failed_boot_never_becomes_ready(monkeypatch):
    runtime = Runtime(boot=False)
    # Avoid filesystem/provider setup: this test is solely about the lifecycle
    # transition when an early boot stage fails.
    runtime._conn = object()

    def fail_build_days():
        raise RuntimeError("provider details must not leak to clients")

    monkeypatch.setattr(runtime, "_build_preferred_days", fail_build_days)
    runtime.boot()

    assert runtime.booted is True
    assert runtime.ready is False
    assert runtime.readiness() == {
        "ready": False,
        "state": "failed",
        "engines": {"nowcast": "error", "forecast": "error", "impact": "error"},
        "error": "initialization failed",
    }


def test_health_is_safe_before_boot():
    runtime = Runtime(boot=False)

    health = runtime.health()
    assert health["status"] == "starting"
    assert health["data_last_timestamp"] is None
    assert health["source_state"] is None


def test_live_refresh_is_deduplicated_and_keeps_cached_snapshot(monkeypatch):
    """A second caller returns cached state while one slow refresh owns work."""
    runtime = Runtime(boot=False)
    cached = _live_day()
    replacement = _live_day()
    runtime.live_day = cached
    runtime.live_key = "cached"
    runtime.live_nowcast = SimpleNamespace(events=[])
    runtime.live_meta = {"cached": True}
    runtime.live_fetched_at = "2026-10-16T00:00:00Z"

    started = Event()
    release = Event()
    calls = 0

    def slow_refresh(_data_path):
        nonlocal calls
        calls += 1
        started.set()
        assert release.wait(2)
        return "replacement", replacement, {"cached": False}

    monkeypatch.setattr("suryakavach.ingest.goes_live.refresh_goes_live", slow_refresh)
    monkeypatch.setattr("suryakavach.runtime.run_nowcast", lambda *_args: SimpleNamespace(events=[]))
    monkeypatch.setattr(runtime, "_fit_forecast", lambda **_kwargs: None)

    first = Thread(target=runtime.refresh_live)
    first.start()
    assert started.wait(1)
    assert runtime.live_refreshing is True

    while_refreshing = runtime.refresh_live()
    assert calls == 1
    assert while_refreshing["available"] is True
    assert while_refreshing["day"] == "cached"

    release.set()
    first.join(timeout=2)
    assert not first.is_alive()
    assert runtime.live_status()["day"] == "replacement"
