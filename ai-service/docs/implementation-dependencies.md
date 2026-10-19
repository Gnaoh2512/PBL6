# AI implementation dependencies and order

Statuses in this document reflect repository evidence, not backlog wording.

| Order | Task | Depends on | Current status | Completion criteria |
|---:|---|---|---|---|
| 0 | `BOOT-01` FastAPI bootstrap | None | Implemented and verified | Uvicorn starts; `/health` returns 200 without backend/DB/LLM; tests and lint pass. |
| 1 | `CONTRACT-01` Versioned integration contract | Backend/API review | Draft completed in docs | Product/backend approval of auth exposure, timeouts, request ID, error mappings, currency, timezone; contract marked final. |
| 2 | `REC-01` Recommendation V1 scope | Backend schema/API review | Technical proposal completed | Product approves concrete-room/single-property scope and proposed `topK`. |
| 3 | `SEC-01` Service authentication | Final CONTRACT-01 | FastAPI inbound token check implemented; Spring caller pending | Spring and FastAPI read opaque service token from runtime secrets; unauthorized internal calls fail; no JWT secret sharing. |
| 4 | `TRACE-01` Request-ID propagation | Final CONTRACT-01 | Not implemented | Spring creates/validates/echoes `X-Request-ID`; FastAPI propagates it; logs correlate both services without sensitive data. |
| 5 | `BFF-01` Spring AI facade | SEC-01, TRACE-01 | Not implemented | Existing Spring monolith exposes the approved `/api/ai/*` routes, validates JWT/input, calls FastAPI with timeouts, maps errors to `ApiResponse`. |
| 6 | `BACKEND-CLIENT-01` AI backend read client | CONTRACT-01 draft | Implemented and unit-tested for availability | Reusable async client validates `ApiResponse<AvailableRoomResponse[]>`; propagates a validated request ID without auth; timeout/connection/HTTP/schema failures remain distinct; no retry or direct DB access. A separate room-types call is unnecessary because availability embeds `RoomTypeResponse`. |
| 7 | `REC-02` Recommendation input/candidate models | REC-01 draft, BACKEND-CLIENT-01 | Implemented in FastAPI; BFF/product approval pending | Request, preferences, backend candidate/envelope, output, Decimal money, and draft `topK` models have HTTP binding. Spring BFF integration and approved product contract remain. |
| 8 | `REC-03` Hard-constraint pipeline | REC-02 | Implemented and unit-tested | One live availability call is the only candidate source; capacity/type/inclusive price checks and duplicate policy are deterministic; inconsistent backend candidates fail rather than becoming `NO_MATCH`. |
| 9 | `REC-04` Deterministic soft scoring | REC-03 | Implemented and unit-tested internally | Exact normalized amenity-token ratio, grounded reasons, stable score/price/room-ID ordering, and post-ranking `topK` have invariant tests. Product approval and evaluation remain outstanding. |
| 10 | `REC-05` Recommendation HTTP endpoint | REC-04, SEC-01, TRACE-01 | Implemented locally and contract-tested; Spring facade pending | Internal endpoint implements versioned contract including OK/NO_MATCH/errors; contract tests pass. |
| 11 | `REC-EVAL-01` Recommendation evaluation | REC-05 | Not implemented | Dataset covers no-match, budget, capacity, overlap, date boundaries, malformed backend data, deterministic rank, and topK. |
| 12 | `KNOW-01` Approved knowledge corpus | Business owners | Not started | FAQ/policies/overview/room descriptions have owner, version, effective date, locale, and approval; no live/PII data. |
| 13 | `PROVIDER-ADR-01` Provider/vector decision | Requirements/cost/deployment | Not started | ADR selects LLM, embedding model, and vector store with dimensions, cost/privacy, fallback, and secret handling. |
| 14 | `RAG-01` Knowledge schema and ingestion | KNOW-01, PROVIDER-ADR-01 | Not implemented | Source/version/hash metadata; idempotent ingest/re-index/delete; loader/chunker/vector integration tests. |
| 15 | `RAG-02` Retrieval | RAG-01 | Not implemented | Locale/source scoping, threshold, no-answer path, citations, retrieval evaluation. |
| 16 | `RAG-03` Generation | RAG-02 | Not implemented | Grounded answers only, structured output validation, prompt-injection defenses, provider failure handling. |
| 17 | `RAG-04` Chat HTTP endpoint | RAG-03, SEC-01, TRACE-01 | Not implemented | Implements ANSWERED/NO_ANSWER/error contract; no fabricated response; contract tests pass. |
| 18 | `RAG-EVAL-01` RAG evaluation | RAG-04 | Not implemented | Vietnamese answerable/no-answer/ambiguous set; retrieval and faithfulness thresholds agreed and measured. |

## Critical dependency paths

```text
CONTRACT-01 approval
    -> SEC-01 + TRACE-01
    -> BFF-01

REC-01 approval
    -> BACKEND-CLIENT-01
    -> REC-02 -> REC-03 -> REC-04 -> REC-05 -> REC-EVAL-01

KNOW-01 + PROVIDER-ADR-01
    -> RAG-01 -> RAG-02 -> RAG-03 -> RAG-04 -> RAG-EVAL-01
```

Recommendation implementation can start before LLM/vector selection because hard filtering and
ranking are deterministic. RAG implementation cannot proceed past schema-level work until an
approved corpus and provider/vector ADR exist.

## Backend gaps affecting the sequence

| Gap | Repository evidence | Blocks |
|---|---|---|
| No AI BFF/controller or Java outbound HTTP client | Controller inventory under `BE/src/main/java/com/example/pbl6/controller`; no AI route/client dependency in `BE/pom.xml:32-95` | BFF-01 and end-to-end integration |
| No service-to-service auth implementation | Only user JWT chain exists in `BE/src/main/java/com/example/pbl6/security/SecurityConfig.java:43-65` | Production exposure of FastAPI business routes |
| No request-ID filter/interceptor | Security/filter package at `BE/src/main/java/com/example/pbl6/security`; no request-ID implementation | Cross-service tracing; not local algorithm development |
| No explicit currency field | `BE/src/main/java/com/example/pbl6/dto/room/AvailableRoomResponse.java:24-31` | Correct user-facing currency label; numeric filtering can still be developed |
| No configured hotel business timezone | Date fields are `LocalDate` in `BE/src/main/java/com/example/pbl6/dto/room/RoomSearchRequest.java:11-26`; no timezone property in `BE/src/main/resources/application.properties:1-25` | Exact “today” behavior around date boundaries |
| No Hotel/Property model | Schema begins with room types/rooms in `BE/src/main/resources/hotel_management.sql:36-68` | Multi-hotel recommendation; does not block concrete-room V1 |
| Free-form amenities text | `BE/src/main/java/com/example/pbl6/entity/RoomType.java:30-34` | Exact amenity hard filtering; does not block soft matching V1 |
| Availability requires current `room.status=AVAILABLE` | `BE/src/main/java/com/example/pbl6/repository/RoomRepository.java:16-30` | Product correctness for future-date inventory requires backend review |
| Booking creation does not visibly recheck capacity | Status/overlap checks at `BE/src/main/java/com/example/pbl6/service/CustomerBookingServiceImpl.java:65-84` | End-to-end capacity guarantee requires backend fix/review |
