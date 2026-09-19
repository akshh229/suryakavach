from __future__ import annotations

"""Versioned flare-label recipe for GOES XRS live days.

Recipe ``goes-threshold-v1`` (this file is the spec):

* Input: 1-minute GOES long-channel (0.1-0.8nm) flux, finite-filled.
* Smooth with a 5-minute causal rolling mean; background is a 60-minute
  causal rolling median (never looks ahead of the sample being labelled).
* Trigger where ``smooth >= max(3e-7, 1.8 * background)`` — a B3 floor so
  quiet-Sun (~2e-7) never fires, with a relative term so active days still
  trigger near their local background.
* Merge triggers separated by < 30 minutes into one event.
* Peak = maximum raw flux within 90 minutes of region start; end = first
  sample after the peak back under ``1.2 * background``, capped at 120
  minutes after onset. Events peaking under 3e-7 are dropped.
* Output: :class:`InjectedFlare` records (same type the synthetic cache
  uses), so the forecast fitter consumes them unchanged.

Honesty note (also stored in every manifest): these labels are *derived*
from the same XRS series they supervise. They are legitimate supervision
for forecasting ("predict a threshold-crossing onset in the next 20 min" —
standard practice), but detection scores measured against them would be
circular and must never be reported as independent skill. An independent
catalogue (e.g. SWPC/DONKI event list) remains the path to held-out
evaluation; a 3-way date-disjoint split manifest additionally needs >= 3
observed days (see ``suryakavach/splits.py``).
"""

from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
import csv
import json

import numpy as np
from numpy.typing import NDArray

from suryakavach.ingest.synthetic import InjectedFlare

UTC = timezone.utc

RECIPE_ID = "goes-threshold-v1"
LABEL_SOURCE = "noaa.goes.xrs derived (threshold recipe)"
FLOOR_FLUX = 3e-7
BG_RATIO = 1.8
SMOOTH_MIN = 5
BG_MIN = 60
MERGE_GAP_MIN = 30
PEAK_SEARCH_MIN = 90
MAX_DUR_MIN = 120


def _causal_mean(x: np.ndarray, w: int) -> np.ndarray:
    out = np.empty_like(x)
    c = np.cumsum(np.insert(x, 0, 0.0))
    for i in range(len(x)):
        lo = max(0, i - w + 1)
        out[i] = (c[i + 1] - c[lo]) / (i + 1 - lo)
    return out


def _causal_median(x: np.ndarray, w: int) -> np.ndarray:
    out = np.empty_like(x)
    for i in range(len(x)):
        lo = max(0, i - w + 1)
        out[i] = float(np.median(x[lo : i + 1]))
    return out


def label_day(ts: np.ndarray, sxr: np.ndarray) -> list[InjectedFlare]:
    """Derive flare labels for one live day (pure, causal, deterministic)."""
    n = len(ts)
    if n == 0:
        return []
    raw = np.asarray(sxr, dtype=float)
    finite = np.isfinite(raw)
    fill = float(np.nanmedian(raw[finite])) if np.any(finite) else 1e-9
    raw = np.where(finite, raw, fill)
    smooth = _causal_mean(raw, SMOOTH_MIN)
    bg = _causal_median(raw, BG_MIN)
    trig = smooth >= np.maximum(FLOOR_FLUX, BG_RATIO * bg)

    regions: list[list[int]] = []
    cur: list[int] = []
    last = -10**9
    for i in range(n):
        if not trig[i]:
            continue
        if cur and i - last > MERGE_GAP_MIN:
            regions.append(cur)
            cur = []
        cur.append(i)
        last = i
    if cur:
        regions.append(cur)

    events: list[InjectedFlare] = []
    for reg in regions:
        start = reg[0]
        hi = min(n, start + PEAK_SEARCH_MIN)
        peak_rel = int(np.argmax(raw[start:hi]))
        peak_idx = start + peak_rel
        peak_flux = float(raw[peak_idx])
        if peak_flux < FLOOR_FLUX:
            continue
        end = min(n - 1, start + MAX_DUR_MIN)
        level = 1.2 * float(bg[peak_idx])
        for j in range(peak_idx + 1, min(n, start + MAX_DUR_MIN + 1)):
            if raw[j] <= level:
                end = j
                break
        t = list(ts)
        events.append(
            InjectedFlare(
                onset=t[start],
                peak=t[peak_idx],
                end=t[end],
                peak_sxr=peak_flux,
                impulsive=peak_flux >= 1e-5,
            )
        )
    return events


def _iso(t: datetime) -> str:
    ts = t if t.tzinfo else t.replace(tzinfo=UTC)
    return ts.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def persist_labels(day_key: str, events: list[InjectedFlare], dst_dir: str | Path) -> Path:
    """Write ``labels.csv`` next to the flux CSVs."""
    dst = Path(dst_dir)
    dst.mkdir(parents=True, exist_ok=True)
    p = dst / "labels.csv"
    with p.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["onset", "peak", "end", "peak_sxr", "recipe"])
        for ev in events:
            w.writerow([_iso(ev.onset), _iso(ev.peak), _iso(ev.end), f"{ev.peak_sxr:.6e}", RECIPE_ID])
    return p


def load_labels(dst_dir: str | Path) -> list[InjectedFlare]:
    """Read back ``labels.csv`` (missing file -> no labels, never an error)."""
    p = Path(dst_dir) / "labels.csv"
    if not p.is_file():
        return []
    from suryakavach.ingest.pradan import _parse_dt

    events: list[InjectedFlare] = []
    try:
        with p.open("r", newline="", encoding="utf-8-sig") as fh:
            for row in csv.DictReader(fh):
                if not row:
                    continue
                try:
                    peak = float(row.get("peak_sxr", 0))
                except (TypeError, ValueError):
                    continue
                if peak <= 0:
                    continue
                try:
                    events.append(
                        InjectedFlare(
                            onset=_parse_dt(str(row["onset"])),
                            peak=_parse_dt(str(row["peak"])),
                            end=_parse_dt(str(row["end"])),
                            peak_sxr=peak,
                            impulsive=peak >= 1e-5,
                        )
                    )
                except (KeyError, ValueError):
                    continue
    except OSError:
        return []
    return events


def _sha256(path: Path) -> str:
    h = sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def write_label_manifest(
    day_key: str,
    events: list[InjectedFlare],
    dst_dir: str | Path,
    source_url: str,
) -> Path:
    """Write the versioned label manifest naming this observed label set."""
    from suryakavach.goes import goes_class

    dst = Path(dst_dir)
    hashes: list[str] = []
    for name in ("solexs_sxr.csv", "hel1os_hxr.csv", "labels.csv"):
        p = dst / name
        if p.is_file():
            hashes.append(f"sha256:{_sha256(p)}:{name}")
    manifest = {
        "id": f"live-goes-{day_key}",
        "kind": "label-manifest",
        "source_state": "observed_calibrated",
        "label_source": LABEL_SOURCE,
        "recipe": RECIPE_ID,
        "recipe_params": {
            "floor_flux": FLOOR_FLUX,
            "bg_ratio": BG_RATIO,
            "smooth_min": SMOOTH_MIN,
            "bg_min": BG_MIN,
            "merge_gap_min": MERGE_GAP_MIN,
        },
        "day": day_key,
        "source_url": source_url,
        "event_count": len(events),
        "events": [
            {
                "onset": _iso(ev.onset),
                "peak": _iso(ev.peak),
                "end": _iso(ev.end),
                "peak_sxr": ev.peak_sxr,
                "class": goes_class(ev.peak_sxr),
            }
            for ev in events
        ],
        "data_hashes": hashes,
        "created_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "note": (
            "Threshold-derived labels from the same XRS series: valid supervision "
            "for forecasting, circular for detection scoring. A 3-way split manifest "
            "needs >= 3 observed days."
        ),
    }
    p = dst / "label_manifest.json"
    p.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return p
