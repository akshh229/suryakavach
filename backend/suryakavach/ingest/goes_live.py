from __future__ import annotations

"""GOES XRS live source for Suryakavach.

Why this exists: the replay console (`Runtime.days`) is synthetic by design
(`config.yaml:data.source_state=synthetic`), while the PRADAN Aditya-L1
products on disk are uncalibrated counts that the data-contract forbids from
driving GOES class / impact. The one live transport already proven working in
this repo (see ``backend/data/real_days/2026-09-19/``) is the public NOAA
GOES XRS feed — calibrated W/m2, no auth, 1-minute cadence.

This module is stdlib-only (urllib) and owns:

* ``fetch_goes_xrs`` — one GET against the SWPC 1-day JSON feed.
* ``build_live_day`` — pure parse + 1-minute resample into the exact day-dict
  schema the engines consume (``ts/solexs/hel1os/quality/t0``), labelled
  ``observed_calibrated`` with honest ``noaa.goes.xrs`` provenance (NOT
  Aditya-L1).
* ``refresh_goes_live`` — fetch + build + persist CSVs under
  ``<data>/real_days/<day>/`` (same layout ``load_real_day_files`` reads),
  so a restart reloads the last live snapshot without network.

GOES channel mapping (documented at services.swpc.noaa.gov):
* ``0.1-0.8nm`` (long)  -> ``solexs`` proxy (soft X-ray, GOES class lives here)
* ``0.05-0.4nm`` (short) -> ``hel1os`` proxy (hard X-ray, Neupert-relevant)

``flux`` (electron-corrected) is used; ``observed_flux`` is ignored.
The live day carries versioned threshold-derived ``truth`` labels
(recipe ``goes-threshold-v1``, see ``goes_labels.py``) — valid supervision
for forecasting, circular for detection scoring (stated in each manifest).
The supervised forecast stays honest about this mixed training set in its
provenance.
"""

from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
from urllib.request import Request, urlopen

import numpy as np

UTC = timezone.utc

GOES_URL = "https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json"
SOURCE = "noaa.goes.xrs"

SXR_ENERGY = "0.1-0.8nm"
HXR_ENERGY = "0.05-0.4nm"


def fetch_goes_xrs(url: str = GOES_URL, timeout: float = 30.0) -> list[dict]:
    """Fetch the raw GOES XRS 1-day listing (one GET, no auth)."""
    req = Request(url, headers={"User-Agent": "suryakavach-goes-live/1.0"}, method="GET")
    try:
        with urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
    except (TimeoutError, OSError) as exc:
        raise RuntimeError(f"GOES XRS fetch failed: {exc}") from exc
    try:
        data = json.loads(raw.decode("utf-8"))
    except ValueError as exc:
        raise RuntimeError(f"GOES XRS returned non-JSON payload: {exc}") from exc
    if not isinstance(data, list) or not data:
        raise RuntimeError("GOES XRS returned an empty listing.")
    return data


def _parse_dt(s: str) -> datetime:
    s = s.strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(s)
    except ValueError:
        parsed = datetime.strptime(s, "%Y-%m-%dT%H:%M:%S%z")
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def build_live_day(records: list[dict]) -> dict:
    """Build an engines-ready day dict from raw GOES XRS records (pure)."""
    sxr_pts: list[tuple[datetime, float]] = []
    hxr_pts: list[tuple[datetime, float]] = []
    satellites: set[int] = set()
    for rec in records:
        if not isinstance(rec, dict):
            continue
        try:
            ts = _parse_dt(str(rec.get("time_tag", "")))
            flux = float(rec.get("flux", 0.0))
        except (ValueError, TypeError):
            continue
        if not np.isfinite(flux) or flux <= 0:
            continue
        energy = str(rec.get("energy", ""))
        sat = rec.get("satellite")
        if isinstance(sat, int):
            satellites.add(sat)
        if energy == SXR_ENERGY:
            sxr_pts.append((ts, flux))
        elif energy == HXR_ENERGY:
            hxr_pts.append((ts, flux))
    if not sxr_pts:
        raise ValueError("GOES XRS listing has no 0.1-0.8nm (SXR) samples.")

    # Trailing-window minute grid anchored at the earliest SXR sample.
    t0 = min(t for t, _ in sxr_pts).replace(second=0, microsecond=0)
    all_ts = sorted({t for t, _ in sxr_pts} | {t for t, _ in hxr_pts})
    grid = [t.replace(second=0, microsecond=0) for t in all_ts]
    # Deduplicate to minute resolution while preserving order.
    seen: set[datetime] = set()
    minutes: list[datetime] = []
    for g in grid:
        if g not in seen:
            seen.add(g)
            minutes.append(g)
    n = len(minutes)
    idx_of = {m: i for i, m in enumerate(minutes)}

    def accumulate(pts: list[tuple[datetime, float]]) -> np.ndarray:
        acc = np.zeros(n)
        cnt = np.zeros(n, dtype=np.int64)
        for t, v in pts:
            m = t.replace(second=0, microsecond=0)
            i = idx_of.get(m)
            if i is not None:
                acc[i] += v
                cnt[i] += 1
        out = np.full(n, np.nan)
        for i in range(n):
            if cnt[i]:
                out[i] = acc[i] / cnt[i]
        return out

    sxr = accumulate(sxr_pts)
    hxr = accumulate(hxr_pts) if hxr_pts else np.full(n, np.nan)

    quality = (np.isfinite(sxr) & np.isfinite(hxr)).astype(np.int8)
    # Engines need finite inputs; keep a floor but preserve the quality mask
    # so gaps stay visible to operators.
    sxr_f = np.where(np.isfinite(sxr), sxr, 1e-9)
    hxr_med = float(np.nanmedian(hxr)) if np.any(np.isfinite(hxr)) else 4e-10
    hxr_f = np.where(np.isfinite(hxr), hxr, hxr_med)

    latest = max(t for t, _ in sxr_pts + hxr_pts)
    day = {
        "ts": np.array(minutes, dtype=object),
        "solexs": sxr_f.astype(float),
        "hel1os": hxr_f.astype(float),
        "quality": quality,
        "t0": t0,
        "source_state": "observed_calibrated",
        "provenance": {
            "source": SOURCE,
            "url": GOES_URL,
            "satellites": sorted(satellites),
            "sxr_channel": SXR_ENERGY,
            "hxr_channel": HXR_ENERGY,
            "flux_field": "flux",
            "label_recipe": "goes-threshold-v1",
            "note": "GOES XRS proxy (NOT Aditya-L1); labels are threshold-derived.",
        },
        "truth": [],
        "latest_source_ts": latest.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "coverage": {"minutes": n, "quality_minutes": int(quality.sum())},
    }
    from suryakavach.ingest.goes_labels import label_day

    day["truth"] = label_day(day["ts"], day["solexs"])
    return day


def persist_live_day(day: dict, data_root: str | Path) -> Path:
    """Write live CSVs + meta under ``<root>/real_days/<YYYY-MM-DD>/``."""
    root = Path(data_root)
    day_key = day["t0"].strftime("%Y-%m-%d")
    dst = root / "real_days" / day_key
    dst.mkdir(parents=True, exist_ok=True)
    import csv

    for name, key in (("solexs_sxr.csv", "solexs"), ("hel1os_hxr.csv", "hel1os")):
        with (dst / name).open("w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh)
            w.writerow(["ISO_TS", "FLUX"])
            for t, v in zip(day["ts"], day[key]):
                w.writerow([t.strftime("%Y-%m-%dT%H:%M:%SZ"), f"{float(v):.6e}"])
    meta = {
        "day": day_key,
        "source": SOURCE,
        "source_url": GOES_URL,
        "satellites": day["provenance"]["satellites"],
        "ingested_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "latest_source_ts": day["latest_source_ts"],
        "minutes_covered": day["coverage"]["minutes"],
        "minutes_quality": day["coverage"]["quality_minutes"],
        "label": "GOES XRS live (calibrated W/m2 proxy)",
    }
    (dst / "_meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return dst


def refresh_goes_live(
    data_root: str | Path | None = None,
    records: list[dict] | None = None,
) -> tuple[str, dict, dict]:
    """Fetch (unless ``records`` given), label, persist. Returns (day, day_dict, meta)."""
    if data_root is None:
        from suryakavach.config import data_dir, load_config

        data_root = data_dir(load_config())
    from suryakavach.ingest.goes_labels import (
        persist_labels,
        write_label_manifest,
    )

    recs = records if records is not None else fetch_goes_xrs()
    day = build_live_day(recs)
    day_key = day["t0"].strftime("%Y-%m-%d")
    dst = persist_live_day(day, data_root)
    persist_labels(day_key, day["truth"], dst)
    manifest_path = write_label_manifest(day_key, day["truth"], dst, GOES_URL)
    meta = json.loads((dst / "_meta.json").read_text(encoding="utf-8"))
    meta["label_recipe"] = "goes-threshold-v1"
    meta["label_count"] = len(day["truth"])
    meta["label_manifest"] = manifest_path.name
    return day_key, day, meta


def load_latest_persisted(data_root: str | Path | None = None) -> tuple[str, dict] | None:
    """Reload the newest persisted live day without network (for boot)."""
    if data_root is None:
        from suryakavach.config import data_dir, load_config

        try:
            data_root = data_dir(load_config())
        except Exception:
            return None
    base = Path(data_root) / "real_days"
    if not base.is_dir():
        return None
    cands = sorted(
        [d for d in base.iterdir() if d.is_dir() and (d / "solexs_sxr.csv").exists()],
        key=lambda p: p.name,
    )
    if not cands:
        return None
    # Prefer snapshots that already carry versioned labels; fall back to the
    # newest bare CSV snapshot (labels attach on the next refresh).
    labelled = [d for d in cands if (d / "labels.csv").is_file()]
    src = labelled[-1] if labelled else cands[-1]
    try:
        from suryakavach.ingest.pradan import load_real_day_files
    except Exception:
        return None
    try:
        day = load_real_day_files(src.name, src)
    except (FileNotFoundError, OSError, ValueError):
        return None
    meta_path = src / "_meta.json"
    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        meta = {}
    if meta.get("source") != SOURCE:
        return None  # PRADAN uncalibrated dirs must never masquerade as live flux
    day["source_state"] = "observed_calibrated"
    day["provenance"] = {
        "source": SOURCE,
        "url": GOES_URL,
        "persisted_day": src.name,
        "label_recipe": "goes-threshold-v1",
        "note": "GOES XRS proxy (NOT Aditya-L1); labels are threshold-derived.",
    }
    from suryakavach.ingest.goes_labels import load_labels

    day["truth"] = load_labels(src)
    return src.name, day


def day_age_minutes(day: dict) -> float:
    """Age of the newest live sample in minutes (for staleness badges)."""
    ts = day.get("ts")
    if ts is None or len(ts) == 0:
        return float("inf")
    latest = ts[-1]
    if isinstance(latest, datetime):
        anchor = latest if latest.tzinfo else latest.replace(tzinfo=UTC)
    else:  # pragma: no cover - defensive
        return float("inf")
    return max(0.0, (datetime.now(UTC) - anchor).total_seconds() / 60.0)


def is_stale(fetched_at: str | None, interval_min: float = 5.0) -> bool:
    """True when no snapshot exists or it is older than ``interval_min``.

    Single place deciding "should we re-fetch" — used by the on-demand
    endpoint and the background auto-refresh loop so they never disagree.
    """
    if not fetched_at:
        return True
    try:
        fetched = datetime.fromisoformat(str(fetched_at).replace("Z", "+00:00"))
        if fetched.tzinfo is None:
            fetched = fetched.replace(tzinfo=UTC)
    except (ValueError, TypeError):
        return True
    return (datetime.now(UTC) - fetched).total_seconds() > interval_min * 60.0
