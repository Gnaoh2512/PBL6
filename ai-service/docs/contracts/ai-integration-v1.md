# Recommendation integration contract

The existing Spring facade remains unimplemented. The FastAPI routes below are private and
require an opaque service Bearer token plus `X-Request-ID` (1–64 ASCII letters, digits, `.`, `_`,
or `-`). The browser demo calls them directly for local testing only.

| Method and path | Input | Output |
|---|---|---|
| `GET /health` | None | Process status, service, version |
| `POST /api/v1/ai/recommendations` | Structured `RecommendationRequest` | `RecommendationResult` |
| `POST /api/v1/ai/recommendations/conversation` | `{message, state}` | `ConversationResponse` |

`message` is a nonblank Vietnamese search utterance, at most 2,000 characters. `state` is the
previous `ConversationResponse.state` or `{}` on the first turn. Its optional fields are
`checkInDate`, `checkOutDate`, `guestCount`, `roomCount`, `roomTypeId`, `roomTypeName`, `minPrice`,
`maxPrice`, `totalBudget`, `sortBy`, `preferredAmenities`, and `requiredAmenities`. All fields are
validated on every request. A missing field stays missing. A correction changes only named fields;
a CLEAR operation removes a criterion. Caller state does not prove room availability or price.

`ConversationResponse` contains `status`, Vietnamese `reply`, updated `state`,
`clarificationFields`, `result` (a complete `RecommendationResult` or null), and `requestId`.
The statuses are:

| Status | Meaning | Backend availability call |
|---|---|---|
| `NEEDS_CLARIFICATION` | Missing or ambiguous critical input | No |
| `UNSUPPORTED` | Multiple rooms, total budget, mandatory amenity, or unrelated intent | No |
| `RECOMMENDED` | One or more current backend rooms match | Yes |
| `NO_MATCH` | Complete criteria but no eligible backend room | Yes |

The LLM returns only an extraction patch. It cannot provide room IDs, prices, capacity or
availability. The server resolves exact room-type names against `GET /api/public/rooms/room-types`
and sends hard criteria to `POST /api/public/rooms/available`. For each complete request, that
availability API remains the only source of candidate rooms. Money uses `Decimal` and JSON number
serialization. The response is a suggestion, not a room hold.

| Failure | HTTP/code |
|---|---|
| Invalid/missing service token | `401 SERVICE_UNAUTHORIZED` |
| Missing provider configuration | `503 LLM_NOT_CONFIGURED` |
| Body larger than 16 KiB | `413 REQUEST_TOO_LARGE` |
| Invalid request/state | `422 VALIDATION_ERROR` |
| Provider timeout | `504 LLM_TIMEOUT` |
| Provider transport, status, or malformed structured output | `502 LLM_UNAVAILABLE` |
| Spring rejects search criteria with 400/422 | `422 BACKEND_REJECTED_REQUEST` |
| Spring timeout | `504 BACKEND_TIMEOUT` |
| Spring connection/status/schema failure | `502 BACKEND_UNAVAILABLE` |

The future Spring facade should authenticate the end user, hold the service token privately,
forward a validated request ID, call the private AI route with a bounded timeout, and map these
errors to its existing `ApiResponse` convention. No end-user JWT or signing secret is forwarded
to FastAPI.
