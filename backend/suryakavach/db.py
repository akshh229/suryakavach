from __future__ import annotations

import sqlite3
from pathlib import Path

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


def connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn
