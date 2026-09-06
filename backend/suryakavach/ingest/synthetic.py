from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import numpy as np
from numpy.typing import NDArray


UTC = timezone.utc


@dataclass
class InjectedFlare:
    onset: datetime
    peak: datetime
    end: datetime
    peak_sxr: float
    impulsive: bool = True


def _flare_sxr(n: int, onset: int, peak: int, end: int, peak_flux: float) -> NDArray[np.float64]:
    y = np.zeros(n)
    rise = max(peak - onset, 1)
    decay = max(end - peak, 1)
    for i in range(max(onset, 0), min(peak, n)):
        x = (i - onset) / rise
        y[i] = peak_flux * (x**2)
    for i in range(max(peak, 0), min(end, n)):
        x = (i - peak) / decay
        y[i] = peak_flux * np.exp(-3.2 * x)
    return y


def _flare_hxr(n: int, onset: int, peak: int, end: int, peak_sxr: float, impulsive: bool) -> NDArray[np.float64]:
    y = np.zeros(n)
    h_peak = peak_sxr * (18.0 if impulsive else 6.0)
    h_end = onset + max(int(0.7 * (peak - onset)), 2)
    span = max(h_end - onset, 1)
    for i in range(max(onset, 0), min(h_end, n)):
        x = (i - onset) / span
        y[i] = h_peak * np.sin(np.pi * min(max(x, 0.0), 1.0)) ** 2
    for i in range(max(h_end, 0), min(end, n)):
        base = y[h_end - 1] if h_end > 0 else 0.0
        y[i] = base * np.exp(-0.15 * (i - h_end))
    return y


def catalogue_injections() -> list[InjectedFlare]:
    flares: list[InjectedFlare] = [
        InjectedFlare(
            onset=datetime(2024, 2, 22, 22, 8, tzinfo=UTC),
            peak=datetime(2024, 2, 22, 22, 34, tzinfo=UTC),
            end=datetime(2024, 2, 22, 23, 40, tzinfo=UTC),
            peak_sxr=6.3e-4,
            impulsive=True,
        ),
        InjectedFlare(
            onset=datetime(2024, 2, 22, 6, 12, tzinfo=UTC),
            peak=datetime(2024, 2, 22, 6, 28, tzinfo=UTC),
            end=datetime(2024, 2, 22, 7, 10, tzinfo=UTC),
            peak_sxr=3.4e-6,
            impulsive=True,
        ),
    ]
    rng = np.random.default_rng(42)
    days = [
        datetime(2024, 2, 10, tzinfo=UTC),
        datetime(2024, 2, 12, tzinfo=UTC),
        datetime(2024, 2, 16, tzinfo=UTC),
        datetime(2024, 2, 25, tzinfo=UTC),
        datetime(2024, 3, 3, tzinfo=UTC),
        datetime(2024, 3, 10, tzinfo=UTC),
        datetime(2024, 3, 17, tzinfo=UTC),
        datetime(2024, 4, 6, tzinfo=UTC),
        datetime(2024, 5, 5, tzinfo=UTC),
        datetime(2024, 5, 11, tzinfo=UTC),
        datetime(2024, 7, 28, tzinfo=UTC),
        datetime(2024, 8, 5, tzinfo=UTC),
    ]
    peaks = [
        2.1e-6, 8.8e-6, 1.4e-5, 3.2e-5, 6.1e-6, 2.7e-5, 1.1e-4, 4.5e-6,
        9.2e-6, 2.2e-5, 5.5e-5, 7.4e-6, 1.8e-6, 4.1e-5, 8.0e-6, 1.6e-5,
        3.3e-6, 2.9e-5, 6.7e-6, 1.3e-5, 4.8e-6, 2.4e-6, 7.1e-5, 9.9e-6,
        1.05e-4, 3.6e-6, 8.4e-6, 1.9e-5,
    ]
    k = 0
    for d in days:
        n_fl = 2 if k % 3 == 0 else 3
        hours = [4, 11, 18][:n_fl]
        for h in hours:
            if k >= len(peaks):
                break
            onset_m = int(rng.integers(0, 40))
            rise = int(rng.integers(8, 28))
            decay = int(rng.integers(25, 80))
            onset = d.replace(hour=h, minute=onset_m)
            peak = onset + timedelta(minutes=rise)
            end = peak + timedelta(minutes=decay)
            flares.append(
                InjectedFlare(
                    onset=onset,
                    peak=peak,
                    end=end,
                    peak_sxr=float(peaks[k]),
                    impulsive=bool(peaks[k] >= 1e-5),
                )
            )
            k += 1
    return flares


def build_day(day: datetime, day_flares: list[InjectedFlare], seed: int) -> dict:
    t0 = day.replace(hour=0, minute=0, second=0, microsecond=0)
    n = 1440
    rng = np.random.default_rng(seed + t0.toordinal())
    t = np.arange(n)
    sxr = 8e-8 * (1.0 + 0.12 * np.sin(2 * np.pi * t / 1440))
    sxr = sxr * rng.lognormal(0.0, 0.03, size=n)
    hxr = 3e-9 * (1.0 + 0.08 * np.sin(2 * np.pi * t / 1440 + 0.5))
    hxr = hxr * rng.lognormal(0.0, 0.04, size=n)
    quality = np.ones(n, dtype=np.int8)
    for fl in day_flares:
        o = int((fl.onset - t0).total_seconds() // 60)
        p = int((fl.peak - t0).total_seconds() // 60)
        e = int((fl.end - t0).total_seconds() // 60)
        sxr += _flare_sxr(n, o, p, e, fl.peak_sxr)
        hxr += _flare_hxr(n, o, p, e, fl.peak_sxr, fl.impulsive)
    if day.day % 5 == 0:
        g0 = 400
        quality[g0 : g0 + 7] = 0
        sxr[g0 : g0 + 7] = np.nan
        hxr[g0 : g0 + 7] = np.nan
    ts = np.array([t0 + timedelta(minutes=int(i)) for i in range(n)])
    return {
        "ts": ts,
        "solexs": sxr,
        "hel1os": hxr,
        "quality": quality,
        "t0": t0,
    }


def build_all_days(seed: int = 42) -> dict[str, dict]:
    flares = catalogue_injections()
    by_day: dict[str, list[InjectedFlare]] = {}
    for fl in flares:
        key = fl.onset.strftime("%Y-%m-%d")
        by_day.setdefault(key, []).append(fl)
    out = {}
    for key, fls in by_day.items():
        day = datetime.strptime(key, "%Y-%m-%d").replace(tzinfo=UTC)
        out[key] = build_day(day, fls, seed)
        out[key]["truth"] = fls
    return out
