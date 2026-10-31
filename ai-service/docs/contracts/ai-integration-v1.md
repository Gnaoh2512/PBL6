# Recommendation integration contract

The existing Spring facade remains unimplemented. The FastAPI routes below are private and
require an opaque service Bearer token plus `X-Request-ID` (1–64 ASCII letters, digits, `.`, `_`,
or `-`). The browser demo calls them directly for local testing only.

| Method and path | Input | Output |
|---|---|---|
| `GET /health` | None | Process status, service, version |
| `POST /api/v1/ai/recommendations` | Structured `RecommendationRequest` | `RecommendationResult` |
| `POST /api/v1/ai/recommendations/conversation` | `{message, state}` | `ConversationResponse` |

The JSON recommendation body adds optional top-level `requiredAmenities: string[]` (default
`[]`, maximum 20 names of at most 100 characters). Existing bodies remain valid. The existing
`preferences.amenities` list remains a ranking input only. Both lists use the same controlled
Vietnamese/English amenity catalog and accentless aliases. An unknown name or a code in both
lists returns `422 VALIDATION_ERROR` before querying Spring. A room passes all required codes
only when its backend `roomType.amenities` text explicitly confirms them; absent and unknown
evidence fail the hard filter. Preferred codes only affect score. Reasons quote the original
backend amenity token; no model invents room amenities. See `recommendation-pipeline.md`.
The 422 `error.details` names `body.requiredAmenities` or `body.preferredAmenities` with
`UNKNOWN_AMENITY` (and `supportedCodes`) or `AMENITY_CONFLICT`; raw submitted names are not echoed.

The optional `preferences` object now also accepts `price: "SAVE" | "PREMIUM" | null` and
`capacity: "CLOSE_FIT" | "SPACIOUS" | null`. Both default to null. They affect ranking only
when explicitly supplied; `minPrice`, `maxPrice`, and `guestCount` remain hard filters.
`sortBy` controls the price tie-breaker after score and does not activate a price score.
The result adds `scoringVersion` and, for each room, `scoreBreakdown`,
`matchedPreferences`, and `unmatchedPreferences`. A breakdown component has `score`
(decimal in `[0,1]` or null when inactive), `weight` (decimal), and `evidence`
(string or null). A preference evidence entry has `criterion` (`amenities`, `price`, or
`capacity`), `requested`, and `evidence` (string or null). Price and capacity are
"matched" only for score `1`; partial matches are listed as unmatched but still
contribute their numeric score. `reasons` are deterministic Vietnamese strings derived
from verified backend evidence. See [scoring.md](../scoring.md) for formula and ordering.

Optional top-level `totalBudget` is a nonnegative Decimal ceiling on the **basic room
charge for the whole stay**, compared inclusively with the backend's `totalRoomCharge`.
The AI does not divide it by nights or calculate a final bill. `minPrice`/`maxPrice`
remain separate per-night bounds; both forms may be present and all must pass. Spring's
availability request does not accept `totalBudget`, so the AI applies this hard filter
to the live response before scoring. Tax, services, vouchers, and other charges are not
included because the availability response does not provide a final payable amount.

`message` is a nonblank Vietnamese search utterance, at most 2,000 characters. `state` is the
previous `ConversationResponse.state` or `{}` on the first turn. Its optional fields are
`checkInDate`, `checkOutDate`, `guestCount`, `roomCount`, `roomTypeId`, `roomTypeName`, `minPrice`,
`maxPrice`, `totalBudget`, `budgetScope`, `sortBy`, `pricePreference`, `capacityPreference`,
`preferredAmenities`, and `requiredAmenities`. It also contains
`pending` (up to 12 unresolved criteria), `pendingQuestion` (the field currently being asked),
and `pendingRelaxation` (at most one proposed change after `NO_MATCH`).
All fields and cross-field invariants are validated on every request. A missing field stays
missing. A correction changes only named fields; a CLEAR operation removes both confirmed and
pending values for that criterion. Caller state does not prove room availability or price.

`pending` uses a discriminated `kind`:

| Kind | Fields | Meaning |
|---|---|---|
| `budget` | `amount` (decimal or null), `basis` (`PER_NIGHT`, `TOTAL_STAY`, or null) | Keep an amount until its basis is clear. Confirmed nightly and stay limits may coexist and remain unchanged during clarification. |
| `date` | `field` (`checkInDate` or `checkOutDate`), `month`, `day` | Keep day/month without inventing a year. Month/day can be null when even those are unclear. |
| `field` | `field`, `value` (at most 2,100 characters) | Keep another unresolved criterion, including the full requested amenity list, without applying it as a confirmed filter. |

For example, after “ngân sách một triệu” the response state may contain
`"pending":[{"kind":"budget","amount":1000000,"basis":null}]` and
`"pendingQuestion":"budgetBasis"`. Send that state back with “mỗi đêm”; the service moves the
amount to `maxPrice` before querying Spring. “Toàn kỳ” moves it to `totalBudget`, which is
checked against backend `totalRoomCharge`. An unrelated answer keeps the pending criterion
and prompts again. A newer ambiguous amount replaces the pending amount while confirmed
limits remain unchanged until the basis is resolved. Date
changes without an explicit year remain pending even when another date in state has a year.

If the customer asks for a budget including tax, services, vouchers, or other charges,
`budgetScope` stays pending and no availability call is made. The service asks whether
basic room charge alone is acceptable. `ROOM_CHARGE` confirms that scope; `ALL_COSTS`
returns `UNSUPPORTED` with a clear explanation. A plain `totalBudget` uses the documented
basic-room-charge scope, and recommendation replies restate this limitation. Exact short
"đồng ý" and "không" replies to the scope question are handled deterministically.

After a complete search returns `NO_MATCH`, the original `result` stays `NO_MATCH` and
`state.pendingRelaxation` records one suggested criterion: `totalBudget`, `maxPrice`,
one exact `requiredAmenities` entry, or `checkInDate` (new dates required). The reply
states that no cause has been diagnosed. No diagnostic availability query is made.
`relaxationDecision` extracted as `ACCEPT`, `REJECT`, or `NONE` handles follow-up; exact
short “đồng ý” and “không” replies are handled deterministically. Rejecting clears the
proposal without querying Spring. Accepting a suggested amenity removal removes only
that requirement and performs a new search. Accepting a budget or date suggestion
requires the customer to supply a concrete new amount or dates before a new search.
An explicit edit such as “tăng lên 1,2 triệu” updates the proposed bound and triggers
one new live search. The new result can still be `NO_MATCH`; no availability is promised.

`ConversationResponse` contains `status`, Vietnamese `reply`, updated `state`,
`clarificationFields`, `result` (a complete `RecommendationResult` or null), and `requestId`.
The statuses are:

| Status | Meaning | Backend availability call |
|---|---|---|
| `NEEDS_CLARIFICATION` | Missing or ambiguous critical input; unresolved values remain in `state.pending` | No |
| `UNSUPPORTED` | Multiple rooms, all-costs budget scope, or unrelated intent | No |
| `RECOMMENDED` | One or more current backend rooms match | Yes |
| `NO_MATCH` | Complete criteria but no eligible backend room; a rejected proposal may return `result: null` without requery | One on search, zero on rejection |

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
