from __future__ import annotations

import asyncio
import csv
import io
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from suryakavach.config import load_config
from suryakavach.runtime import runtime

UTC = timezone.utc
cfg = load_config()
_buckets: dict[str, deque] = defaultdict(deque)


class ReplayStart(BaseModel):
    event_date: str = Field(default="2024-02-22")
    speed: float = Field(default=20, ge=1, le=60)


class CursorSet(BaseModel):
    idx: int


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def rate_limit(request: Request) -> None:
    ip = _client_ip(request)
    now = time.time()
    q = _buckets[ip]
    lim = int(cfg["rate_limit"]["requests_per_minute"])
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= lim:
        raise RateLimited()
    q.append(now)


class RateLimited(Exception):
    pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    runtime.loop = asyncio.get_event_loop()
    task = asyncio.create_task(_sim_loop())
    yield
    task.cancel()


app = FastAPI(
    title="SURYAKAVACH API",
    version="1.0.0",
    description="Indigenous solar-flare nowcast / forecast / impact prototype (SIH26209).",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(cfg["cors_origins"]),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.exception_handler(RateLimited)
async def _rl(_req, _exc):
    return JSONResponse({"data": None, "meta": {"error": "rate_limited"}}, status_code=429)


@app.exception_handler(ValueError)
async def _ve(_req, exc: ValueError):
    return JSONResponse({"data": None, "meta": {"error": str(exc)}}, status_code=400)


@app.middleware("http")
async def _limit(request: Request, call_next):
    if request.url.path.startswith("/api/") and request.method != "OPTIONS":
        try:
            rate_limit(request)
        except RateLimited:
            return JSONResponse({"data": None, "meta": {"error": "rate_limited"}}, status_code=429)
    return await call_next(request)


async def _sim_loop():
    while True:
        # speed N => N data-minutes per real minute → sleep 60/N seconds
        sp = max(runtime.speed, 1.0)
        await asyncio.sleep(60.0 / sp)
        if not runtime.playing:
            continue
        payload = runtime.tick()
        await _broadcast(payload)


async def _broadcast(payload: dict) -> None:
    dead = []
    for q in list(runtime.ws_clients):
        try:
            q.put_nowait(payload)
        except Exception:
            dead.append(q)
    for q in dead:
        runtime.ws_clients.discard(q)


@app.get("/api/health")
def health():
    return runtime.envelope(runtime.health())


@app.get("/api/streams/latest")
def streams(window: int = Query(120, ge=10, le=1440)):
    return runtime.envelope(runtime.streams_latest(window))


@app.get("/api/nowcast/state")
def nowcast():
    return runtime.envelope(runtime.nowcast_state())


@app.get("/api/flare/catalogue")
def catalogue(
    frm: str | None = Query(None, alias="from"),
    to: str | None = None,
    min_class: str = "A",
    page: int = 1,
    page_size: int = 25,
    method: str | None = None,
    format: str | None = None,
):
    data = runtime.catalogue(frm, to, min_class, page, page_size, method)
    if format == "json":
        return runtime.envelope(data)
    if format == "csv":
        buf = io.StringIO()
        cols = [
            "id",
            "onset",
            "peak",
            "end",
            "class",
            "peak_flux_sxr",
            "peak_flux_hxr",
            "hardness",
            "impulsivity",
            "integrated_flux",
            "impact_index",
            "severity_band",
            "r_level",
            "detection_method",
        ]
        w = csv.DictWriter(buf, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        for row in data["items"]:
            w.writerow(row)
        return StreamingResponse(
            iter([buf.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=suryakavach-catalogue.csv"},
        )
    return runtime.envelope(data)


@app.get("/api/flare/{fid}")
def flare(fid: str):
    rec = runtime.flare_detail(fid)
    if not rec:
        return JSONResponse(runtime.envelope(None) | {"meta": {"error": "not_found"}}, status_code=404)
    return runtime.envelope(rec)


@app.get("/api/forecast/horizons")
def forecast():
    return runtime.envelope(runtime.forecast_horizons())


@app.get("/api/impact/current")
def impact():
    return runtime.envelope(runtime.impact_current())


@app.get("/api/alerts")
def alerts(since: str | None = None):
    return runtime.envelope(runtime.alerts(since))


@app.get("/api/replay/dates")
def dates():
    return runtime.envelope({"dates": runtime.available_dates()})


@app.post("/api/replay/start")
def replay_start(body: ReplayStart):
    return runtime.envelope(runtime.start_replay(body.event_date, body.speed))


@app.post("/api/replay/stop")
def replay_stop():
    return runtime.envelope(runtime.stop_replay())


@app.post("/api/replay/cursor")
def replay_cursor(body: CursorSet):
    runtime.set_cursor(body.idx)
    return runtime.envelope({"cursor_idx": runtime.cursor})


@app.post("/api/replay/pause")
def replay_pause():
    runtime.playing = False
    return runtime.envelope({"playing": False})


@app.post("/api/replay/resume")
def replay_resume():
    runtime.playing = True
    return runtime.envelope({"playing": True})


@app.websocket("/ws/live")
async def ws_live(ws: WebSocket):
    await ws.accept()
    q: asyncio.Queue = asyncio.Queue(maxsize=8)
    runtime.ws_clients.add(q)
    try:
        await ws.send_json(runtime.live_snapshot())
        while True:
            try:
                payload = await asyncio.wait_for(q.get(), timeout=30.0)
                await ws.send_json(payload)
            except asyncio.TimeoutError:
                await ws.send_json({"heartbeat": True, "ts": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")})
    except WebSocketDisconnect:
        pass
    finally:
        runtime.ws_clients.discard(q)
