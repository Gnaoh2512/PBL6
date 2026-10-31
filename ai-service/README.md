# PBL6 room recommendation service

FastAPI supports two private room-search routes:

- `POST /api/v1/ai/recommendations` accepts validated JSON criteria.
- `POST /api/v1/ai/recommendations/conversation` accepts Vietnamese search messages and a
  caller-carried search state. A Gemini adapter extracts only changes to criteria.

Both routes use Spring Boot's current availability API. Spring Boot owns MySQL, room inventory,
pricing, bookings, and payment rules. This service never reads MySQL directly. A recommendation
does not reserve a room. The existing Spring-to-AI facade is still pending.

## Requirements and configuration

Python 3.12+ and the Spring Boot backend on `http://127.0.0.1:9090` are required. The backend's
default profile connects to MySQL using `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, and
`DB_PASSWORD`. Create the `hotel_management` database before starting Spring; Spring's data
initializer seeds demonstration rooms when its account table is empty. Do not put production
credentials into version control.

From `ai-service`:

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
Copy-Item .env.example .env
```

Set a private `AI_SERVICE_AUTH_TOKEN` in `.env`. To enable Vietnamese language extraction, also
set `GEMINI_API_KEY`. The JSON recommendation route and `/health` work without a Gemini key.
`GEMINI_MODEL` defaults to `gemini-2.5-flash`; `HOTEL_TIMEZONE` defaults to `Asia/Ho_Chi_Minh`.
`BACKEND_API_URL` points to Spring, and both backend and Gemini timeouts are configurable.
Only `.env.example` contains empty placeholders; `.env` is ignored by Git.

The provider uses Gemini structured JSON output via `httpx`, without an additional SDK.
The model only extracts SET/CLEAR edits. Python validates the edits and runs the existing
deterministic pipeline. The [official Gemini API guide](https://ai.google.dev/api/generate-content)
documents the `generationConfig.responseJsonSchema` JSON schema used here.

## Start and test in a browser

Start Spring with its MySQL settings, then from `ai-service`:

```powershell
.\.venv\Scripts\python.exe -m uvicorn ai_service.main:app --host 127.0.0.1 --port 8006
```

Open **http://127.0.0.1:8006/demo**. Enter the service token locally. The page has a structured
search form that works without an LLM key, and a Vietnamese conversation form that requires the
key. The token is not stored by the page. `GET /health` is available without a token.

## Conversation contract

Each request requires `Authorization: Bearer <AI_SERVICE_AUTH_TOKEN>` and a valid `X-Request-ID`.
Body limit: 16 KiB. Message limit: 2,000 characters. Each response returns the updated `state`;
send it back with the next message. The state contains confirmed search criteria, unresolved
`pending` criteria, `pendingQuestion`, and an optional `pendingRelaxation` proposal after
`NO_MATCH`, never cached rooms or prices. No server-side
conversation store is used. An unresolved budget or date blocks availability until clarified.

```json
{
  "message": "Một phòng cho hai người từ 15 đến 17 tháng 11 năm 2026, tối đa một triệu mỗi đêm",
  "state": {}
}
```

If a value is missing or ambiguous, the service returns `NEEDS_CLARIFICATION` and a question.
Reply with the returned `state` and the new message. The other outcomes are `RECOMMENDED`,
`NO_MATCH`, and `UNSUPPORTED`. A recommendation response has this shape:

```json
{
  "status": "RECOMMENDED",
  "reply": "Có 1 phòng phù hợp. Gợi ý này không giữ chỗ; tình trạng có thể thay đổi.",
  "state": {"checkInDate": "2026-11-15", "checkOutDate": "2026-11-17", "guestCount": 2, "roomCount": 1},
  "clarificationFields": [],
  "result": {
    "status": "OK",
    "scoringVersion": "multi-criteria-experimental-v1",
    "recommendations": [{"roomId": 1, "pricePerNight": 500000, "score": 0, "reasons": []}],
    "availabilityCheckedAt": "2026-10-31T03:00:00Z",
    "requestId": "example-1"
  },
  "requestId": "example-1"
}
```

The example abbreviates null state fields, empty `pending`, `pendingQuestion`, the score
breakdown and other room
fields; actual responses include the full
`RecommendedRoom` contract. Money remains JSON numbers generated from `Decimal` values.

Multiple rooms and budgets that must include tax, services, vouchers or other charges return
`UNSUPPORTED`. A `totalBudget` for the basic room charge is supported and compared against
the backend's `totalRoomCharge`; per-night limits remain separate. After `NO_MATCH`, the
conversation may propose a change but does not apply it or query relaxed criteria until
the customer explicitly agrees or supplies a new value. Required amenities are filtered
using verified backend room-type text; unknown or conflicting names trigger clarification in
conversation or HTTP 422 in the JSON route. Room-type names are matched only against Spring's live room-type list.
The backend is queried for availability for every complete supported request.

Provider or backend failures return separate technical HTTP errors. Missing Gemini configuration
returns `503 LLM_NOT_CONFIGURED`; provider timeout returns 504, invalid provider output 502.
Backend errors retain the JSON recommendation route's existing mappings.

## Checks and current limits

```powershell
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m ruff check .
```

Automated extraction tests use a mock provider and do not make paid calls. Live Gemini behavior
requires a real API key and must be verified separately. Spring/MySQL integration can be checked
through the structured route or the browser page without a provider key.

More detail: [architecture](docs/architecture.md), [API contract](docs/contracts/ai-integration-v1.md),
[recommendation pipeline](docs/recommendation-pipeline.md), and
[backend client](docs/backend-client.md).
