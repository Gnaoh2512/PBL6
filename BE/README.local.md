# Run the Spring backend locally

The default profile uses MySQL. For a local setup without MySQL or Docker, use the `local-h2`
Maven profile with Spring's `local` profile. This keeps a development database in `BE/.localdb/`
and seeds three synthetic room types and three available rooms. The directory is ignored by Git.

From `BE` in PowerShell:

```powershell
.\mvnw.cmd -Plocal-h2 -DskipTests package
java -jar .\target\pbl6-0.0.1-SNAPSHOT.jar --spring.profiles.active=local
```

The backend listens on `http://127.0.0.1:9090`. Check the room catalogue with:

```powershell
Invoke-RestMethod http://127.0.0.1:9090/api/public/rooms/room-types
```

The local profile and catalogue are for development. They do not replace the production MySQL
configuration or the main SQL seed data. The AI service can point to this backend with
`BACKEND_API_URL=http://127.0.0.1:9090`.

## Run against MySQL on port 3306

The default Spring profile already uses MySQL. Create the `hotel_management` database first;
`spring.jpa.hibernate.ddl-auto=update` creates missing tables, and `DataInitializer` adds sample
rooms when the account table is empty. The backend reads host, port, database, username, and
password from `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, and `DB_PASSWORD`.

Set `DB_PASSWORD` in the process environment (or a private local secret manager) before starting
Spring. An explicit process environment value takes precedence over a blank value in `BE/.env`.
Do not commit database passwords. From `BE`:

```powershell
.\mvnw.cmd -DskipTests package
java -jar .\target\pbl6-0.0.1-SNAPSHOT.jar
```

Check `http://127.0.0.1:9090/api/public/rooms/room-types`. The AI service points at that API,
not at MySQL directly. Its browser test page is `http://127.0.0.1:8006/demo` when AI service
is running.

## Recommendation facade

Start the AI service on port 8006 as described in `../ai-service/README.md`. Set the same private
`AI_SERVICE_AUTH_TOKEN` in the process environments of Spring and the AI service; do not put a
real token in either committed example file. Spring reads `AI_SERVICE_URL` (default
`http://127.0.0.1:8006`) and `AI_SERVICE_TIMEOUT_MS` (default 15000). Start Spring after setting
these values. The conversation route also needs `GEMINI_API_KEY` on the AI service side.

Send the end-user JWT only to Spring. Both facade routes require the existing JWT authentication:

```powershell
$headers = @{ Authorization = "Bearer <USER_JWT>"; "X-Request-ID" = "demo-search-1" }
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:9090/api/ai/recommendations `
  -Headers $headers -ContentType 'application/json' `
  -Body '{"checkInDate":"2026-11-10","checkOutDate":"2026-11-12","guestCount":2}'
```

`POST /api/ai/recommendations/conversation` accepts the AI contract's `{ "message": "...",
"state": {} }` body. Pass the returned `data.state` on subsequent turns. Spring preserves
the AI JSON object under `ApiResponse.data` and returns the same `X-Request-ID`; it creates a
UUID if the header is absent. It sends only its service token to FastAPI, never the user's JWT.
The URL is a configured origin, POST is sent once, and redirects are disabled.

AI validation/size errors map to 422/413. AI dependency and configuration errors map to
502/503/504, while a failed Spring-to-AI connection maps to 502 and a timeout to 504.
An invalid service token is an internal upstream failure (502). Upstream error codes and safe
validation details appear in `ApiResponse.data`; no room search result is synthesized on error.
The facade does not book or hold a room.

Run the focused tests without FastAPI, Gemini, MySQL or H2:

```powershell
.\mvnw.cmd '-Dtest=RecommendationAiClientTest,RecommendationAiControllerTest' test
```
