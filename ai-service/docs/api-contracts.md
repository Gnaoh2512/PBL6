# Planned AI API contracts (superseded draft)

The versioned contract is now
[`contracts/ai-integration-v1.md`](contracts/ai-integration-v1.md). Recommendation scope and
hard-constraint rules are in
[`recommendation-v1-scope.md`](recommendation-v1-scope.md). This file is retained only as the
original bootstrap draft and must not be treated as the current contract.

These contracts are design targets only. The bootstrap implements only `GET /health`.
`POST /api/v1/ai/chat` and `POST /api/v1/ai/recommendations` must return `404` until their
application use cases are implemented; the service must not return fabricated AI responses.

## Common integration rules

- Browser and mobile clients should call the Spring Boot BFF, not the private AI service.
- End-user authentication and authorization remain owned by Spring Security.
- Spring-to-AI service authentication is required for production, but its credential/header
  contract is not yet implemented or named.
- Dates use ISO 8601 `YYYY-MM-DD`.
- Money fields are JSON decimal numbers in the same unit returned by the backend. Currency must
  not be guessed until the backend contract declares it explicitly.
- A successful AI response must carry a request ID once request tracing is implemented.

## `POST /api/v1/ai/chat` — planned, not implemented

Purpose: answer questions from approved FAQ, policy, hotel overview, and room-description
sources. Live price, availability, booking, payment, or history questions must use backend data
rather than vector retrieval.

Planned request:

```json
{
  "message": "Phòng Deluxe có những tiện nghi gì?",
  "conversation_id": "optional-client-conversation-id",
  "locale": "vi"
}
```

Fields:

| Field | Required | Rules |
|---|---:|---|
| `message` | yes | Non-empty user question; maximum length will be fixed with the RAG task. |
| `conversation_id` | no | Opaque correlation value; not proof of identity. |
| `locale` | no | Defaults to `vi`; supported values depend on approved knowledge. |

Planned response:

```json
{
  "answer": "...",
  "sources": [
    {
      "document_id": "room-guide",
      "section": "deluxe",
      "title": "Hướng dẫn hạng phòng",
      "version": "2026-10-09"
    }
  ],
  "request_id": "request-id"
}
```

An answer must be grounded in returned sources. When approved context is insufficient, the
endpoint must say it cannot confirm the answer instead of inventing hotel policy.

## `POST /api/v1/ai/recommendations` — planned, not implemented

The current backend represents rooms and room types in one property, not multiple hotels.
Therefore this V1 contract recommends available rooms/room types. A multi-hotel contract must
wait for authoritative hotel, location, rating, and property-facility data.

Planned request:

```json
{
  "check_in_date": "2026-11-10",
  "check_out_date": "2026-11-12",
  "guests": 2,
  "room_type_id": null,
  "min_price": 500000,
  "max_price": 1500000,
  "sort_by": "PRICE_ASC",
  "preferences": {
    "amenities": ["ban công", "minibar"]
  },
  "top_k": 5
}
```

Hard-constraint mapping to the existing backend:

| AI request | Backend `GET /api/public/rooms/available` |
|---|---|
| `check_in_date` | `checkInDate` (required) |
| `check_out_date` | `checkOutDate` (required) |
| `guests` | `guestCount` |
| `room_type_id` | `roomTypeId` |
| `min_price` | `minPrice` |
| `max_price` | `maxPrice` |
| `sort_by` | `sortBy`, currently `PRICE_ASC` or `PRICE_DESC` |

`check_out_date` must be after `check_in_date`; `guests` and `top_k` must be positive. The exact
upper bounds will be fixed with the recommendation implementation.

Planned response:

```json
{
  "recommendations": [
    {
      "room_id": 201,
      "room_number": "201",
      "room_type": {
        "room_type_id": 2,
        "type_name": "Phòng Deluxe Hướng Biển",
        "capacity": 2,
        "amenities": "Wifi, TV 4K, ban công, minibar"
      },
      "price_per_night": 850000,
      "total_room_charge": 1700000,
      "estimated_deposit": 510000,
      "score": 0.85,
      "reasons": ["Có ban công", "Có minibar"]
    }
  ],
  "availability_checked_at": "2026-10-09T15:00:00+07:00",
  "request_id": "request-id"
}
```

Every returned candidate must originate from the live backend availability response for the
same dates and constraints. Scoring may only reorder valid candidates. A recommendation is not
a reservation; `POST /api/public/bookings` must revalidate and create the booking.

## Backend data access

The first implementation should reuse these existing Spring Boot APIs:

| Need | Existing backend API | Use |
|---|---|---|
| Room types and stable room descriptions | `GET /api/public/rooms/room-types` | Knowledge preparation and candidate features. |
| Live price and availability | `GET` or `POST /api/public/rooms/available` | Mandatory per recommendation request. |
| Voucher preview | `POST /api/public/vouchers/apply` | Only when the user provides a voucher and final-price preview is in scope. |
| Booking creation | `POST /api/public/bookings` | Owned by backend/frontend flow, not recommendation scoring. |
| User booking/history data | Authenticated customer APIs | Only with explicit product scope and authorization. |

Direct MySQL access is not justified for the current scope. It would bypass backend validation,
authorization, pricing, and availability rules. If a future bulk export cannot be served by an
API, any direct database integration requires a separately approved read-only account, access
to explicitly allowlisted views, network isolation, and no access to customer/payment tables.

The current backend has no service-to-service credential endpoint. Local bootstrap may read the
public catalogue/availability APIs, but production integration must add an authenticated
internal contract or have the Spring BFF pass normalized candidates to FastAPI.

## Planned error envelope

```json
{
  "error": {
    "code": "BACKEND_UNAVAILABLE",
    "message": "Unable to retrieve current availability",
    "request_id": "request-id",
    "details": null
  }
}
```

Validation, unavailable backend, timeout, insufficient knowledge, and provider failure must be
distinguishable. Error responses and logs must not contain tokens, service credentials, request
bodies with personal data, or provider secrets.
