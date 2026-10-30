# PBL6 AI Service

FastAPI service for the PBL6 hotel booking project. It exposes a dependency-free health endpoint
and an authenticated recommendation endpoint. Recommendations use the current Spring availability
API and a deterministic ranking pipeline. Chat, RAG, AI-provider clients, and vector storage are
not implemented.

The existing Spring Boot backend remains the source of truth for authentication, prices, room
availability, bookings, payments, and customer history.

## Prerequisites

- Python 3.12 or newer. Bootstrap was verified with Python 3.13.10.
- `pip`; no Poetry, PDM, or `uv` setup is required.
- PowerShell commands below assume the repository is at `D:\University\PBL6`.

## Create the environment

```powershell
cd D:\University\PBL6\ai-service
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
```

If Python 3.12 is the installed supported interpreter, replace `-3.13` with `-3.12`.

## Install bootstrap and development dependencies

```powershell
python -m pip install -e ".[dev]"
```

Runtime dependencies are limited to FastAPI, Uvicorn, pydantic-settings, httpx, and simplejson.
Development dependencies provide pytest and Ruff.

## Prepare configuration

```powershell
Copy-Item .env.example .env
```

Set `AI_SERVICE_AUTH_TOKEN` in `.env` to a long, random, private string before calling the
recommendation endpoint. `BACKEND_API_URL` must point to the running Spring backend; this repository's
`BE` project uses port `9090` by default. `.env` is ignored by Git. Do not place credentials in
`.env.example`. The availability route is public, so no outbound backend credential is needed.

Available bootstrap settings:

| Variable | Purpose | Example default |
|---|---|---|
| `APP_NAME` | Service name | `ai-service` |
| `APP_ENV` | `development`, `test`, `staging`, or `production` | `development` |
| `LOG_LEVEL` | Python logging level | `INFO` |
| `BACKEND_API_URL` | Existing Spring Boot backend | `http://localhost:9090` |
| `BACKEND_REQUEST_TIMEOUT_SECONDS` | Availability client timeout | `5` |
| `AI_SERVICE_AUTH_TOKEN` | Required inbound Bearer token for recommendations | empty until set |

## Run the service

```powershell
python -m uvicorn ai_service.main:app --host 127.0.0.1 --port 8006
```

Use Uvicorn's `--host` and `--port` options to change the bind address and port.

`GET /health` does not contact the backend, a database, an LLM, or a vector store.

In another PowerShell window:

```powershell
Invoke-RestMethod http://127.0.0.1:8006/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "ai-service",
  "version": "0.1.0"
}
```

FastAPI's generated bootstrap documentation is available locally at
`http://127.0.0.1:8006/docs`.

## Request recommendations

The Spring backend must be running for recommendations. The AI service calls
`POST /api/public/rooms/available` once for each request; a stopped backend results in HTTP 502.
Use a future check-in date accepted by Spring. For a local call from PowerShell:

```powershell
$token = (Get-Content .env | Where-Object { $_ -like 'AI_SERVICE_AUTH_TOKEN=*' }) -replace '^AI_SERVICE_AUTH_TOKEN=', ''
$checkIn = (Get-Date).Date.AddDays(20)
$body = @{
  checkInDate = $checkIn.ToString('yyyy-MM-dd')
  checkOutDate = $checkIn.AddDays(2).ToString('yyyy-MM-dd')
  guestCount = 2
  preferences = @{ amenities = @('wifi', 'minibar') }
  topK = 5
} | ConvertTo-Json -Depth 4
Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8006/api/v1/ai/recommendations' `
  -Headers @{ Authorization = "Bearer $token"; 'X-Request-ID' = [guid]::NewGuid().ToString() } `
  -ContentType 'application/json' -Body $body
```

The response has `status` (`OK` or `NO_MATCH`), `recommendations`, `availabilityCheckedAt`, and
`requestId`. Invalid input returns 422, an invalid service token returns 401, a backend timeout
returns 504, and an unavailable or invalid backend response returns 502. Requests above 16 KiB
return 413. Monetary values are JSON
numbers. The route is intended for private service-to-service use; a Spring facade for frontend
clients is still pending.

## Run checks

```powershell
python -m pytest
python -m ruff check .
```

## Documentation

- [Architecture and service boundaries](docs/architecture.md)
- [Versioned AI integration contract](docs/contracts/ai-integration-v1.md)
- [Recommendation V1 scope](docs/recommendation-v1-scope.md)
- [Backend availability client](docs/backend-client.md)
- [Internal recommendation pipeline](docs/recommendation-pipeline.md)
- [Implementation dependencies and order](docs/implementation-dependencies.md)
- [Original bootstrap API draft](docs/api-contracts.md), retained as superseded context.
- [Original design blueprint](docs/design-blueprint.md), retained for historical context; its
  Node.js/PostgreSQL backend references do not describe the current repository.

## Implemented HTTP surface

| Method | Path | Status |
|---|---|---|
| `GET` | `/health` | Implemented |
| `POST` | `/api/v1/ai/chat` | Documented only; intentionally returns 404 |
| `POST` | `/api/v1/ai/recommendations` | Implemented; requires token and live Spring backend |

No knowledge ingestion, database migration, paid provider call, or external deployment is part
of this service.
