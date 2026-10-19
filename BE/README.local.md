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
