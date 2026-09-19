from __future__ import annotations

"""Tests for the PRADAN live-intake poller (no network, no real data)."""

from suryakavach.ingest import pradan_live as p


def test_diff_is_additive(tmp_path):
    seen = {"a.fits": {"size": 10, "mtime": 1.0}}
    current = {
        "a.fits": {"size": 10, "mtime": 1.0},
        "b.fits": {"size": 20, "mtime": 2.0},
    }
    assert p.diff_manifest(seen, current) == ["b.fits"]
    assert p.diff_manifest(current, seen) == []


def test_poll_once_reports_old_vs_new(tmp_path):
    box = tmp_path / "inbox"
    box.mkdir()
    (box / "a.fits").write_bytes(b"0" * 1000)
    r1 = p.poll_once(box)
    assert r1["new_count"] == 1 and r1["old_count"] == 0
    (box / "b.fits").write_bytes(b"0" * 2000)
    (box / "c.fits.part").write_bytes(b"half")  # in-progress: ignored
    r2 = p.poll_once(box)
    assert r2["new_count"] == 1 and r2["new_files"] == ["b.fits"]
    assert r2["old_count"] == 1 and r2["old_bytes"] == 1000
    assert r2["total_count"] == 2 and r2["missing_count"] == 0
    assert r2["polls"] == 2 and r2["total_new_all_time"] == 2


def test_resolve_download_paths_known_and_unknown():
    ok, bare = p.resolve_download_paths(
        ["AL1_SLX_L1_20260917_v1.0.zip", "FUTURE_FILE_9999.fits"]
    )
    assert ok == [
        "/al1/protected/downloadData/solexs/level1/2026/09/N00_0000/AL1_SLX_L1_20260917_v1.0.zip?all"
    ]
    assert bare == ["FUTURE_FILE_9999.fits"]


def test_resolve_download_paths_href_passthrough():
    href = "/al1/protected/downloadData/suit/level1/2026/09/T26_1458/NEWFILE.fits?all&x=1"
    ok, bare = p.resolve_download_paths([href])
    assert ok == [href]
    assert bare == []


def test_scheduler_lifecycle_no_thread_leak(tmp_path):
    sched = p.PradanScheduler(inbox=tmp_path, interval_min=60.0)
    assert sched.state()["scheduled"] is False
    sched.start()
    assert sched.state()["scheduled"] is True
    sched.stop()
    assert sched.state()["scheduled"] is False
