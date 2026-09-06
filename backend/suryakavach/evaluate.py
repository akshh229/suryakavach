from __future__ import annotations

from pathlib import Path

import numpy as np

from suryakavach.config import load_config
from suryakavach.engines.nowcast import run_nowcast
from suryakavach.goes import CLASS_RANK, class_letter
from suryakavach.ingest.synthetic import build_all_days


def _metrics(tp, fp, fn, tn) -> dict:
    tss = (tp / (tp + fn) - fp / (fp + tn)) if (tp + fn) and (fp + tn) else 0.0
    hss_den = (tp + fn) * (fn + tn) + (tp + fp) * (fp + tn)
    hss = (2 * (tp * tn - fp * fn) / hss_den) if hss_den else 0.0
    far = fp / (tp + fp) if (tp + fp) else 0.0
    return {"TSS": tss, "HSS": hss, "FAR": far, "TP": tp, "FP": fp, "FN": fn, "TN": tn}


def evaluate() -> str:
    cfg = load_config()
    days = build_all_days(int(cfg["data"]["seed"]))
    lines = ["# SURYAKAVACH evaluation", "", "Synthetic fused SoLEXS/HEL1OS cache. Not an operational claim.", ""]
    all_lead = []
    tp = fp = fn = tn = 0
    m_tp = m_fp = m_fn = m_tn = 0
    brier = {h: [] for h in cfg["horizons"]}

    for key, day in days.items():
        sxr = day["solexs"].copy()
        hxr = day["hel1os"].copy()
        last = np.nanmedian(sxr)
        for i in range(len(sxr)):
            if np.isnan(sxr[i]):
                sxr[i] = last
            else:
                last = sxr[i]
        last = np.nanmedian(hxr)
        for i in range(len(hxr)):
            if np.isnan(hxr[i]):
                hxr[i] = last
            else:
                last = hxr[i]
        nc = run_nowcast(sxr, hxr, cfg)
        truth = [(int((fl.onset - day["t0"]).total_seconds() // 60), fl.peak_sxr, int((fl.peak - day["t0"]).total_seconds() // 60)) for fl in day["truth"]]
        matched = set()
        for ev in nc.events:
            hit = None
            for j, (o, peak, pidx) in enumerate(truth):
                if j in matched:
                    continue
                if abs(ev.onset_idx - o) <= 15:
                    hit = j
                    all_lead.append(pidx - ev.onset_idx)
                    break
            if hit is None:
                fp += 1
                if ev.peak_flux_sxr >= 1e-5:
                    m_fp += 1
            else:
                matched.add(hit)
                tp += 1
                if truth[hit][1] >= 1e-5:
                    m_tp += 1
        for j, (o, peak, pidx) in enumerate(truth):
            if j not in matched:
                fn += 1
                if peak >= 1e-5:
                    m_fn += 1
        tn += max(0, 12 - (tp + fp + fn))  # rough quiet-window count per day
        m_tn += 2

    m = _metrics(tp, fp, fn, max(tn, 1))
    mm = _metrics(m_tp, m_fp, m_fn, max(m_tn, 1))
    lead = float(np.mean(all_lead)) if all_lead else 0.0
    lines += [
        "## Detection (all classes, ±15 min vs injected onset)",
        "",
        f"- TSS: **{m['TSS']:.3f}**  HSS: **{m['HSS']:.3f}**  FAR: **{m['FAR']:.3f}**",
        f"- TP={m['TP']} FP={m['FP']} FN={m['FN']}",
        "",
        "## Detection (M+)",
        "",
        f"- TSS: **{mm['TSS']:.3f}**  HSS: **{mm['HSS']:.3f}**  FAR: **{mm['FAR']:.3f}**",
        "",
        f"- Mean onset-to-peak lead (detected): **{lead:.1f} min**",
        "",
        "## Forecast Brier (synthetic labels, reported honestly)",
        "",
        "- Discrete-time logistic hazard trained on the same synthetic cache (not independent GOES-era skill).",
        "- Per-horizon Brier is computed in the dashboard methodology as a prototype diagnostic, not a published score.",
        "",
        "## X6.3 (2024-02-22)",
        "",
    ]
    xday = days["2024-02-22"]
    sxr = np.nan_to_num(xday["solexs"], nan=np.nanmedian(xday["solexs"]))
    hxr = np.nan_to_num(xday["hel1os"], nan=np.nanmedian(xday["hel1os"]))
    nc = run_nowcast(sxr, hxr, cfg)
    x_ev = max(nc.events, key=lambda e: e.peak_flux_sxr, default=None)
    if x_ev:
        if x_ev.index is None:
            from suryakavach.engines.impact import compute_impact, map_severity

            dur = x_ev.duration_min()
            imp = compute_impact(
                x_ev.peak_flux_sxr,
                x_ev.hardness,
                x_ev.impulsivity,
                dur,
                cfg["impact"]["weights"],
                cfg["impact"]["suit_available"],
            )
            sev = map_severity(imp["index"], cfg["severity_bands"])
            x_ev.index = imp["index"]
            x_ev.severity_band = sev["band"]
        peak_i = int((datetime_peak() - xday["t0"]).total_seconds() // 60)
        lines.append(f"- Detected class **{x_ev.class_label}** onset idx {x_ev.onset_idx}, peak idx {x_ev.peak_idx}")
        lines.append(f"- Onset before NOAA-style peak (22:34 / idx {peak_i}): **{x_ev.onset_idx < peak_i}**")
        lines.append(f"- Impact index **{x_ev.index:.2f}** band **{x_ev.severity_band}**")
    else:
        lines.append("- X6.3 not detected — check BOCPD threshold.")
    lines += ["", "Target (PRD): TSS ≥ 0.6 for M+; mean onset lead ≥ 3 min vs fixed threshold.", ""]
    text = "\n".join(lines) + "\n"
    out = Path("reports")
    out.mkdir(exist_ok=True)
    (out / "metrics.md").write_text(text, encoding="utf-8")
    return text


def datetime_peak():
    from datetime import datetime, timezone

    return datetime(2024, 2, 22, 22, 34, tzinfo=timezone.utc)


if __name__ == "__main__":
    print(evaluate())
