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
`maxPrice`, `totalBudget`, `sortBy`, `preferredAmenities`, and `requiredAmenities`. It also contains
`pending` (up to 12 unresolved criteria) and `pendingQuestion` (the field currently being asked).
All fields and cross-field invariants are validated on every request. A missing field stays
missing. A correction changes only named fields; a CLEAR operation removes both confirmed and
pending values for that criterion. Caller state does not prove room availability or price.

`pending` uses a discriminated `kind`:

| Kind | Fields | Meaning |
|---|---|---|
| `budget` | `amount` (decimal or null), `basis` (`PER_NIGHT`, `TOTAL_STAY`, or null) | Keep an amount until its basis is clear. A confirmed budget appears only as `maxPrice` or `totalBudget`. |
| `date` | `field` (`checkInDate` or `checkOutDate`), `month`, `day` | Keep day/month without inventing a year. Month/day can be null when even those are unclear. |
| `field` | `field`, `value` | Keep another unresolved criterion without applying it as a confirmed filter. |

For example, after “ngân sách một triệu” the response state may contain
`"pending":[{"kind":"budget","amount":1000000,"basis":null}]` and
`"pendingQuestion":"budgetBasis"`. Send that state back with “mỗi đêm”; the service moves the
amount to `maxPrice` before querying Spring. “Toàn kỳ” moves it to `totalBudget` and returns
`UNSUPPORTED`. An unrelated answer keeps the pending criterion and prompts again. A newer
ambiguous amount replaces the older one and suspends any previously confirmed budget. Date
changes without an explicit year remain pending even when another date in state has a year.

`ConversationResponse` contains `status`, Vietnamese `reply`, updated `state`,
`clarificationFields`, `result` (a complete `RecommendationResult` or null), and `requestId`.
The statuses are:

| Status | Meaning | Backend availability call |
|---|---|---|
| `NEEDS_CLARIFICATION` | Missing or ambiguous critical input; unresolved values remain in `state.pending` | No |
| `UNSUPPORTED` | Multiple rooms, total budget, mandatory amenity, or unrelated intent | No |
| `RECOMMENDED` | One or more current backend rooms match | Yes |
| `NO_MATCH` | Complete criteria but no eligible backend room | Yes |

The LLM returns only an extraction patch. It cannot provide room IDs, prices, capacity or
availability. The server resolves exact room-type names against `GET /api/public/rooms/room-types`
and sends hard criteria to `POST /api/public/rooms/available`. For each complete request, that
availability API remains the only source of candidate rooms. Availability is never called while
`state.pending` is nonempty. Money uses `Decimal` and JSON number
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
