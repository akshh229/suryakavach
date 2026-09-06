from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from suryakavach.api import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    json_data = response.json()
    assert "data" in json_data
    assert json_data["data"]["status"] == "ok"
    assert "engines" in json_data["data"]


def test_streams_latest():
    response = client.get("/api/streams/latest?window=60")
    assert response.status_code == 200
    json_data = response.json()
    assert "solexs" in json_data["data"]
    assert "hel1os" in json_data["data"]


def test_nowcast_state():
    response = client.get("/api/nowcast/state")
    assert response.status_code == 200
    json_data = response.json()
    assert "state" in json_data["data"]
    assert "active" in json_data["data"]


def test_catalogue_endpoints():
    # JSON
    res_json = client.get("/api/flare/catalogue?format=json")
    assert res_json.status_code == 200
    jdata = res_json.json()
    assert "items" in jdata["data"]
    assert len(jdata["data"]["items"]) > 0

    first_id = jdata["data"]["items"][0]["id"]

    # CSV
    res_csv = client.get("/api/flare/catalogue?format=csv")
    assert res_csv.status_code == 200
    assert "text/csv" in res_csv.headers["content-type"]

    # Flare detail
    res_flare = client.get(f"/api/flare/{first_id}")
    assert res_flare.status_code == 200
    assert res_flare.json()["data"]["id"] == first_id

    # Not found flare
    res_404 = client.get("/api/flare/non-existent-flare-id")
    assert res_404.status_code == 404


def test_forecast_and_impact():
    res_fc = client.get("/api/forecast/horizons")
    assert res_fc.status_code == 200
    assert "horizons" in res_fc.json()["data"]

    res_imp = client.get("/api/impact/current")
    assert res_imp.status_code == 200
    assert "index" in res_imp.json()["data"]


def test_replay_controls():
    res_dates = client.get("/api/replay/dates")
    assert res_dates.status_code == 200
    assert "dates" in res_dates.json()["data"]

    res_start = client.post("/api/replay/start", json={"event_date": "2024-02-22", "speed": 20})
    assert res_start.status_code == 200

    res_pause = client.post("/api/replay/pause")
    assert res_pause.status_code == 200
    assert res_pause.json()["data"]["playing"] is False

    res_resume = client.post("/api/replay/resume")
    assert res_resume.status_code == 200
    assert res_resume.json()["data"]["playing"] is True

    res_cursor = client.post("/api/replay/cursor", json={"idx": 100})
    assert res_cursor.status_code == 200

    res_stop = client.post("/api/replay/stop")
    assert res_stop.status_code == 200


def test_ws_live():
    with client.websocket_connect("/ws/live") as websocket:
        data = websocket.receive_json()
        assert "clock" in data or "nowcast_state" in data
