from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import yaml

_ROOT = Path(__file__).resolve().parents[2]


def load_config() -> dict[str, Any]:
    env = os.environ.get("SURYAKAVACH_CONFIG")
    path = Path(env) if env else _ROOT / "config.yaml"
    if not path.exists():
        path = Path("/app/config.yaml")
    with path.open("r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    data_env = os.environ.get("SURYAKAVACH_DATA")
    if data_env:
        cfg.setdefault("data", {})["cache_path"] = data_env
    return cfg


def data_dir(cfg: dict[str, Any] | None = None) -> Path:
    cfg = cfg or load_config()
    p = Path(cfg["data"]["cache_path"])
    p.mkdir(parents=True, exist_ok=True)
    return p
