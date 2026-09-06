from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
import json
import threading
import uuid
from dataclasses import replace
from typing import Any

import numpy as np

from suryakavach.config import data_dir, load_config
from suryakavach.db import connect
from suryakavach.engines.evt import intensity_quantiles
from suryakavach.engines.forecast import DiscreteHazard, rolling_features
from suryakavach.engines.impact import compute_impact, map_severity
from suryakavach.engines.nowcast import FlareEvent, run_nowcast
from suryakavach.goes import class_meets_min, goes_class, iso
from suryakavach.ingest.synthetic import build_all_days

UTC = timezone.utc


def _ffill(x: np.ndarray) -> np.ndarray:
    y = x.copy()
    last = np.nanmedian(y)
    for i in range(len(y)):
        if np.isnan(y[i]):
            y[i] = last
        else:
            last = y[i]
    return y


class Runtime:
    def __init__(self) -> None:
        self.cfg = load_config()
        self.data_path = data_dir(self.cfg)
        self.conn = connect(self.data_path / "suryakavach.sqlite")
        self.lock = threading.RLock()
        self.ws_clients: set[asyncio.Queue] = set()
        self.loop: asyncio.AbstractEventLoop | None = None
        self.mode = "simulated"
        self.playing = False
        self.speed = float(self.cfg["replay"]["default_speed"])
        self.event_date = str(self.cfg["replay"]["default_event"])
        self.cursor = 0
        self.session_id: int | None = None
        self.hazard = DiscreteHazard()
        self.days: dict[str, dict] = {}
        self.nowcast_by_day: dict[str, Any] = {}
        self.engine_status = {
            "nowcast": "starting",
            "forecast": "starting",
            "impact": "starting",
        }
        self.last_tick = datetime.now(UTC)
        self._boot()

    def _boot(self) -> None:
        self.days = build_all_days(int(self.cfg["data"]["seed"]))
        self._fit_forecast()
        self._run_all_nowcasts()
        self._persist_flares()
        self.engine_status = {k: "ok" for k in self.engine_status}
        # Default demo: 2024-02-22 at 21:00 so onset (22:08) arrives quickly at 20×
        self.event_date = "2024-02-22"
        self.cursor = 21 * 60
        self.playing = True
        self.speed = float(self.cfg["replay"]["default_speed"])

    def _fit_forecast(self) -> None:
        xs = []
        yc = []
        ym = []
        for day in self.days.values():
            sxr = _ffill(day["solexs"])
            hxr = _ffill(day["hel1os"])
            onsets = [int((fl.onset - day["t0"]).total_seconds() // 60) for fl in day["truth"]]
            m_onsets = [
                int((fl.onset - day["t0"]).total_seconds() // 60)
                for fl in day["truth"]
                if fl.peak_sxr >= 1e-5
            ]
            for i in range(60, 1440, 5):
                last = max([o for o in onsets if o < i], default=None)
                feat = rolling_features(sxr[: i + 1], hxr[: i + 1], last_flare_idx=last)
                xs.append(feat)
                yc.append(1.0 if any(i < o <= i + 20 for o in onsets) else 0.0)
                ym.append(1.0 if any(i < o <= i + 20 for o in m_onsets) else 0.0)
        from suryakavach.engines.forecast import vectorize

        X = np.array([vectorize(row) if isinstance(row, dict) else row for row in xs], dtype=float)
        self.hazard.fit(X, np.array(yc), np.array(ym))

    def _run_all_nowcasts(self) -> None:
        for key, day in self.days.items():
            sxr = _ffill(day["solexs"])
            hxr = _ffill(day["hel1os"])
            nc = run_nowcast(sxr, hxr, self.cfg)
            for ev in nc.events:
                ev.id = f"{key}-{ev.id}"
            for ev in nc.baseline_events:
                ev.id = f"{key}-{ev.id}"
            self.nowcast_by_day[key] = nc
            peaks = [e.peak_flux_sxr for e in nc.events]
            day["evt"] = intensity_quantiles(peaks)

    def _persist_flares(self) -> None:
        self.conn.execute("DELETE FROM flares")
        n = 0
        for key, nc in self.nowcast_by_day.items():
            day = self.days[key]
            ts = day["ts"]
            for ev in nc.events + nc.baseline_events:
                n += 1
                dur = ev.duration_min()
                impact = compute_impact(
                    ev.peak_flux_sxr,
                    ev.hardness,
                    ev.impulsivity,
                    dur,
                    self.cfg["impact"]["weights"],
                    self.cfg["impact"]["suit_available"],
                )
                sev = map_severity(impact["index"], self.cfg["severity_bands"])
                ev.index = impact["index"]
                ev.severity_band = sev["band"]
                ev.r_level = sev["r_level"]
                end_ts = iso(ts[ev.end_idx]) if ev.end_idx is not None else None
                self.conn.execute(
                    """INSERT OR REPLACE INTO flares
                    (id, onset, peak, end, class, peak_flux_sxr, peak_flux_hxr, hardness,
                     impulsivity, integrated_flux, impact_index, severity_band, r_level,
                     detection_method, onset_idx, peak_idx, end_idx, posterior)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (
                        ev.id if ev.detection_method != "threshold" else ev.id,
                        iso(ts[ev.onset_idx]),
                        iso(ts[ev.peak_idx]),
                        end_ts,
                        ev.class_label,
                        ev.peak_flux_sxr,
                        ev.peak_flux_hxr,
                        ev.hardness,
                        ev.impulsivity,
                        ev.integrated_flux,
                        ev.index,
                        ev.severity_band,
                        ev.r_level,
                        ev.detection_method,
                        ev.onset_idx,
                        ev.peak_idx,
                        ev.end_idx,
                        ev.posterior_at_onset,
                    ),
                )
        self.conn.commit()

    def available_dates(self) -> list[str]:
        return sorted(self.days.keys())

    def day(self) -> dict:
        return self.days[self.event_date]

    def envelope(self, data: Any, extra_meta: dict | None = None) -> dict:
        meta = {
            "timestamp": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "mode": self.mode,
            "event_date": self.event_date,
            "cursor": iso(self.day()["ts"][self.cursor]),
        }
        if extra_meta:
            meta.update(extra_meta)
        return {"data": data, "meta": meta}

    def health(self) -> dict:
        ts = self.day()["ts"][self.cursor]
        return {
            "status": "ok",
            "data_last_timestamp": iso(ts),
            "engines": dict(self.engine_status),
            "mode": self.mode,
            "playing": self.playing,
            "speed": self.speed,
        }

    def streams_latest(self, window: int = 120) -> dict:
        day = self.day()
        i0 = max(0, self.cursor - window + 1)
        sl = slice(i0, self.cursor + 1)
        nc = self._nowcast_until(self.cursor)
        shades = []
        for ev in nc.events:
            if ev.onset_idx > self.cursor:
                continue
            end = min(ev.end_idx if ev.end_idx is not None else self.cursor, self.cursor)
            if end < i0:
                continue
            shades.append(
                {
                    "start": iso(day["ts"][ev.onset_idx]),
                    "end": iso(day["ts"][end]),
                    "class": ev.class_label,
                }
            )
        cps = []
        post = nc.posterior[: self.cursor + 1]
        for j in range(i0, self.cursor + 1):
            if post[j] >= float(self.cfg["bocpd"]["threshold"]):
                cps.append({"t": iso(day["ts"][j]), "p": round(float(post[j]), 3)})
        q = day["quality"][sl]
        gaps = []
        in_gap = False
        g0 = 0
        idx_range = list(range(i0, self.cursor + 1))
        for k, gi in enumerate(idx_range):
            if day["quality"][gi] == 0 and not in_gap:
                in_gap = True
                g0 = gi
            elif day["quality"][gi] != 0 and in_gap:
                gaps.append({"start": iso(day["ts"][g0]), "end": iso(day["ts"][gi - 1])})
                in_gap = False
        return {
            "solexs": [
                {"t": iso(t), "v": None if np.isnan(v) else float(v)}
                for t, v in zip(day["ts"][sl], day["solexs"][sl])
            ],
            "hel1os": [
                {"t": iso(t), "v": None if np.isnan(v) else float(v)}
                for t, v in zip(day["ts"][sl], day["hel1os"][sl])
            ],
            "quality": [int(x) for x in q],
            "flare_intervals": shades,
            "changepoints": cps,
            "gaps": gaps,
        }

    def _nowcast_until(self, idx: int):
        """Causal slice of the day nowcast (BOCPD update is online; no future leakage)."""
        full = self.nowcast_by_day[self.event_date]
        events = []
        for ev in full.events:
            if ev.onset_idx > idx:
                continue
            clone = replace(ev)
            if clone.peak_idx > idx:
                clone.peak_idx = idx
                clone.state = "rising"
                clone.end_idx = None
            elif clone.end_idx is None or clone.end_idx > idx:
                if idx - clone.peak_idx <= 2:
                    clone.state = "peak"
                else:
                    clone.state = "decay"
                clone.end_idx = None
            events.append(clone)
        baseline = [e for e in full.baseline_events if e.onset_idx <= idx]
        active = events[-1] if events and events[-1].end_idx is None else None
        state = active.state if active else "quiet"
        out = type(full)(
            posterior=full.posterior[: idx + 1],
            events=events,
            baseline_events=baseline,
            state=state,
            active=active,
        )
        return out

    def nowcast_state(self) -> dict:
        nc = self._nowcast_until(self.cursor)
        active = None
        if nc.events:
            last = nc.events[-1]
            if last.end_idx is None or last.end_idx >= self.cursor - 2:
                if last.onset_idx <= self.cursor:
                    active = self._flare_public(last, prefix=True)
        return {
            "state": nc.state if active else "quiet",
            "active": active,
            "threshold_baseline_active": bool(
                nc.baseline_events
                and nc.baseline_events[-1].onset_idx <= self.cursor
                and (nc.baseline_events[-1].end_idx is None or nc.baseline_events[-1].end_idx >= self.cursor)
            ),
        }

    def _flare_public(self, ev: FlareEvent, prefix: bool = False) -> dict:
        day = self.day()
        ts = day["ts"]
        end_idx = ev.end_idx
        peak_idx = min(ev.peak_idx, self.cursor) if prefix else ev.peak_idx
        return {
            "id": ev.id,
            "onset": iso(ts[ev.onset_idx]),
            "peak": iso(ts[peak_idx]),
            "end": iso(ts[end_idx]) if end_idx is not None and (not prefix or end_idx <= self.cursor) else None,
            "state": ev.state,
            "class": ev.class_label if not prefix else goes_class(float(day["solexs"][peak_idx])),
            "peak_flux_sxr": ev.peak_flux_sxr,
            "peak_flux_hxr": ev.peak_flux_hxr,
            "hardness": ev.hardness,
            "impulsivity": ev.impulsivity,
            "integrated_flux": ev.integrated_flux,
            "index": ev.index,
            "severity_band": ev.severity_band,
            "r_level": ev.r_level,
            "detection_method": ev.detection_method,
            "posterior": ev.posterior_at_onset,
        }

    def forecast_horizons(self) -> dict:
        day = self.day()
        i = self.cursor
        sxr = _ffill(day["solexs"][: i + 1])
        hxr = _ffill(day["hel1os"][: i + 1])
        nc = self._nowcast_until(i)
        last = nc.events[-1].onset_idx if nc.events else None
        feat = rolling_features(sxr, hxr, last_flare_idx=last)
        pred = self.hazard.predict(feat, list(self.cfg["horizons"]))
        evt = day.get("evt") or intensity_quantiles(
            [e.peak_flux_sxr for e in self.nowcast_by_day[self.event_date].events]
        )
        for h in pred["horizons"]:
            h["q50"] = evt["q50"]
            h["q90"] = evt["q90"]
            h["q99"] = evt["q99"]
        return pred

    def impact_current(self) -> dict:
        nc = self._nowcast_until(self.cursor)
        if not nc.events:
            empty = compute_impact(1e-8, 0.1, 0.0, 1, self.cfg["impact"]["weights"], False)
            sev = map_severity(empty["index"], self.cfg["severity_bands"])
            return {
                "index": empty["index"],
                "band": sev["band"],
                "r_level": sev["r_level"],
                "g_level": "G0",
                "s_level": "S0",
                "subscores": empty["subscores"],
                "note": "No active/recent flare in window.",
            }
        ev = nc.events[-1]
        dur = max(min(self.cursor, ev.end_idx or self.cursor) - ev.onset_idx, 1)
        peak = float(np.nanmax(_ffill(self.day()["solexs"][ev.onset_idx : self.cursor + 1])))
        hxr_peak = float(np.nanmax(_ffill(self.day()["hel1os"][ev.onset_idx : self.cursor + 1])))
        hardness = hxr_peak / max(peak, 1e-12)
        impulsivity = peak / dur * 1e6
        impact = compute_impact(
            peak, hardness, impulsivity, dur, self.cfg["impact"]["weights"], False
        )
        sev = map_severity(impact["index"], self.cfg["severity_bands"])
        return {
            "index": impact["index"],
            "band": sev["band"],
            "r_level": sev["r_level"],
            "g_level": "G0",
            "s_level": "S0",
            "subscores": impact["subscores"],
            "flare_id": ev.id,
            "note": "SUIT NUV unavailable in v1 cache; weight renormalized.",
        }

    def catalogue(self, frm: str | None, to: str | None, min_class: str, page: int, size: int, method: str | None):
        q = "SELECT * FROM flares WHERE 1=1"
        args: list[Any] = []
        if frm:
            q += " AND onset >= ?"
            args.append(frm if "T" in frm else frm + "T00:00:00Z")
        if to:
            q += " AND onset <= ?"
            args.append(to if "T" in to else to + "T23:59:59Z")
        if method:
            q += " AND detection_method = ?"
            args.append(method)
        q += " ORDER BY onset DESC"
        rows = [dict(r) for r in self.conn.execute(q, args).fetchall()]
        rows = [r for r in rows if class_meets_min(r["class"], min_class)]
        total = len(rows)
        start = (page - 1) * size
        chunk = rows[start : start + size]
        return {"items": chunk, "page": page, "page_size": size, "total": total}

    def flare_detail(self, fid: str) -> dict | None:
        row = self.conn.execute("SELECT * FROM flares WHERE id = ?", (fid,)).fetchone()
        if not row:
            return None
        rec = dict(row)
        date = rec["onset"][:10]
        day = self.days.get(date)
        if not day:
            return rec
        o, p, e = rec["onset_idx"], rec["peak_idx"], rec["end_idx"] or rec["peak_idx"]
        i0, i1 = max(0, o - 30), min(1439, e + 30)
        nc = self.nowcast_by_day[date]
        rec["series"] = {
            "solexs": [
                {"t": iso(day["ts"][i]), "v": float(day["solexs"][i]) if not np.isnan(day["solexs"][i]) else None}
                for i in range(i0, i1 + 1)
            ],
            "hel1os": [
                {"t": iso(day["ts"][i]), "v": float(day["hel1os"][i]) if not np.isnan(day["hel1os"][i]) else None}
                for i in range(i0, i1 + 1)
            ],
            "posterior": [
                {"t": iso(day["ts"][i]), "v": float(nc.posterior[i])} for i in range(i0, min(i1, len(nc.posterior) - 1) + 1)
            ],
        }
        impact = compute_impact(
            rec["peak_flux_sxr"],
            rec["hardness"],
            rec["impulsivity"],
            max((e or p) - o, 1),
            self.cfg["impact"]["weights"],
            False,
        )
        rec["subscores"] = impact["subscores"]
        rec["confidence"] = (
            "Changepoint posterior at onset "
            f"{rec['posterior']:.2f}. Neupert gate applied. "
            "Index uses hand-tuned weights (SUIT term dropped)."
        )
        return rec

    def alerts(self, since: str | None) -> list[dict]:
        q = "SELECT * FROM alerts"
        args: list[Any] = []
        if since:
            q += " WHERE ts >= ?"
            args.append(since)
        q += " ORDER BY id DESC LIMIT 100"
        return [dict(r) for r in self.conn.execute(q, args).fetchall()]

    def _emit_alert(self, typ: str, severity: str, flare_id: str | None, message: str, ts: str) -> None:
        self.conn.execute(
            "INSERT INTO alerts (ts, type, severity, flare_id, message) VALUES (?,?,?,?,?)",
            (ts, typ, severity, flare_id, message),
        )
        self.conn.commit()

    def start_replay(self, event_date: str, speed: float) -> dict:
        if event_date not in self.days:
            raise ValueError(f"No cached day {event_date}")
        with self.lock:
            self.event_date = event_date
            self.speed = float(speed)
            self.mode = "simulated"
            self.playing = True
            # Start 3h before first truth flare, or 00:00
            truth = self.days[event_date]["truth"]
            if truth:
                t0 = self.days[event_date]["t0"]
                first = min(fl.onset for fl in truth)
                start = first - timedelta(hours=3)
                idx = int((start - t0).total_seconds() // 60)
                self.cursor = max(0, idx)
            else:
                self.cursor = 0
            cur = self.conn.execute(
                "INSERT INTO replay_sessions (event_date, speed, status, cursor) VALUES (?,?,?,?)",
                (event_date, self.speed, "running", iso(self.day()["ts"][self.cursor])),
            )
            self.session_id = cur.lastrowid
            self.conn.commit()
        return {"session_id": self.session_id, "event_date": event_date, "speed": self.speed, "cursor": iso(self.day()["ts"][self.cursor])}

    def stop_replay(self) -> dict:
        with self.lock:
            self.playing = False
            if self.session_id:
                self.conn.execute(
                    "UPDATE replay_sessions SET status=?, cursor=? WHERE id=?",
                    ("stopped", iso(self.day()["ts"][self.cursor]), self.session_id),
                )
                self.conn.commit()
        return {"status": "stopped", "cursor": iso(self.day()["ts"][self.cursor])}

    def set_cursor(self, idx: int) -> None:
        with self.lock:
            self.cursor = int(max(0, min(1439, idx)))

    def tick(self) -> dict:
        with self.lock:
            prev_state = None
            try:
                prev_nc = self._nowcast_until(self.cursor)
                prev_state = prev_nc.state
                prev_n = len(prev_nc.events)
                prev_idx = self.impact_current()["index"]
            except Exception:
                prev_n, prev_idx = 0, 0
            if self.playing:
                self.cursor = min(1439, self.cursor + 1)
            self.last_tick = datetime.now(UTC)
            ts = iso(self.day()["ts"][self.cursor])
            if self.day()["quality"][self.cursor] == 0:
                self._emit_alert("data_gap", "R1", None, f"DATA GAP at {ts}", ts)
            nc = self._nowcast_until(self.cursor)
            if len(nc.events) > prev_n:
                ev = nc.events[-1]
                self._emit_alert(
                    "flare_onset",
                    "R2",
                    ev.id,
                    f"Onset {ev.class_label} candidate at {ts} ({ev.detection_method})",
                    ts,
                )
            if nc.state == "peak" and prev_state != "peak" and nc.events:
                ev = nc.events[-1]
                self._emit_alert("flare_peak", ev.severity_band or "R2", ev.id, f"Peak {ev.class_label} {ts}", ts)
            impact = self.impact_current()
            if impact["index"] >= prev_idx + 1.0 and impact["index"] >= 4:
                self._emit_alert(
                    "severity_increase",
                    impact["band"],
                    impact.get("flare_id"),
                    f"Impact index {impact['index']} ({impact['band']})",
                    ts,
                )
            fc = self.forecast_horizons()
            if any(h["p_c1"] >= float(self.cfg["forecast"]["high_alert"]) for h in fc["horizons"]):
                last = self.alerts(None)
                if not last or last[0]["type"] != "forecast_high" or last[0]["ts"] != ts:
                    self._emit_alert("forecast_high", "R2", None, "P(≥C1) ≥ 0.7 on a forecast horizon", ts)
            payload = {
                "nowcast_state": self.nowcast_state(),
                "latest_points": self.streams_latest(180),
                "forecast": fc,
                "impact": impact,
                "alerts": self.alerts(None)[:6],
                "clock": {
                    "utc": ts,
                    "ist": (self.day()["ts"][self.cursor] + timedelta(hours=5, minutes=30)).strftime(
                        "%Y-%m-%dT%H:%M:%S+05:30"
                    ),
                },
                "mode": self.mode,
                "playing": self.playing,
                "speed": self.speed,
                "event_date": self.event_date,
                "cursor_idx": self.cursor,
            }
            return payload

    def live_snapshot(self) -> dict:
        return {
            "nowcast_state": self.nowcast_state(),
            "latest_points": self.streams_latest(180),
            "forecast": self.forecast_horizons(),
            "impact": self.impact_current(),
            "alerts": self.alerts(None)[:6],
            "clock": {
                "utc": iso(self.day()["ts"][self.cursor]),
                "ist": (self.day()["ts"][self.cursor] + timedelta(hours=5, minutes=30)).strftime(
                    "%Y-%m-%dT%H:%M:%S+05:30"
                ),
            },
            "mode": self.mode,
            "playing": self.playing,
            "speed": self.speed,
            "event_date": self.event_date,
            "cursor_idx": self.cursor,
            "dates": self.available_dates(),
        }


runtime = Runtime()
