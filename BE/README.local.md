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
