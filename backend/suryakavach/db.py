from __future__ import annotations

import os
import re
import sqlite3
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
"""


def _sqlite_connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn


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

    def execute(self, sql: str, params: tuple | list | None = None) -> _SupaCursor:
        params = params or ()
        s = sql.strip()

        if _RE_FLARES_DELETE.match(s):
            res = self._sb.table("flares").delete().neq("id", "nonexistent").execute()
            return _SupaCursor(res.data if res.data else [])

        if _RE_FLARES_UPSERT.match(s):
            return self._upsert_flares(s, params)

        if _RE_FLARE_SELECT.match(s):
            res = self._sb.table("flares").select("*").eq("id", params[0]).single().execute()
            return _SupaCursor([res.data] if res.data else [])

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
        for p in seq_of_params:
            self.execute(sql, p)

    def executescript(self, script: str) -> None:
        pass  # tables must exist in Supabase already

    def commit(self) -> None:
        pass  # REST is autocommit

    # -- query-specific handlers ----

    def _upsert_flares(self, sql: str, params) -> _SupaCursor:
        m = _RE_FLARES_UPSERT.match(sql)
        cols = _split_cols(m.group(1))
        data = dict(zip(cols, params))
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
        res = q.execute()
        return _SupaCursor(res.data if res.data else [])


def _split_cols(s: str) -> list[str]:
    return [c.strip() for c in s.split(",")]


def connect(path: Path) -> "_SupaWrapper | sqlite3.Connection":
    """Return a Supabase-backed connection when USE_SUPABASE=1,
    otherwise fall back to local SQLite."""
    if os.environ.get("USE_SUPABASE", "0") == "1":
        return _SupaWrapper()
    return _sqlite_connect(path)
