# Internal recommendation pipeline

Status: implemented against the `1.0.0-draft` contract and exposed through the authenticated
FastAPI recommendation endpoint. This does not approve REC-01 product choices.

## Pipeline

1. Validate the typed `RecommendationRequest` and `X-Request-ID`.
2. Call `POST /api/public/rooms/available` exactly once with dates, guest count, optional room
   type, optional per-night price bounds, and backend `sortBy`.
3. Use only candidates from that response. Collapse model-equivalent duplicate
   `roomId` records; conflicting records for one `roomId` make the response invalid.
4. Reject candidates with a non-available status, mismatched dates/night count, or negative
   amounts. Defensively recheck capacity, optional room type, inclusive per-night price bounds,
   optional inclusive `totalBudget` against backend `totalRoomCharge`,
   and every `requiredAmenities` code against verified backend amenity evidence.
5. Rank the remaining candidates by the versioned multi-criteria score descending. For equal scores,
   use `sortBy` as a price tie-breaker: `PRICE_DESC` means per-night price descending;
   `PRICE_ASC` or omitted `sortBy` means per-night price ascending. If price also ties,
   use integer `roomId` ascending. Backend response order does not decide the final rank.
6. Apply `topK` after filtering, deduplication, and ranking.

An empty availability response or an empty eligible set returns `NO_MATCH`. Timeout, connection,
HTTP, invalid-envelope, inconsistent-candidate, and conflicting-duplicate failures keep their backend error category and
never become `NO_MATCH`.

The conversation layer may retain one proposed relaxation in caller state after `NO_MATCH`.
It does not run diagnostic searches or alter dates, budget, capacity, or required amenities
until the customer supplies an explicit edit or accepts the exact amenity removal.
The next search still uses the live availability API once. The total-stay ceiling covers
only the backend's basic room charge, not a final bill.

The active formula, missing-data treatment, comparison baseline, and configurable weights are
documented in [scoring.md](scoring.md). The amenity-only formula below describes the retained
`amenity-baseline-v1` scorer, not the default scorer.

The pipeline does not query a room catalogue, cache, LLM, or database. Soft scoring
cannot restore a candidate rejected by hard filtering.

## Amenity parsing and scoring

The schema stores amenities as free-form `TEXT`, while current seed data and the synthetic test
fixture use comma-separated items
(`BE/src/main/resources/hotel_management.sql:250-253` and
`ai-service/tests/fixtures/available_rooms_success.json`). The implementation therefore:

- splits backend amenity text only on commas;
- normalizes NFKC/NFKD Unicode, case, whitespace and Vietnamese diacritics (`đ` included);
- maps only explicit Vietnamese/English aliases and observed backend phrases to a catalog code;
- counts each requested code once, including aliases such as `wi-fi`/`wifi` and `ban công`/`balcony`;
- treats explicit negative phrases such as `Không có ban công` as `ABSENT`, an exact catalog
  phrase as `PRESENT`, and missing, conflicting or unfamiliar text as `UNKNOWN`;
- admits a room for a required code only when the evidence is `PRESENT`. A preferred code
  contributes to score only when `PRESENT`. No LLM inference is used for room attributes.

The controlled catalog currently covers Wi-Fi, balcony, minibar, TV, air conditioning, bathtub,
water heater, kitchen, living room, king bed and sofa bed. Requests containing an unknown name
or the same code in both required and preferred lists get HTTP 422 in the JSON route. The
conversation route keeps the unresolved field in caller state and asks for a correction. The
original backend `amenities` string remains in each room result and verified raw tokens appear
in reasons. Empty or omitted `requiredAmenities` preserves the prior client behavior.

For `R` distinct, non-blank requested amenities and `M` matches:

```text
score = M / R
```

When `R = 0`, all candidates receive score `0` and empty reasons. Reasons use only the
matched full token from backend data, for example `Amenity preference matched: Ban công ngắm cảnh biển`.

## Synthetic example

Request: two guests, room type 2, price from `500000.00` through `1500000.00`, preferences
`["wifi", "minibar", "wifi"]`, and `topK=2`.

| Room | Capacity/type/price | Backend amenities | Outcome |
|---|---|---|---|
| 10 | 2 / 2 / 700000.00 | `Wifi, Minibar` | score 1; ranked first |
| 20 | 2 / 2 / 650000.00 | `Wifi` | score 0.5; ranked second |
| 30 | 1 / 2 / 500000.00 | `Wifi, Minibar` | removed by capacity; cannot return through scoring |
| 40 | 2 / 9 / 600000.00 | `Wifi, Minibar` | removed by room type |

The price fields remain `Decimal`. `RecommendationResult.to_contract_json()` serializes them as
JSON numbers without a binary floating-point conversion and writes dates/timestamps as ISO
strings. The HTTP endpoint uses that serialization path. The pipeline does not
attach a currency or reinterpret `pricePerNight` as a stay total.

## Responsibility boundary

The AI forwards the exact dates and trusts the live availability endpoint as the authority for
room status and booking overlap (`RoomRepository.java:16-38`). The response does not expose the
underlying bookings, so the AI does not claim to independently verify overlap. Results are not a
hold; booking creation must revalidate availability in Spring
(`CustomerBookingServiceImpl.java:65-84`).

Remaining work before frontend exposure: Spring BFF integration, cross-service request-ID tracing,
and approved product decisions for timezone, currency, and `topK`.
