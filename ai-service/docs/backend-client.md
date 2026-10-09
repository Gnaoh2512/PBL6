# Backend availability client

Status: implemented foundation for the `1.0.0-draft` recommendation contract. This does not make
the product proposal final and does not implement the recommendation endpoint or pipeline.

## Implemented boundary

- `BackendClient` owns and reuses one asynchronous HTTP connection pool for the FastAPI process.
- It calls only `POST /api/public/rooms/available` and closes during application shutdown.
- Base URL and timeout come from `BACKEND_API_URL` and
  `BACKEND_REQUEST_TIMEOUT_SECONDS`.
- The outbound body mirrors `RoomSearchRequest`; `preferences` and `topK` remain AI-only fields.
- `X-Request-ID` accepts only 1-64 ASCII letters, digits, `.`, `_`, or `-`.
- No `Authorization`, user JWT, or internal service credential is sent to this public endpoint.
- There is no automatic retry. Empty `data` is returned as an empty candidate list, while
  timeout, connection, HTTP, and invalid-envelope failures have distinct error categories.
- Monetary request and response values remain `Decimal`; JSON encoding does not pass through a
  binary floating-point value.

The room-types endpoint is intentionally not called: each `AvailableRoomResponse` already embeds
the current `RoomTypeResponse` required by V1.

## Backend evidence

| Implemented assumption | Authoritative source |
|---|---|
| POST path, request DTO, response envelope | `pbl6/src/main/java/com/example/pbl6/controller/PublicRoomController.java:73-77` |
| Search fields and Java `BigDecimal` prices | `pbl6/src/main/java/com/example/pbl6/dto/room/RoomSearchRequest.java:17-39` |
| Concrete room and calculated monetary fields | `pbl6/src/main/java/com/example/pbl6/dto/room/AvailableRoomResponse.java:16-31` |
| Nested room-type fields | `pbl6/src/main/java/com/example/pbl6/dto/room/RoomTypeResponse.java:15-21` |
| Envelope fields | `pbl6/src/main/java/com/example/pbl6/common/ApiResponse.java:16-47` |
| Eligibility predicates for status, type, capacity, price, and overlap | `pbl6/src/main/java/com/example/pbl6/repository/RoomRepository.java:16-38` |
| Date order, sorting, nights, price, and deposit response mapping | `pbl6/src/main/java/com/example/pbl6/service/RoomCatalogServiceImpl.java:52-110` |

## Known contract differences and open decisions

- Spring applies `@FutureOrPresent` to `checkInDate`. The AI model deliberately does not duplicate
  a "today" check because no hotel timezone has been agreed. A past date can therefore pass local
  AI validation and receive a backend HTTP 400; Spring remains authoritative.
- The draft requires request-ID propagation, but the Spring repository has no request-ID
  filter/interceptor yet. The client sends the header; correlation/echo remains `TRACE-01` work.
- `topK` default 5 and range 1-20 are temporary draft values, not approved product policy.
- Currency is absent from backend DTOs. The models do not infer or label a currency.
- Test fixture JSON is synthetic and is identified as such in `tests/fixtures/README.md`.
