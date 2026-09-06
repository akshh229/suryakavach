# SURYAKAVACH

**India's indigenous solar-flare early-warning prototype** for SIH 2026 (SIH26209 · Space Technology).

SURYAKAVACH turns Aditya-L1 SoLEXS and HEL1OS observations into three operational answers:

1. Is a solar flare happening now?
2. How likely is a C- or M-class flare in the next 5, 10, 20, or 40 minutes?
3. What operational impact level should an operator act on?

The product is designed as a calm, light-theme mission-operations console backed by a FastAPI service, reproducible offline replay, and interpretable detection, forecasting, and impact engines.

> **Project status — active foundation build**
>
> The repository currently contains an early Python backend prototype with synthetic replay data, BOCPD/Neupert-oriented nowcasting, baseline comparison, forecast scaffolding, impact scoring, replay controls, API route scaffolding, and a dashboard implementation in progress. It is **not yet a complete runnable PRD implementation**: real Aditya-L1 ingestion, a PRD-compliant light-theme dashboard, a trained forecasting model, evaluation harness, and production-ready deployment flow are still being built.

## Product scope

### Included in the v1 prototype

- Fused SoLEXS (soft X-ray) and HEL1OS (hard X-ray) minute-level streams
- Near-real-time flare nowcasting with changepoint and Neupert-effect checks
- Flare probability at 5, 10, 20, and 40 minute horizons
- A 0–10 explainable Flare Impact Index with R/S/G-aligned severity language
- Offline, deterministic historical-event replay, including the 22 February 2024 X6.3 event
- REST API and WebSocket live updates
- Operator dashboard: Monitor, Replay, Catalogue, Flare Detail, and Methodology screens

### Explicit non-goals for v1

- CME detection and Kp/geomagnetic-storm forecasting
- User accounts, access roles, and mobile apps
- Claims of operational deployment or real-time ISSDC streaming
- Webhook delivery (planned as a v1.1 stretch goal)

## Architecture

```text
Aditya-L1 / cached GOES data
        |
   ingestion + fusion
        |
 feature store (Parquet / SQLite / Supabase)
        |
 +------+--------------------+
 |                           |
nowcast engine          forecast engine
BOCPD + Neupert         survival probabilities + EVT quantiles
 |                           |
 +----------- impact engine --+
                 |
          FastAPI + WebSocket
                 |
     React + TypeScript operator dashboard
```

## Repository layout

```text
backend/
  suryakavach/
    api.py                FastAPI routes and WebSocket endpoint
    runtime.py            Replay/runtime orchestration
    db.py                 SQLite schema + Supabase shim
    config.py             Configuration loading
    supabase_db.py        Supabase client factory
    engines/              BOCPD, Neupert, nowcast, forecast, EVT, impact
    ingest/               Data ingestion modules (synthetic replay exists today)
    evaluate.py           Evaluation-report starting point
  tests/                  Backend and API tests
config.yaml               Thresholds, horizons, impact weights, replay defaults
docker-compose.yml        Local services definition
render.yaml               Render backend deployment config
apps/web/                 React + Vite frontend
  vercel.json             Vercel deployment config (rewrites to backend)
```

The frontend lives in `apps/web/`. It is being built toward React 18, TypeScript, Vite, Tailwind CSS, Plotly, TanStack Query, and Zustand; its current visual implementation still needs alignment with the PRD's light, scientific operator-console design system.

## Deployment

The production deployment runs:

- **Frontend** on **Vercel** — single-page app served statically, API/WebSocket calls rewritten to the backend.
- **Backend** on **Render** (free tier) — Docker container running uvicorn.
- **Database** on **Supabase** — PostgreSQL with the `supabase` Python SDK.

### Prerequisites

- A Supabase project with `flares`, `alerts`, `replay_sessions` tables created (schema in `backend/suryakavach/db.py`).
- Environment variables set in Render: `USE_SUPABASE=1`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

### Supabase table schema

Run this SQL in the Supabase SQL editor:

```sql
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
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  ts TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  flare_id TEXT,
  message TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS replay_sessions (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  event_date TEXT NOT NULL,
  speed REAL NOT NULL,
  status TEXT NOT NULL,
  cursor TEXT
);
```

Enable Row Level Security as needed and set the service role key for server-side access.

### Render backend

`render.yaml` defines a free-tier Docker service. Create a new Web Service from the repo root, set the three env vars, and Render builds `backend/Dockerfile`.

### Vercel frontend

`apps/web/vercel.json` rewrites `/api/*` and `/ws/live` to the Render backend. Deploy `apps/web/` as a Vercel project; build command is `npm run build`, output directory is `dist`.

## Local development

### Prerequisites

- Python 3.11+
- Docker Desktop with Docker Compose (target offline demo path)
- Node.js 20+ once `apps/web` is added

### Backend environment

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:PYTHONPATH = (Get-Location)
uvicorn suryakavach.api:app --reload --port 8000
```

The API target is available at `http://localhost:8000`, with OpenAPI documentation at `/docs`.

### Docker target

```powershell
docker compose up --build
```

This is the intended one-command offline-demo entry point. During the active foundation build, complete the boot blockers and add `apps/web/` before treating this command as a release check.

## Configuration

[`config.yaml`](./config.yaml) is the single configuration surface. It controls:

- BOCPD threshold, hazard, and maximum run length
- Neupert correlation threshold and window
- Forecast horizons and high-risk alert threshold
- Impact-index weights and severity-band edges
- Replay event, speed, cache path, and deterministic seed
- Baseline threshold, CORS origins, and API rate limit

Avoid hidden constants in production logic; promote tunable scientific or operational choices into this file with a documented default.

## API contract

The v1 API uses UTC ISO-8601 timestamps and a `{ data, meta }` response envelope.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Service, data-timestamp, and engine health |
| `GET /api/streams/latest?window=120` | Latest fused SoLEXS and HEL1OS stream window |
| `GET /api/nowcast/state` | Lifecycle state and active flare |
| `GET /api/flare/catalogue` | Filtered, paginated flare catalogue; CSV/JSON export |
| `GET /api/flare/{id}` | Full flare parameters, series, posterior, and sub-scores |
| `GET /api/forecast/horizons` | C1/M1 probabilities and intensity quantiles |
| `GET /api/impact/current` | Impact index, severity mapping, and contribution scores |
| `GET /api/alerts` | In-app alert feed |
| `POST /api/replay/start` / `stop` | Deterministic historical replay control |
| `WS /ws/live` | Live state, latest points, forecast, impact, alerts, and heartbeat |

## Data and scientific integrity

The current replay generator is explicitly synthetic and exists only to unblock interface and engine development. It must never be presented as observed Aditya-L1 data or as validated operational performance.

Before the final demo, the project must provide:

- Cached SoLEXS L1 netCDF and HEL1OS L1 FITS observations, including 2024-02-22 and May 2024 active periods
- Cached GOES XRS and NOAA flare-event data for pretraining and validation
- Idempotent, resumable ingestion with immutable raw files and versioned processed output
- Reproducible metrics: TSS, HSS, false-alarm rate, detection lead, per-horizon Brier score, and impact-index agreement

## Quality gates

The acceptance gate is complete only when all of the following are true:

- A laptop can run the full offline system with `docker compose up` in five minutes or less
- The X6.3 replay detects onset before peak, raises alerts, forecasts causally, and reaches at least R3 impact severity
- The catalogue contains at least 25 real detected flares and exports correctly
- All API routes are OpenAPI-documented and contract-tested; the WebSocket reconnects after a drop
- The dashboard meets the light-theme, accessibility, and operator-console design requirements
- Evaluation results are generated reproducibly and match the presentation deck

## Development plan

1. **Foundation:** make backend boot reliably; align tests with contracts; stabilize the web workspace; make Compose build cleanly.
2. **Data:** implement SoLEXS/HEL1OS/GOES ingestion, cache registry, common one-minute grid, gap handling, and Parquet feature store.
3. **Engines:** validate detection, add calibrated survival forecasting, complete severity calibration, and preserve replay causality.
4. **Experience:** build Monitor, Replay, Catalogue, Detail, and Methodology screens using the design tokens in the PRD.
5. **Validation:** add offline demo rehearsal, API/UI/E2E tests, backtesting, charts, CI, and an honest metrics report.

## Team ownership

| Area | Owner |
| --- | --- |
| Architecture, BOCPD, integration | Vasu Gera |
| Data ingestion, PRADAN cache, simulation stream, Docker | Akshat Raj |
| Survival model, EVT, calibration | Akshita Guleria |
| FastAPI, WebSockets, replay, alerts | Prerna |
| Dashboard, charts, accessibility | Pakhi |
| Validation, NOAA calibration, methodology, deck metrics | Mayank |

## Contributing

- Keep all timestamps UTC internally; convert to IST only for display.
- Keep the system deterministic in replay mode.
- Add a test with every bug fix or engine/API behavior change.
- Do not commit datasets, secrets, model weights, or generated caches.
- Prefer explainable operational language over unsupported scientific claims.
- Preserve the light, dense mission-operations design system; avoid dashboards that resemble generic SaaS admin panels.

## License

License to be selected by the team before public release.
