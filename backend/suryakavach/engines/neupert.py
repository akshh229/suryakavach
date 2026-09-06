from __future__ import annotations

import numpy as np
from numpy.typing import NDArray


def neupert_correlation(
    sxr: NDArray[np.float64],
    hxr: NDArray[np.float64],
    window: int = 20,
) -> float:
    if len(sxr) < 4:
        return 0.0
    w = min(window, len(sxr) - 1)
    dsxr = np.diff(sxr[-(w + 1) :])
    cum_hxr = np.cumsum(hxr[-w:])
    if dsxr.size != cum_hxr.size:
        n = min(dsxr.size, cum_hxr.size)
        dsxr = dsxr[-n:]
        cum_hxr = cum_hxr[-n:]
    if dsxr.std() < 1e-20 or cum_hxr.std() < 1e-20:
        return 0.0
    return float(np.corrcoef(dsxr, cum_hxr)[0, 1])
