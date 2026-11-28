# Deploy FE on Vercel and Spring Boot on Railway

The repository contains a React/Vite frontend in `FE/` and a Spring Boot/MySQL backend in `BE/`. The steps below configure those two services. The AI service is separate and remains disabled in Spring until it is deployed and configured independently.

## 1. Railway MySQL

Create a Railway project, add a MySQL service, then create a Spring backend service from this repository. Set the backend service's Root Directory to `/BE`. Use:

- Build command: `bash mvnw -DskipTests package` (the checked-in wrapper is not marked executable)
- Start command: `java -jar target/pbl6-0.0.1-SNAPSHOT.jar`
- Public networking: generate an HTTPS domain for the backend.

Railway injects `PORT`; Spring now binds to it automatically. In the backend service Variables, add:

| Variable | Value |
| --- | --- |
| `JWT_SECRET` | A private random 64-character hex string (generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
| `DB_HOST` | `${{MySQL.MYSQLHOST}}` |
| `DB_PORT` | `${{MySQL.MYSQLPORT}}` |
| `DB_NAME` | `${{MySQL.MYSQLDATABASE}}` |
| `DB_USERNAME` | `${{MySQL.MYSQLUSER}}` |
| `DB_PASSWORD` | `${{MySQL.MYSQLPASSWORD}}` |
| `DB_USE_SSL` | `false` for the Railway private-network connection; change only if the selected database endpoint requires TLS |
| `JPA_SHOW_SQL` | `false` |
| `JPA_FORMAT_SQL` | `false` |
| `JPA_DDL_AUTO` | `update` for the current schema setup |
| `CORS_ALLOWED_ORIGINS` | `https://your-vercel-project.vercel.app` (comma-separate additional exact custom domains) |
| `ASSISTANT_ORIGINS` | Same exact Vercel origins; used by assistant endpoints if enabled |
| `BANK_ID` | Your receiving bank's VietQR bank ID |
| `BANK_ACCOUNT_NO` | Receiving bank account number |
| `BANK_ACCOUNT_NAME` | Receiving account holder name |
| `SEPAY_API_KEY` | SePay webhook credential; set if accepting SePay callbacks |
| `AI_ASSISTANT_ENABLED` | `false` unless the separate AI service is deployed and configured |

`PORT` is supplied by Railway; do not hard-code it. Add the database variables as Railway reference variables (change `MySQL` to the exact name of your database service). Keep the database on Railway's private network; do not create public TCP access for the application connection.

## 2. Vercel frontend

Import the repository into Vercel and set **Root Directory** to `FE`. The checked-in `FE/vercel.json` selects `npm run build`, serves `dist`, and rewrites SPA routes to `index.html`.

Set these Vercel project environment variables for Production (and Preview if preview builds should call a backend):

| Variable | Value |
| --- | --- |
| `VITE_API_BASE_URL` | `https://your-backend.up.railway.app` (no trailing slash) |
| `VITE_ASSISTANT_ENABLED` | `false` until the assistant backend and AI service are configured |

`VITE_*` values are embedded in the public browser bundle. Put only the API URL and public feature flags there; never put JWT signing keys, database credentials, bank secrets, or SePay credentials in Vercel frontend variables.

After the first deploy, copy the exact Vercel production origin (scheme and hostname, no path) into `CORS_ALLOWED_ORIGINS` on Railway, then redeploy the backend. If a custom domain is connected, include that origin too. The browser calls the backend directly, so the backend domain must use HTTPS and allow the Vercel origin.

## 3. Local environment files

- Copy `FE/.env.example` to `FE/.env.local` and set the local or deployed API URL when needed.
- Copy `BE/.env.example` to `BE/.env`; replace the JWT placeholder and local database values. Never commit either file.
- Deployment secrets belong in Vercel/Railway project settings, not in committed `.env` files.

The frontend Vite proxy remains available for local development when `VITE_API_BASE_URL` is empty. Local builds continue writing static assets into the backend resources directory; Vercel builds write to `FE/dist`.

## 4. Optional AI service

The Spring assistant is disabled by default. Only set `AI_ASSISTANT_ENABLED=true` after a separately reviewed AI deployment is available. Configure `AI_SERVICE_URL` and a private `AI_SERVICE_AUTH_TOKEN` shared between Spring and the AI service. Do not pass customer JWTs as the service token. AI corpus, Gemini, retrieval index, Qdrant, and verification-artifact deployment are outside this FE/BE environment setup.
