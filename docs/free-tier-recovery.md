# Free-tier recovery and startup diagnosis

## What this change establishes

This document records code observations made on 2026-10-16. It is not a
production incident report: no Render logs or production timing traces were
accessed during this work.

Observed in the repository:

- Render is configured as a free Docker web service and probes `GET /api/health`.
- Before this change, the runtime boot path also seeded an optional baseline
  evaluation. It now builds replay data, fits the forecast, runs nowcasts, and
  persists the catalogue; evaluation seeding is deferred until it is needed.
  The remaining boot stages are CPU and persistence operations that can take
  meaningful time on a cold free instance.
- The API previously awaited boot inside the FastAPI lifespan, so HTTP serving
  could not begin until all of that work completed.
- Importing the runtime also opened the configured persistence backend. The
  Supabase client constructor is local, but SQLite setup can still create/open
  files before the server begins serving.
- The former live GOES route awaited stale refreshes, despite describing itself
  as stale-while-revalidate. A refresh also held the runtime's broad lock while
  fitting the forecast.

The implementation now starts the ASGI server first, runs boot in a supervised
worker task, exposes liveness separately from readiness, delays database setup
until boot, uses idempotent flare upserts, and returns a stale cached GOES
snapshot while a single background refresh runs. The frontend readiness UI is
a separate follow-up release and is not part of this backend-only stage. This
does not prove that a specific production delay was caused by any one factor.

## Probes and logs

- `GET /api/health` is a lightweight liveness probe. It remains HTTP 200 while
  starting or degraded so Render can determine whether the process is serving.
- `GET /api/ready` is a readiness probe. It returns 200 only when all required
  engines finished successfully, otherwise 503 with `Retry-After`.
- Engine-dependent routes return the existing envelope with 503 while the
  runtime is incomplete. The separately released frontend can use the
  readiness contract without presenting substitute data.
- Startup logs emit `boot.start`, `boot.stage.complete` with a monotonic elapsed
  duration for each stage, and `boot.complete` or `boot.failed`. Client-visible
  failures are intentionally generic; inspect Render logs for the traceback.

To compare a cold start with a warm request, copy the timestamp of the first
Render request and compare it to the startup-stage log timestamps. Then call:

```bash
curl -i https://YOUR-RENDER-SERVICE/api/health
curl -i https://YOUR-RENDER-SERVICE/api/ready
```

Record the HTTP status and elapsed time for each request. Do not infer sleep,
an out-of-memory restart, or CPU saturation from a dashboard screenshot alone.

### Local sample (not a production measurement)

On 2026-10-16, Windows / Python 3.12.10, an in-process `TestClient` cold-start
sample observed liveness at **39.3 ms** (HTTP 200, `starting`), readiness at
**2454.1 ms** (HTTP 200), and a subsequent forecast request in **4.5 ms**.
This is a local functional measurement only; it does not model Render Free
queueing, sleep, CPU contention, or Supabase network latency.

## Demo checklist

1. Shortly before a demo, open `/api/health`; a 200 only proves the process is
   alive.
2. Wait for `/api/ready` to return 200 before opening the dashboard or starting
   a presentation.
3. If readiness stays at 503, inspect the latest Render startup logs for the
   named failed stage. Do not copy environment variable values into tickets or
   chat.
4. Verify Vercel's configured API rewrite and `VITE_WS_URL` point to the same
   backend service. WebSocket upgrades are direct to the backend, not proxied
   by Vercel's API rewrite.

## Free-tier limits and optional monitoring

Render Free services can sleep, restart, queue for shared capacity, or exhaust
the service's included shared instance hours. Application changes cannot
guarantee continuous availability or eliminate a cold start. Review the
current Render plan terms and the policy of any monitoring provider before
using an external HTTP monitor; terms and limits change over time.

An optional monitor may check the lightweight `/api/health` URL and alert on
failure. It must not be represented as a guarantee that the service stays warm,
and this repository intentionally contains no self-pinging loop or scheduled
GitHub Action intended to defeat platform sleep.

## Manual dashboard changes (not performed by this change)

- Keep Render's health-check path as `/api/health`.
- Confirm the Render service uses `master`, `backend/Dockerfile`, and its
  existing secret environment variables. Do not put `SUPABASE_SERVICE_ROLE_KEY`
  in Vercel, frontend environment files, logs, or documentation.
- No deployment, cloud setting, database migration, external monitor, push, or
  merge was performed as part of this work.
