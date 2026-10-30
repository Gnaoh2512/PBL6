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
   amounts. Defensively recheck capacity, optional room type, and inclusive per-night price bounds.
5. Rank the remaining candidates by exact amenity-token score descending. For equal scores,
   use `sortBy` as a price tie-breaker: `PRICE_DESC` means per-night price descending;
   `PRICE_ASC` or omitted `sortBy` means per-night price ascending. If price also ties,
   use integer `roomId` ascending. Backend response order does not decide the final rank.
6. Apply `topK` after filtering, deduplication, and ranking.

An empty availability response or an empty eligible set returns `NO_MATCH`. Timeout, connection,
HTTP, invalid-envelope, inconsistent-candidate, and conflicting-duplicate failures keep their backend error category and
never become `NO_MATCH`.

The pipeline does not query a room catalogue, cache, vector store, LLM, or database. Soft scoring
cannot restore a candidate rejected by hard filtering.

## Amenity parsing and scoring

The schema stores amenities as free-form `TEXT`, while current seed data and the synthetic test
fixture use comma-separated items
(`BE/src/main/resources/hotel_management.sql:250-253` and
`ai-service/tests/fixtures/available_rooms_success.json`). The implementation therefore:

- splits backend amenity text only on commas;
- normalizes each complete token with Unicode NFKC, case folding, and collapsed whitespace;
- removes duplicate requested tokens after the same normalization;
- requires exact normalized-token equality;
- does not remove diacritics, use substring matching, translate, or generate synonyms.

For `R` distinct, non-blank requested amenities and `M` exact matches:

```text
score = M / R
```

When `R = 0`, all candidates receive score `0` and empty reasons. Reasons use only the exact
matched token from backend data, for example `Exact amenity token matched: Minibar`. A request for
`ban công` does not prove a match against the longer token `Ban công ngắm cảnh biển`.

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
