# Recommendation V1 scope

| Item | Value |
|---|---|
| Decision ID | `REC-01` |
| Version | `1.0.0-draft` |
| Date | `2026-10-09` |
| Status | Technical proposal awaiting product approval |

The FastAPI recommendation endpoint implements this draft scope locally. Product approval and
Spring integration remain outstanding.

## 1. Proposed scope decision

**Recommend concrete available rooms in the single property represented by the current backend.**

This is not a multi-hotel recommender and not merely a room-type catalogue ranker.

### Why not hotels across the system

The schema has `room_type` and `room`, but no `hotel`/`property` table, hotel ID, city, location,
rating, images, or property-to-room relationship
(`BE/src/main/resources/hotel_management.sql:36-68`; entities at
`BE/src/main/java/com/example/pbl6/entity/RoomType.java:8-34` and
`BE/src/main/java/com/example/pbl6/entity/Room.java:9-40`). Therefore a multi-hotel result would
require invented IDs and features.

### Why not only room types

`GET /api/public/rooms/room-types` provides capacity, base price, amenities, and description, but
does not prove that a physical room is available. The availability API returns concrete rooms,
and booking creation requires an integer `roomId`
(`BE/src/main/java/com/example/pbl6/dto/booking/BookingCreateRequest.java:16-24`).

### Why concrete rooms are feasible

`GET`/`POST /api/public/rooms/available` returns each available room with an integer `roomId`,
room number, floor, nested room type, dates, nights, price per night, total charge, and estimated
deposit (`BE/src/main/java/com/example/pbl6/dto/room/AvailableRoomResponse.java:16-31`). These are
the candidates that can be ranked without fabricating availability.

## 2. V1 request boundary

```json
{
  "checkInDate": "2026-11-10",
  "checkOutDate": "2026-11-12",
  "guestCount": 2,
  "roomTypeId": null,
  "minPrice": 500000,
  "maxPrice": 1500000,
  "sortBy": "PRICE_ASC",
  "preferences": {
    "amenities": ["ban công", "minibar"]
  },
  "topK": 5
}
```

V1 does not accept `hotelId`, city/location/rating filters, `roomCount`, user profile, booking
history, voucher, service usage, or total-stay budget.

Unknown fields should be rejected during validation so unsupported constraints are not silently
ignored.

## 3. Hard constraints

Hard constraints are validated and executed deterministically. LLM output is never used to
accept, reject, price, or declare a room available.

| Input | Validation/check | Official backend source | Missing data/backend failure |
|---|---|---|---|
| `checkInDate` | Required ISO date; must not be before backend “today”. | `RoomSearchRequest.checkInDate` uses `LocalDate`, `@NotNull`, `@FutureOrPresent` (`RoomSearchRequest.java:19-22`). | Missing/invalid: 422 internal → 400 BFF. Do not query availability. |
| `checkOutDate` | Required ISO date and strictly later than check-in. | `RoomSearchRequest.java:24-26`; service rejects non-later checkout (`RoomCatalogServiceImpl.java:56-62`). | Missing/invalid: 422 internal → 400 BFF. |
| `guestCount` | Required by AI contract; integer `>= 1`. Candidate capacity must be `>= guestCount`. | Query predicate `rt.capacity >= :guestCount` (`RoomRepository.java:20`); booking request also requires minimum 1 (`BookingCreateRequest.java:30-32`). | Missing/invalid: reject. Null must not be forwarded even though backend search currently permits it. |
| `roomTypeId` | Optional integer. When supplied, must match candidate room type. | `RoomSearchRequest.roomTypeId` (`RoomSearchRequest.java:28`) and query predicate (`RoomRepository.java:19`). | Unknown ID normally yields no candidates; return `NO_MATCH`, not a fabricated substitute. |
| `minPrice` | Optional decimal `>= 0`; per-night lower bound. | Backend compares `room_type.base_price >= minPrice` (`RoomRepository.java:21`). | Invalid/negative: reject in AI/BFF. |
| `maxPrice` | Optional decimal `>= 0`; per-night upper bound; must be `>= minPrice` when both exist. | Backend compares `room_type.base_price <= maxPrice` (`RoomRepository.java:22`). | Invalid/range inversion: reject. |
| Availability | Candidate must appear in the live availability response for the exact dates and other constraints. | `RoomRepository.findAvailableRooms` (`RoomRepository.java:16-38`). | Timeout/unavailable: return backend error. |
| Physical status | Current query requires `room.status = 'AVAILABLE'`. | `RoomRepository.java:18`. | Respect backend result even for future dates; semantics need backend review but AI must not override it. |
| Booking overlap | Exclude overlaps unless booking is `CANCELED` or `EXPIRED`; overlap rule is start `<` requested checkout and end `>` requested check-in. | `RoomRepository.java:23-28`. | Respect backend result. |

`topK` controls truncation after hard filtering and ranking; it is not a hotel/room eligibility
constraint.

## 4. Dates and timezone

### Confirmed

- Backend request and entities use date-only Java `LocalDate`, not instants
  (`RoomSearchRequest.java:11-26`; `BookingRoom.java:31-35`).
- Check-out must be after check-in.
- Nights are calendar days between the two dates, minimum one
  (`BE/src/main/java/com/example/pbl6/service/financial/FinancialCalculator.java:19-35`).

### Proposed rule

- Contract format is `YYYY-MM-DD`; offsets/times are rejected for these two fields.
- Validation of “today” must ultimately use the hotel's configured business timezone.
- No business timezone is configured in the repository. Until one is added, the backend remains
  authoritative and uses its JVM default timezone. `Asia/Ho_Chi_Minh` is a proposed product
  decision, not a confirmed backend fact.
- `availabilityCheckedAt` is a timezone-aware timestamp generated after receiving the backend
  response; it describes query time, not a hold expiry.

## 5. Guests, rooms, and capacity

- One recommendation candidate is one physical room.
- `guestCount` applies to that single room because the query compares it to one
  `RoomType.capacity` (`RoomRepository.java:20`).
- The booking API accepts one `roomId`, so multi-room booking is not represented
  (`BookingCreateRequest.java:18-19`).
- V1 does not accept `roomCount`. Requests for multiple rooms must be reported as unsupported,
  not split automatically.
- Booking creation currently rechecks room status and overlap
  (`CustomerBookingServiceImpl.java:65-84`) but does not visibly recheck capacity. Until backend
  closes that gap, the AI/BFF must preserve `guestCount` and only offer candidates returned by
  the availability API.

## 6. Budget, currency, tax, and fees

### Budget

V1 `minPrice` and `maxPrice` mean **price per room per night**, because that is what the existing
repository query compares against `RoomType.basePrice`. They do not mean the total stay budget.

The backend calculates:

```text
totalRoomCharge = pricePerNight * nights
```

and returns both fields (`RoomCatalogServiceImpl.java:93-109`). The recommendation service copies
these backend-calculated values; it does not recalculate or round them independently.

### Currency

The backend DTOs expose `BigDecimal` amounts without a currency field. Repository examples imply
Vietnamese hotel pricing, but V1 must not label amounts as `VND` until backend/product explicitly
confirms the currency. Currency is therefore an open contract decision.

### Tax, discount, services, and deposit

- Availability `totalRoomCharge` is room base price times nights. It does not include service
  usage, voucher discount, or tax.
- The availability response includes an estimated deposit
  (`AvailableRoomResponse.java:24-31`).
- Tax exists as a 10% financial calculation for later invoice/settlement flows
  (`FinancialCalculator.java:48-66`) but is not included by the availability endpoint.
- Recommendation must not present `totalRoomCharge` as the final checkout total.
- Voucher preview is outside REC V1. If added later, use the backend voucher endpoint rather than
  duplicating discount rules.

## 7. Availability and booking revalidation

1. Validate required fields and ranges.
2. Call `POST /api/public/rooms/available` with the exact hard constraints.
3. Treat only `ApiResponse.data` rooms as eligible.
4. Rank eligible rooms using deterministic soft-preference scoring.
5. Return `availabilityCheckedAt` and clarify that results are not held.
6. Frontend creates a booking through the existing backend `POST /api/public/bookings`.
7. Backend reloads the room, checks current physical status and booking overlap, then snapshots
   `basePrice` into `booking_room.price_applied`
   (`CustomerBookingServiceImpl.java:65-95,138-147`).

Recommendation success does not reserve inventory or guarantee a price. A failed/changed booking
response replaces the earlier recommendation state.

The current backend checks overlap in application code without a visible database lock,
exclusion constraint, or entity version. AI must never claim a room is held before booking
creation succeeds.

## 8. Soft preferences and ranking

Soft input is `preferences.amenities: string[]`; optional top-level `requiredAmenities: string[]`
is a hard constraint. Both default to empty lists for existing clients.

The current API accepts at most 20 amenity strings, each at most 100 characters. These are
operational input limits; requests beyond them return 422.

- Amenities come from `RoomType.amenities`, currently free-form `TEXT`
  (`RoomType.java:30-34`).
- Amenity matching may change ordering but may not restore a room removed by hard filtering.
- Normalize case/whitespace/diacritics consistently and document the chosen matching method.
- A reason must be derived from the candidate's actual amenities/description.
- The controlled catalog maps known aliases to codes. Unknown request names return 422 or
  prompt clarification. Missing backend evidence cannot satisfy a required code; it contributes
  no preference score.
- The conversation endpoint parses Vietnamese into validated criteria; typed hard constraints
  and the deterministic scorer remain authoritative.

`sortBy` is passed to the backend as `PRICE_ASC` or `PRICE_DESC` when supplied. The AI service
always ranks valid rooms by amenity score descending first. For equal scores, `PRICE_DESC` sorts
`pricePerNight` descending; `PRICE_ASC` or omitted `sortBy` sorts it ascending. Equal score and
price are resolved by `roomId` ascending. Backend response order does not override this rule.

## 9. `topK`

Proposed validation:

- Default: `5`.
- Minimum: `1`.
- Maximum: `20`.
- Apply after hard filtering and scoring.
- If fewer candidates exist, return all of them.
- `0`, negative, non-integer, or values above 20 return validation error; do not silently clamp.

These bounds are service-operational defaults and require product approval before the draft
contract becomes final.

## 10. Failure and no-result behavior

| Situation | Result |
|---|---|
| Required date/guest missing | Validation error; no backend call |
| Invalid date order or price range | Validation error; no backend call |
| Availability returns an empty list | HTTP 200, `status=NO_MATCH`, empty recommendations |
| Backend timeout/unavailable | 504/502 contract error; no cached fallback |
| Unsupported multi-room or multi-hotel request | Validation/unsupported-scope error |
| Missing optional preferences | Rank deterministically using neutral preference score and backend order/tie-breaker |
| Price/availability absent from candidate | Reject that malformed candidate and surface integration failure if contract validation fails |

## 11. Acceptance criteria for REC-01

REC-01 documentation is complete when:

- the chosen technical scope is concrete rooms in one property;
- every hard constraint maps to an existing backend field/query;
- date, guest, budget, currency, tax, availability, booking revalidation, and `topK` rules are
  explicit;
- product-open decisions are labeled as proposals;
- only the Spring availability response is authoritative for eligibility, price, and availability.

Product acceptance is still required before this draft becomes an approved integration contract.

## 12. Backend source index

Short source references in this document resolve to these repository paths:

| Source | Repository path |
|---|---|
| `hotel_management.sql` | `BE/src/main/resources/hotel_management.sql` |
| `Room.java` | `BE/src/main/java/com/example/pbl6/entity/Room.java` |
| `RoomType.java` | `BE/src/main/java/com/example/pbl6/entity/RoomType.java` |
| `BookingRoom.java` | `BE/src/main/java/com/example/pbl6/entity/BookingRoom.java` |
| `RoomSearchRequest.java` | `BE/src/main/java/com/example/pbl6/dto/room/RoomSearchRequest.java` |
| `AvailableRoomResponse.java` | `BE/src/main/java/com/example/pbl6/dto/room/AvailableRoomResponse.java` |
| `BookingCreateRequest.java` | `BE/src/main/java/com/example/pbl6/dto/booking/BookingCreateRequest.java` |
| `PublicRoomController.java` | `BE/src/main/java/com/example/pbl6/controller/PublicRoomController.java` |
| `RoomRepository.java` | `BE/src/main/java/com/example/pbl6/repository/RoomRepository.java` |
| `RoomCatalogServiceImpl.java` | `BE/src/main/java/com/example/pbl6/service/RoomCatalogServiceImpl.java` |
| `CustomerBookingServiceImpl.java` | `BE/src/main/java/com/example/pbl6/service/CustomerBookingServiceImpl.java` |
| `FinancialCalculator.java` | `BE/src/main/java/com/example/pbl6/service/financial/FinancialCalculator.java` |
