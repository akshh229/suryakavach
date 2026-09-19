from __future__ import annotations

"""PRADAN near-live poller for Suryakavach.

Design contract (from the operator's bulk-download script):

* **Never touch downloaded data.** The poller only *reads* the inbox dir to
  build a manifest; it never deletes / truncates / overwrites a completed
  file. Re-running for the same file list is a no-op (skip-if-exists).
* **Diff-only, additive.** A persisted manifest (``_manifest.json``) records
  every file ever seen. Each pass computes
  ``new = current_listing - seen`` and ingests *only* ``new``. Old entries
  are never removed from the manifest, so a restart cannot re-emit or drop
  history.
* **5-second trigger is local-only.** Hitting the PRADAN/ISSDC download
  endpoints every 5 s will trip the session / rate limits warned about in the
  bulk script. So the background watcher polls the *local inbox directory*
  (cheap ``os.scandir``) every ``interval`` seconds (default 5). Network
  fetches against PRADAN happen only on an explicit
  ``POST /api/pradan/poll`` with a ``file_paths`` body — i.e. the same list
  the browser session script produces — and even then only unseen files are
  fetched, with resume (``.part`` + ``Range``) and skip-if-complete.

Inbox layout (populated by the operator's bulk script, untouched by us)::

    <data cache>/pradan_inbox/<host>/<relative/path>.fits[.part]

Any ``*.part`` file is treated as in-progress and ignored by the diff until
it is atomically renamed to its final name by the downloader.
"""

import json
import os
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlparse

UTC = timezone.utc

MANIFEST_NAME = "_manifest.json"
DEFAULT_INTERVAL = 5.0
CHUNK_SIZE = 8 * 1024 * 1024
MAX_RETRIES = 5
RETRY_WAIT_SECONDS = 30

DEFAULT_URL_PREFIX = "https://pradan1.issdc.gov.in"

# The operator's file list (from the browser-session bulk script). Lives here
# so callers never re-paste URLs; used only when explicitly requested
# (``fetch_defaults=True``), never by the background 5 s local-diff loop.
DEFAULT_FILE_PATHS = [
    "/al1/protected/downloadData/solexs/level1/2026/09/N00_0000/AL1_SLX_L1_20260917_v1.0.zip?all",
    "/al1/protected/downloadData/suit/level1/2026/09/T26_1458/SUT_T26_1458_002510_Lev1.0_2026-09-18T23.27.01.552_0973NB05.fits?all",
    "/al1/protected/downloadData/suit/level1/2026/09/T26_1458/SUT_T26_1458_002510_Lev1.0_2026-09-18T23.06.28.859_0973NB01.fits?all",
    "/al1/protected/downloadData/suit/level1/2026/09/T26_1458/SUT_T26_1458_002510_Lev1.0_2026-09-18T23.27.34.910_0973NB01.fits?all",
    "/al1/protected/downloadData/suit/level1/2026/09/T26_1458/SUT_T26_1458_002510_Lev1.0_2026-09-18T23.22.37.950_0973NB06.fits?all",
    "/al1/protected/downloadData/suit/level1/2026/09/T26_1458/SUT_T26_1458_002510_Lev1.0_2026-09-18T23.27.53.600_0972NB03.fits?all",
    "/al1/protected/downloadData/suit/level1/2026/09/T26_1458/SUT_T26_1458_002510_Lev1.0_2026-09-18T23.18.12.555_0973NB07.fits?all",
    "/al1/protected/downloadData/suit/level1/2026/09/T26_1458/SUT_T26_1458_002510_Lev1.0_2026-09-18T23.02.07.291_0973BB02.fits?all",
    "/al1/protected/downloadData/suit/level1/2026/09/T26_1458/SUT_T26_1458_002510_Lev1.0_2026-09-18T23.07.25.934_0973NB05.fits?all",
    "/al1/protected/downloadData/suit/level1/2026/09/T26_1458/SUT_T26_1458_002510_Lev1.0_2026-09-18T23.13.19.807_0973NB02.fits?all",
]


def _default_inbox() -> Path:
    from suryakavach.config import data_dir, load_config

    try:
        return data_dir(load_config()) / "pradan_inbox"
    except Exception:
        return Path("./data/pradan_inbox")


def _manifest_path(inbox: Path) -> Path:
    return Path(inbox) / MANIFEST_NAME


def load_manifest(inbox: str | os.PathLike | None = None) -> dict[str, dict]:
    """Return the persisted seen-map ``{rel_path: {size, mtime}}``.

    Missing / corrupt manifests return ``{}`` so a poll degrades to
    "everything on disk is new" exactly once, then persists.
    """
    box = Path(inbox) if inbox else _default_inbox()
    pf = _manifest_path(box)
    if not pf.is_file():
        return {}
    try:
        raw = json.loads(pf.read_text(encoding="utf-8"))
        return raw.get("seen", {}) if isinstance(raw, dict) else {}
    except (OSError, ValueError):
        return {}


def load_stats(inbox: str | os.PathLike | None = None) -> dict[str, int]:
    """Cumulative counters persisted alongside the manifest.

    Missing / corrupt manifests return zeros. Keys: ``polls`` (total
    ``poll_once`` passes) and ``total_new`` (new files across all passes).
    """
    box = Path(inbox) if inbox else _default_inbox()
    pf = _manifest_path(box)
    if not pf.is_file():
        return {"polls": 0, "total_new": 0}
    try:
        raw = json.loads(pf.read_text(encoding="utf-8"))
        stats = raw.get("stats", {}) if isinstance(raw, dict) else {}
        return {"polls": int(stats.get("polls", 0)), "total_new": int(stats.get("total_new", 0))}
    except (OSError, ValueError):
        return {"polls": 0, "total_new": 0}


def save_manifest(
    seen: dict[str, dict],
    inbox: str | os.PathLike | None = None,
    stats: dict[str, int] | None = None,
) -> Path:
    box = Path(inbox) if inbox else _default_inbox()
    box.mkdir(parents=True, exist_ok=True)
    pf = _manifest_path(box)
    payload = {"seen": seen, "stats": stats or load_stats(box), "updated_at": _now()}
    tmp = pf.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
    tmp.replace(pf)  # atomic on POSIX + Windows; readers never see half a manifest
    return pf


def scan_inbox(inbox: str | os.PathLike | None = None) -> dict[str, dict]:
    """List *completed* files under the inbox (read-only; ignores ``*.part``).

    Returns ``{rel_posix_path: {"size": int, "mtime": float}}``. Never raises
    for a missing dir — returns ``{}`` so the first poll simply reports empty.
    """
    box = Path(inbox) if inbox else _default_inbox()
    out: dict[str, dict] = {}
    if not box.is_dir():
        return out
    for p in sorted(box.rglob("*")):
        if not p.is_file() or p.suffix == ".part" or p.name == MANIFEST_NAME:
            continue
        try:
            st = p.stat()
        except OSError:
            continue
        rel = p.relative_to(box).as_posix()
        out[rel] = {"size": st.st_size, "mtime": st.st_mtime}
    return out


def diff_manifest(seen: dict[str, dict], current: dict[str, dict]) -> list[str]:
    """Additive diff: keys in ``current`` never before in ``seen``.

    A file that grew in place (same rel path, larger size — i.e. a resumed
    download that just completed) is *not* reported as new; it was already
    seen. Only genuinely unseen relative paths are returned, sorted for
    deterministic API output. ``seen`` is never mutated here.
    """
    return sorted(k for k in current if k not in seen)


def _mb(nbytes: int) -> float:
    return round(nbytes / (1024 * 1024), 3)


def build_analytics(
    seen: dict[str, dict], current: dict[str, dict], new_files: list[str]
) -> dict[str, Any]:
    """Per-request old-vs-new analytics (pure function, no I/O).

    * ``old_*``   — files already in the manifest and still on disk untouchd.
    * ``new_*``   — files in this pass that were never seen before.
    * ``missing`` — manifest entries no longer on disk (informational only;
      the manifest is append-only, so this is normally 0 and never triggers
      a re-fetch or a delete).
    """
    new_set = set(new_files)
    old_rels = [k for k in current if k not in new_set]
    old_bytes = sum(int(current[k].get("size", 0)) for k in old_rels)
    new_bytes = sum(int(current[k].get("size", 0)) for k in new_files)
    total_bytes = old_bytes + new_bytes
    return {
        "old_count": len(old_rels),
        "old_bytes": old_bytes,
        "old_mb": _mb(old_bytes),
        "new_count": len(new_files),
        "new_files": list(new_files),
        "new_bytes": new_bytes,
        "new_mb": _mb(new_bytes),
        "total_count": len(current),
        "total_bytes": total_bytes,
        "total_mb": _mb(total_bytes),
        "missing_count": sum(1 for k in seen if k not in current),
    }


def poll_once(inbox: str | os.PathLike | None = None) -> dict[str, Any]:
    """One local diff pass: scan, diff vs manifest, persist, report.

    Side effects: appends new keys to the persisted manifest and bumps the
    cumulative counters only. No data file is created, modified, or deleted.
    Every return value carries per-request old-vs-new analytics plus
    all-time totals.
    """
    box = Path(inbox) if inbox else _default_inbox()
    seen = load_manifest(box)
    stats = load_stats(box)
    current = scan_inbox(box)
    new_files = diff_manifest(seen, current)
    analytics = build_analytics(seen, current, new_files)
    stats = {"polls": stats["polls"] + 1, "total_new": stats["total_new"] + len(new_files)}
    if new_files:
        for rel in new_files:
            seen[rel] = current[rel]
    save_manifest(seen, box, stats)
    return {
        "inbox": str(box),
        "seen_count": len(seen),
        "scanned": len(current),
        "polled_at": _now(),
        "polls": stats["polls"],
        "total_new_all_time": stats["total_new"],
        **analytics,
    }


def _now() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


BROWSE_URL = DEFAULT_URL_PREFIX + "/al1/protected/browse.xhtml?id=all"


def fetch_browse_listing(cookie: str | None = None, timeout: float = 60.0) -> dict[str, Any]:
    """Fetch PRADAN's browse table for the latest files (single GET, no POST).

    The ``browse.xhtml?id=all`` page server-renders the first page of the
    lazy file table, so one authenticated GET is enough — no fragile JSF
    partial-AJAX replay needed. Every ``*.fits`` / ``*.zip`` filename on the
    page plus any ``/al1/protected/downloadData/...`` href is extracted.

    Returns ``{"files": [...], "hrefs": [...], "bytes": n}``. ``files`` are
    download-ready paths (``/al1/...?all``) when the full href is present,
    otherwise bare filenames. Raises ``RuntimeError`` when the session is
    dead (login page) or the table is empty.
    """
    import re
    from urllib.error import HTTPError, URLError
    from urllib.request import Request, urlopen

    jar = cookie if cookie is not None else _cookie_from_env()
    if not jar:
        raise RuntimeError("PRADAN_COOKIE is not set; cannot query the browse table.")
    req = Request(
        BROWSE_URL,
        headers={"Cookie": jar, "Referer": DEFAULT_URL_PREFIX + "/al1/protected/payload.xhtml"},
        method="GET",
    )
    try:
        with urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
    except (HTTPError, URLError, TimeoutError, OSError) as exc:
        raise RuntimeError(f"browse table fetch failed: {exc}") from exc
    text = raw.decode("utf-8", errors="replace")
    if "Sign in to" in text:
        raise RuntimeError("PRADAN session expired (browse page returned the login screen).")

    hrefs = sorted(set(re.findall(r"/al1/protected/downloadData/[^\"'\\s<>]+", text)))
    bare = sorted(set(re.findall(r"[A-Za-z0-9_.\-]+\.(?:fits|zip)", text)))
    href_files = {h.split("?")[0].split("/")[-1] for h in hrefs}
    files = sorted(h if "?" in h else h + "?all" for h in hrefs)
    files += sorted(f for f in bare if f not in href_files)
    if not files:
        raise RuntimeError("browse table returned no files (empty table or layout changed).")
    return {"files": files, "hrefs": hrefs, "bytes": len(raw)}


def discover_latest(
    inbox: str | os.PathLike | None = None, cookie: str | None = None
) -> dict[str, Any]:
    """Fetch the live browse listing and diff it against the manifest.

    Additive only: reports ``new_files`` (listed but never seen) vs
    ``old_count`` (listed and already seen). Nothing is downloaded and the
    manifest is left untouched — call ``poll_once`` / ``download_new_files``
    to act on the result.
    """
    box = Path(inbox) if inbox else _default_inbox()
    listing = fetch_browse_listing(cookie=cookie)
    seen = load_manifest(box)
    current = scan_inbox(box)
    listed_ids = {f.split("?")[0].lstrip("/") for f in listing["files"]}
    # Manifest keys are full inbox rel paths (host + downloadData dirs) while
    # the browse table yields bare filenames — match on basename so an
    # already-downloaded file is correctly reported as old, not new.
    seen_base = {s.split("/")[-1] for s in seen}
    new_files = sorted(f for f in listed_ids if f.split("/")[-1] not in seen_base)
    old = sorted(f for f in listed_ids if f.split("/")[-1] in seen_base)
    analytics = build_analytics(seen, current, [f for f in new_files if f in current])
    return {
        "listed": len(listing["files"]),
        "files": listing["files"],
        "new_count": len(new_files),
        "new_files": new_files,
        "old_count": len(old),
        "on_disk": analytics,
        "polled_at": _now(),
    }


def _load_dotenv() -> None:
    """Load ``PRADAN_COOKIE`` (and friends) from a gitignored ``.env`` file.

    Stdlib-only, no ``python-dotenv`` dependency. Looks for ``backend/.env``
    then repo-root ``.env``; real environment variables always win (never
    overwritten). Called once at import so the API picks the cookie up with
    no extra setup.
    """
    if os.environ.get("PRADAN_COOKIE"):
        return
    here = Path(__file__).resolve()
    for candidate in (here.parents[2] / ".env", here.parents[3] / ".env"):
        try:
            text = candidate.read_text(encoding="utf-8")
        except OSError:
            continue
        for line in text.splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            if key != "PRADAN_COOKIE" or os.environ.get(key):
                continue
            val = val.strip().strip('"').strip("'")
            if val:
                os.environ[key] = val
        if os.environ.get("PRADAN_COOKIE"):
            return


_load_dotenv()


def _cookie_from_env() -> str:
    # Never hardcode the browser session cookie: it expires and it is a
    # credential. It lives in the gitignored backend/.env (written from the
    # operator's logged-in browser session) or directly in the environment.
    if not os.environ.get("PRADAN_COOKIE"):
        _load_dotenv()
    return os.environ.get("PRADAN_COOKIE", "").strip()


def download_new_files(
    file_paths: list[str],
    url_prefix: str = "https://pradan1.issdc.gov.in",
    dest_root: str | os.PathLike | None = None,
    cookie: str | None = None,
    max_retries: int = MAX_RETRIES,
) -> dict[str, Any]:
    """Fetch only unseen PRADAN files; skip completed, resume ``.part`` files.

    Mirrors the operator's bulk script (Range resume, atomic rename, retry)
    but diffs ``file_paths`` against the on-disk state first so old files are
    never re-downloaded. Raises ``RuntimeError`` when no cookie is available
    instead of sending an unauthenticated request that PRADAN would reject.

    Uses only the standard library (``urllib``) — no new pip dependency.
    """
    from urllib.error import HTTPError, URLError
    from urllib.request import Request, urlopen

    jar = cookie if cookie is not None else _cookie_from_env()
    if not jar:
        raise RuntimeError(
            "PRADAN_COOKIE is not set; log in via the browser and export the "
            "fresh session cookie before triggering a network fetch."
        )
    root = Path(dest_root) if dest_root else _default_inbox()
    host = urlparse(url_prefix).netloc

    downloaded: list[str] = []
    skipped: list[str] = []
    for fp in file_paths:
        clean = fp.split("?")[0]
        rel = clean.lstrip("/")
        final = root / host / rel
        part = Path(str(final) + ".part")
        if final.exists():
            skipped.append(rel)  # never touch completed data
            continue
        final.parent.mkdir(parents=True, exist_ok=True)
        resume_from = part.stat().st_size if part.exists() else 0
        ok = False
        for attempt in range(1, max_retries + 1):
            try:
                req_h = {"Cookie": jar}
                if resume_from > 0:
                    req_h["Range"] = f"bytes={resume_from}-"
                req = Request(url_prefix + fp, headers=req_h, method="GET")
                with urlopen(req, timeout=600) as resp:
                    status = getattr(resp, "status", 200)
                    if status not in (200, 206):
                        raise RuntimeError(f"HTTP {status}")
                    mode = "ab" if resume_from > 0 else "wb"
                    with open(part, mode) as fh:
                        while True:
                            chunk = resp.read(CHUNK_SIZE)
                            if not chunk:
                                break
                            fh.write(chunk)
                part.rename(final)  # atomic completion; diff picks it up next pass
                downloaded.append(rel)
                ok = True
                break
            except (HTTPError, URLError, TimeoutError, OSError) as exc:
                if attempt >= max_retries:
                    raise RuntimeError(f"failed to fetch {rel}: {exc}") from exc
                time.sleep(RETRY_WAIT_SECONDS)
        if not ok:
            raise RuntimeError(f"failed to fetch {rel}")
    dl_bytes = 0
    for rel in downloaded:
        try:
            dl_bytes += (root / host / rel).stat().st_size
        except OSError:
            continue
    return {
        "downloaded": downloaded,
        "downloaded_count": len(downloaded),
        "downloaded_mb": _mb(dl_bytes),
        "skipped": skipped,
        "skipped_count": len(skipped),  # old data left untouched
        "dest_root": str(root),
    }


class PradanWatcher:
    """In-process 5-second local-diff loop (no network).

    ``POST /api/pradan/watch/start`` creates one; ``stop`` joins it. The loop
    calls :func:`poll_once` (read-only scan + manifest append) and forwards
    any new files to ``on_new`` (default: no-op). At most one thread ever
    runs per instance; ``start`` is idempotent.
    """

    def __init__(
        self,
        inbox: str | os.PathLike | None = None,
        interval: float = DEFAULT_INTERVAL,
        on_new: Callable[[list[str]], None] | None = None,
    ) -> None:
        self.inbox = str(Path(inbox) if inbox else _default_inbox())
        self.interval = max(1.0, float(interval))
        self.on_new = on_new or (lambda _files: None)
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._lock = threading.RLock()
        self.last_result: dict[str, Any] = {"watching": False}
        self.last_new: list[str] = []

    def start(self, interval: float | None = None) -> dict[str, Any]:
        with self._lock:
            if interval is not None:
                self.interval = max(1.0, float(interval))
            if self._thread and self._thread.is_alive():
                return self.state()
            self._stop.clear()
            self._thread = threading.Thread(target=self._loop, daemon=True)
            self._thread.start()
            return self.state()

    def stop(self) -> dict[str, Any]:
        with self._lock:
            self._stop.set()
            th, self._thread = self._thread, None
        if th and th.is_alive():
            th.join(timeout=5.0)
        self.last_result = {**self.last_result, "watching": False}
        return self.state()

    def state(self) -> dict[str, Any]:
        with self._lock:
            watching = bool(self._thread and self._thread.is_alive())
        return {
            "watching": watching,
            "inbox": self.inbox,
            "interval": self.interval,
            "seen_count": len(load_manifest(self.inbox)),
            "last_new": list(self.last_new),
            "last_poll": self.last_result.get("polled_at"),
        }

    def _loop(self) -> None:
        while not self._stop.wait(self.interval):
            try:
                res = poll_once(self.inbox)
            except Exception:
                continue  # a failed scan must never kill the watcher
            with self._lock:
                self.last_result = {**res, "watching": True}
                self.last_new = res["new_files"]
            if res["new_files"]:
                try:
                    self.on_new(res["new_files"])
                except Exception:
                    pass


# Process-wide singleton owned by the API layer; routes below use it so all
# workers share one manifest and at most one watcher thread.
watcher = PradanWatcher()


def resolve_download_paths(listed_files: list[str]) -> tuple[list[str], list[str]]:
    """Map listing entries to downloadable ``/al1/...?all`` paths.

    The browse table yields bare filenames; full paths come from the built-in
    ``DEFAULT_FILE_PATHS`` (matched by basename) or from hrefs already
    present in the listing. Returns ``(resolvable, listing_only)`` — the
    latter are reported but never fetched, because their URL is unknown.
    """
    by_base = {p.split("?")[0].split("/")[-1]: p for p in DEFAULT_FILE_PATHS}
    ok, bare = [], []
    for f in listed_files:
        if f.startswith("/al1/"):
            ok.append(f if "?" in f else f + "?all")
        elif f.split("?")[0] in by_base:
            ok.append(by_base[f.split("?")[0]])
        else:
            bare.append(f)
    return sorted(set(ok)), sorted(set(bare))


def run_scheduled_pass(
    inbox: str | os.PathLike | None = None,
    cookie: str | None = None,
) -> dict[str, Any]:
    """One auto-watch pass: discover → download new (resolvable only) → local diff.

    A failed network step degrades to a local diff rather than failing the
    pass — the next scheduled run retries. Never deletes anything. Staging
    inbox products into the calibrated pipeline (registry/normalized) is a
    separate, explicitly calibrated step owned by the ingestion modules.
    """
    box = Path(inbox) if inbox else _default_inbox()
    try:
        found = discover_latest(box, cookie=cookie)
    except RuntimeError as exc:
        scan = poll_once(box)
        return {**scan, "scheduled": True, "discover_error": str(exc)}
    paths, listing_only = resolve_download_paths(found["new_files"])
    fetched: dict[str, Any] = {
        "downloaded": [], "downloaded_count": 0, "downloaded_mb": 0.0,
        "skipped": [], "skipped_count": 0,
    }
    fetch_error: str | None = None
    if paths:
        try:
            fetched = download_new_files(paths, dest_root=box, cookie=cookie)
        except RuntimeError as exc:
            fetch_error = str(exc)
    scan = poll_once(box)
    out = {**scan, "scheduled": True, "fetched": fetched, "listing_only": listing_only}
    if fetch_error:
        out["fetch_error"] = fetch_error
    return out


class PradanScheduler:
    """Slow in-process auto-watch loop (default every 30 min).

    Unlike the 5 s local watcher, each pass performs exactly one browse GET
    plus fetches for *unseen, resolvable* files only, then records the local
    diff. ``POST /api/pradan/schedule/start`` creates the one thread; ``stop``
    joins it. Failures are recorded in state, never raised.
    """

    def __init__(
        self,
        inbox: str | os.PathLike | None = None,
        interval_min: float = 30.0,
    ) -> None:
        self.inbox = str(Path(inbox) if inbox else _default_inbox())
        self.interval_min = max(1.0, float(interval_min))
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._lock = threading.RLock()
        self.last_result: dict[str, Any] = {"scheduled": False}
        self.last_error: str | None = None

    def start(self, interval_min: float | None = None) -> dict[str, Any]:
        with self._lock:
            if interval_min is not None:
                self.interval_min = max(1.0, float(interval_min))
            if self._thread and self._thread.is_alive():
                return self.state()
            self._stop.clear()
            self._thread = threading.Thread(target=self._loop, daemon=True)
            self._thread.start()
            return self.state()

    def stop(self) -> dict[str, Any]:
        with self._lock:
            self._stop.set()
            th, self._thread = self._thread, None
        if th and th.is_alive():
            th.join(timeout=10.0)
        return self.state()

    def state(self) -> dict[str, Any]:
        with self._lock:
            running = bool(self._thread and self._thread.is_alive())
        return {
            "scheduled": running,
            "inbox": self.inbox,
            "interval_min": self.interval_min,
            "last_error": self.last_error,
            "last_pass": self.last_result.get("polled_at"),
            "last_new": self.last_result.get("new_files", []),
        }

    def run_once(self) -> dict[str, Any]:
        """Execute a single pass synchronously (used by the loop + API)."""
        try:
            res = run_scheduled_pass(self.inbox)
        except Exception as exc:  # never let one pass kill the schedule
            res = {"scheduled": True, "error": f"{type(exc).__name__}: {exc}"}
        with self._lock:
            self.last_result = res
            self.last_error = res.get("discover_error") or res.get("fetch_error") or res.get("error")
        return res

    def _loop(self) -> None:
        while not self._stop.wait(self.interval_min * 60.0):
            self.run_once()


# Second process-wide singleton: at most one auto-watch thread per process.
scheduler = PradanScheduler()
