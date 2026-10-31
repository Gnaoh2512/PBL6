# Backend availability client

Status: implemented backend client for the `1.0.0-draft` recommendation contract. The FastAPI
recommendation endpoint and pipeline are also implemented; the Spring AI facade remains pending.

## Implemented boundary

- `BackendClient` owns and reuses one asynchronous HTTP connection pool for the FastAPI process.
- It calls `POST /api/public/rooms/available` for candidates and
  `GET /api/public/rooms/room-types` when a conversation names a room type. It closes during
  application shutdown.
- Base URL and timeout come from `BACKEND_API_URL` and
  `BACKEND_REQUEST_TIMEOUT_SECONDS`.
- The outbound body mirrors `RoomSearchRequest`; `preferences` and `topK` remain AI-only fields.
- `X-Request-ID` accepts only 1-64 ASCII letters, digits, `.`, `_`, or `-`.
- No `Authorization`, user JWT, or internal service credential is sent to this public endpoint.
- There is no automatic retry. Empty `data` is returned as an empty candidate list, while
  timeout, connection, HTTP, and invalid-envelope failures have distinct error categories.
- Monetary request and response values remain `Decimal`; JSON encoding does not pass through a
  binary floating-point value.
- Required response fields are validated. Additional envelope, room, or room-type fields are
  ignored so additive Spring DTO changes do not break recommendations.

The structured recommendation route uses the room type embedded in each availability candidate.
The conversation route queries the room-type catalogue only to resolve a user-provided name to
the current backend ID; it never treats that catalogue as proof of availability.

## Backend evidence

| Implemented assumption | Authoritative source |
|---|---|
| POST path, request DTO, response envelope | `BE/src/main/java/com/example/pbl6/controller/PublicRoomController.java:73-77` |
| Search fields and Java `BigDecimal` prices | `BE/src/main/java/com/example/pbl6/dto/room/RoomSearchRequest.java:17-39` |
| Concrete room and calculated monetary fields | `BE/src/main/java/com/example/pbl6/dto/room/AvailableRoomResponse.java:16-31` |
| Nested room-type fields | `BE/src/main/java/com/example/pbl6/dto/room/RoomTypeResponse.java:15-21` |
| Envelope fields | `BE/src/main/java/com/example/pbl6/common/ApiResponse.java:16-47` |
| Eligibility predicates for status, type, capacity, price, and overlap | `BE/src/main/java/com/example/pbl6/repository/RoomRepository.java:16-38` |
| Date order, sorting, nights, price, and deposit response mapping | `BE/src/main/java/com/example/pbl6/service/RoomCatalogServiceImpl.java:52-110` |

## Known contract differences and open decisions

- Spring applies `@FutureOrPresent` to `checkInDate`. The conversation route checks past dates
  using `HOTEL_TIMEZONE`; the structured route can still pass a past date to Spring and receive
  HTTP 400. Spring remains authoritative.
- The draft requires request-ID propagation, but the Spring repository has no request-ID
  filter/interceptor yet. The client sends the header; correlation/echo remains `TRACE-01` work.
- `topK` default 5 and range 1-20 are temporary draft values, not approved product policy.
- Currency is absent from backend DTOs. The models do not infer or label a currency.
- Test fixture JSON is synthetic and is identified as such in `tests/fixtures/README.md`.
