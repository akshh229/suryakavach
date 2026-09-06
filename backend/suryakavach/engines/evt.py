from __future__ import annotations

from scipy.stats import genpareto


def intensity_quantiles(peak_fluxes: list[float], threshold_q: float = 0.7) -> dict[str, float]:
    x = [p for p in peak_fluxes if p > 0]
    if len(x) < 8:
        if not x:
            return {"q50": 1e-6, "q90": 5e-6, "q99": 2e-5}
        xs = sorted(x)
        def q(p: float) -> float:
            i = min(int(p * (len(xs) - 1)), len(xs) - 1)
            return float(xs[i])
        q50, q90, q99 = q(0.5), q(0.9), q(0.99)
    else:
        arr = np_array(x)
        u = float(np_quantile(arr, threshold_q))
        excess = arr[arr > u] - u
        if excess.size < 4:
            q50 = float(np_quantile(arr, 0.5))
            q90 = float(np_quantile(arr, 0.9))
            q99 = float(np_quantile(arr, 0.99))
        else:
            c, loc, scale = genpareto.fit(excess, floc=0)
            q50 = u + float(genpareto.ppf(0.50, c, loc=loc, scale=scale))
            q90 = u + float(genpareto.ppf(0.90, c, loc=loc, scale=scale))
            q99 = u + float(genpareto.ppf(0.99, c, loc=loc, scale=scale))
    q50, q90, q99 = sorted([max(q50, 1e-9), max(q90, 1e-9), max(q99, 1e-9)])
    return {"q50": q50, "q90": q90, "q99": q99}


def np_array(x):
    import numpy as np

    return np.asarray(x, dtype=float)


def np_quantile(arr, p: float) -> float:
    import numpy as np

    return float(np.quantile(arr, p))
