from __future__ import annotations

import os
import re
import sqlite3
import threading
from pathlib import Path
from typing import Any

SCHEMA = """
CREATE TABLE IF NOT EXISTS raw_files (
  filename TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  date TEXT NOT NULL,
  sha256 TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS flares (
  id TEXT PRIMARY KEY,
  onset TEXT NOT NULL,
  peak TEXT NOT NULL,
  end TEXT,
  class TEXT NOT NULL,
  peak_flux_sxr REAL NOT NULL,
  peak_flux_hxr REAL NOT NULL,
  hardness REAL NOT NULL,
  impulsivity REAL NOT NULL,
  integrated_flux REAL NOT NULL,
  impact_index REAL,
  severity_band TEXT,
  r_level TEXT,
  detection_method TEXT NOT NULL,
  onset_idx INTEGER NOT NULL,
  peak_idx INTEGER NOT NULL,
  end_idx INTEGER,
  posterior REAL
);
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  flare_id TEXT,
  message TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS replay_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_date TEXT NOT NULL,
  speed REAL NOT NULL,
  status TEXT NOT NULL,
  cursor TEXT
);
CREATE INDEX IF NOT EXISTS idx_flares_onset ON flares (onset);
CREATE INDEX IF NOT EXISTS idx_flares_method ON flares (detection_method);
CREATE INDEX IF NOT EXISTS idx_alerts_ts ON alerts (ts);
"""

# PostgREST returns at most 1000 rows unless a range is requested. The synthetic
# catalogue is ~115 rows; this ceiling keeps headroom without unbounded reads.
_CATALOGUE_MAX_ROWS = 5000


class _LockedConnection:
    """Serialises access to a single sqlite connection.

    ``check_same_thread=False`` lets the connection be shared between the
    asyncio sim-loop thread and FastAPI's request threadpool, but sqlite3
    connections are not safe for concurrent use: interleaved statements raise
    "cannot start a transaction within a transaction" / "bad parameter or other
    API misuse". Every call is wrapped in one re-entrant lock so a statement and
    its commit stay atomic with respect to other threads.
    """

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn
        self._lock = threading.RLock()

    def execute(self, sql: str, params: tuple | list | None = None):
        with self._lock:
            cur = self._conn.execute(sql, params or ())
            # Materialise rows inside the lock so callers cannot interleave
            # fetches with another thread's writes on the same cursor.
            rows = cur.fetchall() if cur.description is not None else []
            return _Result(rows, cur.lastrowid, cur.rowcount)

    def executemany(self, sql: str, seq_of_params) -> None:
        with self._lock:
            self._conn.executemany(sql, seq_of_params)

    def executescript(self, script: str) -> None:
        with self._lock:
            self._conn.executescript(script)

    def commit(self) -> None:
        with self._lock:
            self._conn.commit()

    def close(self) -> None:
        with self._lock:
            self._conn.close()

    @property
    def lock(self) -> threading.RLock:
        return self._lock


class _Result:
    """Cursor-shaped view over already-fetched rows."""

    def __init__(self, rows: list, lastrowid: int | None, rowcount: int) -> None:
        self._rows = rows
        self.lastrowid = lastrowid
        self.rowcount = rowcount

    def fetchone(self):
        return self._rows[0] if self._rows else None

    def fetchall(self) -> list:
        return self._rows


def _sqlite_connect(path: Path) -> _LockedConnection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return _LockedConnection(conn)


# ---- Supabase shim ----

class _SupaCursor:
    def __init__(self, rows: list[dict]) -> None:
        self._rows = rows
        self.rowcount = len(rows)

    @property
    def lastrowid(self) -> int | None:
        if self._rows and "id" in self._rows[0]:
            return int(self._rows[0]["id"])
        return None

    def fetchone(self) -> dict | None:
        return self._rows[0] if self._rows else None

    def fetchall(self) -> list[dict]:
        return self._rows


# Patterns for the exact SQL queries runtime.py emits
_RE_FLARES_DELETE = re.compile(r"^\s*DELETE\s+FROM\s+flares\s*$", re.I)
_RE_FLARES_UPSERT = re.compile(
    r"^\s*INSERT\s+OR\s+REPLACE\s+INTO\s+flares\s*\(([^)]+)\)\s+VALUES\s*\(([^)]+)\)", re.I
)
_RE_FLARE_SELECT = re.compile(
    r"^\s*SELECT\s+\*\s+FROM\s+flares\s+WHERE\s+id\s*=\s*\?", re.I
)
_RE_CATALOGUE_SELECT = re.compile(
    r"^\s*SELECT\s+\*\s+FROM\s+flares\s+WHERE\s+1=1", re.I
)
_RE_ALERTS_SELECT = re.compile(
    r"^\s*SELECT\s+\*\s+FROM\s+alerts(\s+WHERE\s+ts\s*>=\s*\?)?\s+ORDER\s+BY\s+id\s+DESC\s+LIMIT\s+100", re.I
)
_RE_ALERT_INSERT = re.compile(
    r"^\s*INSERT\s+INTO\s+alerts\s*\(([^)]+)\)\s+VALUES\s*\(([^)]+)\)", re.I
)
_RE_REPLAY_INSERT = re.compile(
    r"^\s*INSERT\s+INTO\s+replay_sessions\s*\(([^)]+)\)\s+VALUES\s*\(([^)]+)\)", re.I
)
_RE_REPLAY_UPDATE = re.compile(
    r"^\s*UPDATE\s+replay_sessions\s+SET\s+status\s*=\s*\?,\s*cursor\s*=\s*\?\s+WHERE\s+id\s*=\s*\?", re.I
)


class _SupaWrapper:
    """Minimal shim: runtime.py issues a small fixed set of SQL queries; each
    is matched against a known pattern and forwarded to Supabase REST."""

    def __init__(self) -> None:
        from suryakavach.supabase_db import get_supabase
        self._sb = get_supabase()
        self._lock = threading.RLock()
        # When set, flare upserts accumulate here instead of firing one REST
        # request each. See flush_flares().
        self._flare_batch: list[dict] | None = None

    @property
    def lock(self) -> threading.RLock:
        return self._lock

    def batch_flares(self) -> None:
        """Buffer subsequent flare upserts until flush_flares() is called."""
        self._flare_batch = []

    def flush_flares(self) -> None:
        """Send any buffered flare rows as chunked bulk upserts."""
        rows, self._flare_batch = self._flare_batch, None
        if not rows:
            return
        with self._lock:
            for i in range(0, len(rows), 200):
                self._sb.table("flares").upsert(rows[i : i + 200]).execute()

    def execute(self, sql: str, params: tuple | list | None = None) -> _SupaCursor:
        with self._lock:
            return self._execute(sql, params)

    def _execute(self, sql: str, params: tuple | list | None = None) -> _SupaCursor:
        params = params or ()
        s = sql.strip()

        if _RE_FLARES_DELETE.match(s):
            res = self._sb.table("flares").delete().neq("id", "nonexistent").execute()
            return _SupaCursor(res.data if res.data else [])

        if _RE_FLARES_UPSERT.match(s):
            return self._upsert_flares(s, params)

        if _RE_FLARE_SELECT.match(s):
            # limit(1) rather than single(): single() raises on 0 rows, but an
            # unknown flare id must return "no rows" so the API can answer 404.
            res = self._sb.table("flares").select("*").eq("id", params[0]).limit(1).execute()
            return _SupaCursor(list(res.data) if res.data else [])

        if _RE_CATALOGUE_SELECT.match(s):
            return self._catalogue(s, params)

        if _RE_ALERTS_SELECT.match(s):
            q = self._sb.table("alerts").select("*").order("id", desc=True).limit(100)
            if params:
                q = q.gte("ts", params[0])
            res = q.execute()
            return _SupaCursor(res.data if res.data else [])

        if _RE_ALERT_INSERT.match(s):
            cols = _split_cols(_RE_ALERT_INSERT.match(s).group(1))
            data = dict(zip(cols, params))
            res = self._sb.table("alerts").insert(data).execute()
            return _SupaCursor(res.data if res.data else [data])

        if _RE_REPLAY_INSERT.match(s):
            cols = _split_cols(_RE_REPLAY_INSERT.match(s).group(1))
            data = dict(zip(cols, params))
            res = self._sb.table("replay_sessions").insert(data).execute()
            return _SupaCursor(res.data if res.data else [data])

        if _RE_REPLAY_UPDATE.match(s):
            res = (
                self._sb.table("replay_sessions")
                .update({"status": params[0], "cursor": params[1]})
                .eq("id", params[2])
                .execute()
            )
            return _SupaCursor(res.data if res.data else [])

        raise ValueError(f"Unsupported SQL for Supabase shim: {s}")

    def executemany(self, sql: str, seq_of_params) -> None:
        with self._lock:
            for p in seq_of_params:
                self._execute(sql, p)

    def executescript(self, script: str) -> None:
        pass  # tables must exist in Supabase already

    def commit(self) -> None:
        pass  # REST is autocommit

    # -- query-specific handlers ----

    def _upsert_flares(self, sql: str, params) -> _SupaCursor:
        m = _RE_FLARES_UPSERT.match(sql)
        cols = _split_cols(m.group(1))
        data = dict(zip(cols, params))
        if self._flare_batch is not None:
            self._flare_batch.append(data)
            return _SupaCursor([data])
        res = self._sb.table("flares").upsert(data).execute()
        return _SupaCursor(res.data if res.data else [data])

    def _catalogue(self, sql: str, params) -> _SupaCursor:
        q = self._sb.table("flares").select("*")
        idx = 0
        s = sql.upper()
        if "ONSET >=" in s:
            q = q.gte("onset", params[idx]); idx += 1
        if "ONSET <=" in s:
            q = q.lte("onset", params[idx]); idx += 1
        if "DETECTION_METHOD" in s:
            q = q.eq("detection_method", params[idx]); idx += 1
        q = q.order("onset", desc=True)
        # PostgREST caps unbounded selects at its default page size (1000);
        # ask explicitly so the catalogue total is not silently truncated.
        q = q.limit(_CATALOGUE_MAX_ROWS)
        res = q.execute()
        return _SupaCursor(list(res.data) if res.data else [])


def _split_cols(s: str) -> list[str]:
    return [c.strip() for c in s.split(",")]


def connect(path: Path) -> "_SupaWrapper | _LockedConnection":
    """Return a Supabase-backed connection when USE_SUPABASE=1,
    otherwise fall back to local SQLite."""
    if os.environ.get("USE_SUPABASE", "0") == "1":
        return _SupaWrapper()
    return _sqlite_connect(path)
