# AI service bootstrap architecture

## Current boundary

The AI service is a Python/FastAPI sibling of the existing Spring Boot backend.

```text
Frontend
   |
   v
Spring Boot backend (authentication and business source of truth)
   |
   v
FastAPI AI service
   |-- approved knowledge/vector store (future)
   `-- LLM and embedding providers (future, undecided)
```

The Spring Boot backend remains authoritative for authentication, room inventory,
availability, prices, bookings, payments, and user history. The AI service must not write to
the backend database and must not treat embeddings as evidence of live price or availability.

The bootstrap has no LLM, embedding, vector database, or backend HTTP dependency. Therefore
process startup and `GET /health` remain available when every external system is unavailable.

## Package responsibilities

- `domain`: framework-independent RAG and recommendation rules when those features are added.
- `application`: use cases that coordinate domain interfaces.
- `infrastructure`: backend HTTP, vector store, and provider adapters; only logging exists now.
- `presentation`: FastAPI routers and HTTP schemas.
- `config`: validated environment-backed settings.

Only components needed by the running bootstrap are implemented. Empty feature abstractions
have intentionally not been created.

## Integration direction

The preferred production path is frontend to a thin facade in the existing Spring Boot monolith,
then to the private AI service. No such facade or outbound Java HTTP client exists yet; “BFF” does
not mean creating another service. The backend authenticates the end user and forwards only the
minimum context needed by AI. FastAPI receives a separate opaque service credential and must not
receive the backend JWT signing secret. See the
[versioned integration contract](contracts/ai-integration-v1.md).
