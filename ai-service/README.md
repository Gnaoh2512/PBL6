# AI Service

AI Service for the PBL6 Hotel Booking System.

The service is responsible for AI-related capabilities such as:

- Retrieval-Augmented Generation (RAG)
- Hotel recommendation
- Knowledge retrieval
- Embedding generation
- AI evaluation

The AI Service is developed independently from the main Backend Service and communicates with it through HTTP APIs.

---

# 1. Technology Stack

| Category | Technology | Purpose |
|---|---|---|
| Language | Python 3.12+ | Main programming language |
| API Framework | FastAPI | Build AI HTTP APIs |
| ASGI Server | Uvicorn | Run FastAPI application |
| Validation | Pydantic v2 | Request/response and domain validation |
| Configuration | pydantic-settings | Environment configuration |
| HTTP Client | httpx | Communicate with Backend Service |
| LLM | OpenAI / Gemini | Natural language generation |
| Embedding | OpenAI / Gemini Embedding | Generate semantic vectors |
| Vector Database | PostgreSQL + pgvector | Store and search embeddings |
| Vector Platform | Supabase | Managed PostgreSQL + pgvector |
| Testing | pytest | Unit and integration testing |
| Linting | Ruff | Python linting and formatting |

AI frameworks such as LangChain and LlamaIndex are intentionally not required in the first version.

The initial RAG pipeline is implemented explicitly so that document loading, chunking, embedding, retrieval, prompt construction and generation remain understandable and controllable.

---

# 2. Service Responsibilities

The AI Service owns:

```text
RAG
Embedding
Vector Retrieval
Prompt Construction
LLM Generation
Hotel Recommendation
AI Evaluation
```

The AI Service does NOT own:

```text
Authentication
Authorization
User Management
Hotel CRUD
Room CRUD
Booking Transactions
Payment
Room Inventory
Booking State
```

These responsibilities belong to the Backend Service.

---

# 3. System Architecture

```text
                Frontend / Mobile
                        |
                        v
                 Backend Service
                  Node.js / TS
                        |
                        | HTTP
                        v
                  AI Service
                    FastAPI
                        |
             +----------+----------+
             |                     |
             v                     v
            RAG             Recommendation
             |                     |
             v                     v
       Vector Store          Backend API
             |
             v
      Embedding Provider
             |
             v
            LLM
```

The Backend Service remains the source of truth for transactional data.

The AI Service provides intelligence on top of that data.

---

# 4. AI Scope

The first version of the AI Service contains two AI capabilities.

## 4.1 RAG

RAG is responsible for answering questions related to hotel knowledge.

Examples:

```text
Khách sạn có cho mang thú cưng không?

Giờ check-in là mấy giờ?

Khách sạn có bãi đỗ xe không?

Nếu hủy phòng trước 3 ngày thì có mất phí không?

Phòng Deluxe có những tiện ích gì?
```

RAG is suitable for relatively stable knowledge such as:

- Hotel overview
- Hotel facilities
- Hotel policies
- Check-in/check-out policies
- Cancellation policies
- Pet policies
- Parking information
- Breakfast information
- Room descriptions
- Hotel FAQ

RAG must NOT be used as the source of truth for realtime data such as:

- Current room availability
- Current room price
- Current booking state
- Payment status
- User booking history

Realtime information must come from Backend APIs.

---

## 4.2 Hotel Recommendation

The Recommendation module suggests hotels based on user constraints and preferences.

Example:

```text
Tìm khách sạn ở Đà Nẵng

Ngân sách dưới 2 triệu

2 người

Muốn gần biển

Có hồ bơi
```

The recommendation pipeline separates:

### Hard Constraints

Conditions that MUST be satisfied.

Examples:

```text
city
guest capacity
budget
room availability
```

A hotel that violates a hard constraint must not be recommended.

### Soft Preferences

Conditions used to rank valid candidates.

Examples:

```text
pool
breakfast
gym
beach
location preference
rating
```

---

# 5. Repository Structure

```text
ai-service/
│
├── README.md
├── pyproject.toml
├── .env
├── .env.example
├── .gitignore
│
├── docs/
│   │
│   ├── architecture/
│   │   ├── overview.md
│   │   └── ai-service.md
│   │
│   └── pipelines/
│       ├── rag-pipeline.md
│       └── recommendation-pipeline.md
│
├── knowledge/
│   ├── faq.md
│   ├── hotel_overview.md
│   ├── hotel_policies.md
│   └── room_guide.md
│
├── scripts/
│   └── ingest_documents.py
│
├── src/
│   └── ai_service/
│       │
│       ├── main.py
│       │
│       ├── config/
│       │   ├── __init__.py
│       │   └── settings.py
│       │
│       ├── domain/
│       │   │
│       │   ├── rag/
│       │   │   ├── __init__.py
│       │   │   ├── entities.py
│       │   │   ├── interfaces.py
│       │   │   └── types.py
│       │   │
│       │   └── recommendation/
│       │       ├── __init__.py
│       │       ├── entities.py
│       │       ├── interfaces.py
│       │       └── types.py
│       │
│       ├── application/
│       │   │
│       │   ├── rag/
│       │   │   ├── dto.py
│       │   │   ├── ingest_documents.py
│       │   │   └── answer_question.py
│       │   │
│       │   └── recommendation/
│       │       ├── dto.py
│       │       └── recommend_hotels.py
│       │
│       ├── infrastructure/
│       │   │
│       │   ├── llm/
│       │   │   └── openai_llm.py
│       │   │
│       │   ├── embeddings/
│       │   │   └── openai_embedding.py
│       │   │
│       │   ├── vector_store/
│       │   │   └── pgvector_store.py
│       │   │
│       │   ├── rag/
│       │   │   ├── document_loader.py
│       │   │   ├── normalizer.py
│       │   │   ├── chunker.py
│       │   │   ├── retriever.py
│       │   │   └── prompt_builder.py
│       │   │
│       │   └── clients/
│       │       └── backend_client.py
│       │
│       └── presentation/
│           └── http/
│               │
│               ├── dependencies.py
│               │
│               ├── schemas/
│               │   ├── rag.py
│               │   └── recommendation.py
│               │
│               └── routers/
│                   ├── health.py
│                   ├── rag.py
│                   └── recommendation.py
│
└── tests/
    │
    ├── unit/
    │   ├── rag/
    │   └── recommendation/
    │
    ├── integration/
    │   ├── test_rag_pipeline.py
    │   └── test_recommendation_pipeline.py
    │
    └── conftest.py
```

---

# 6. Architecture

The project follows Hexagonal Architecture principles.

```text
                 Presentation
                      |
                      v
                 Application
                      |
                      v
                    Domain
                      ^
                      |
               Infrastructure
```

Dependencies point toward the domain.

---

## Domain

```text
domain/
├── rag/
└── recommendation/
```

Contains core models and interfaces.

The domain must not depend on:

- FastAPI
- OpenAI SDK
- Gemini SDK
- Supabase
- pgvector implementation
- httpx
- environment variables

---

## Application

```text
application/
├── rag/
└── recommendation/
```

Contains use cases.

Examples:

```text
AnswerQuestion
IngestDocuments
RecommendHotels
```

Application use cases coordinate domain interfaces but should not know the implementation details of external providers.

---

## Infrastructure

```text
infrastructure/
```

Contains technology-specific implementations.

Examples:

```text
OpenAI
Embedding Provider
Supabase
pgvector
Backend HTTP Client
Document Loader
Retriever
```

Example dependency:

```text
AnswerQuestionUseCase
        |
        v
    LLMProvider
        ^
        |
   OpenAILLM
```

Changing the LLM provider should not require changing the use case.

---

## Presentation

```text
presentation/http/
```

Responsible for:

- HTTP request handling
- HTTP response handling
- Pydantic request validation
- Status codes
- Dependency injection

Presentation must not contain:

- Vector search logic
- Recommendation scoring
- Prompt construction
- Embedding logic
- LLM-specific logic

---

# 7. RAG Architecture

The RAG system has two main pipelines:

```text
Ingestion Pipeline
Query Pipeline
```

---

# 8. RAG Ingestion Pipeline

```text
knowledge/*.md
      |
      v
Document Loader
      |
      v
Text Normalizer
      |
      v
Chunker
      |
      v
Embedding Provider
      |
      v
Vector Store
```

The ingestion entry point is:

```text
scripts/ingest_documents.py
```

Run:

```bash
python scripts/ingest_documents.py
```

---

## Knowledge Documents

Current knowledge directory:

```text
knowledge/
├── faq.md
├── hotel_overview.md
├── hotel_policies.md
└── room_guide.md
```

Documents should preferably use meaningful Markdown structure.

Example:

```markdown
# Hotel Policies

## Check-in Policy

Check-in is available from 14:00.

## Check-out Policy

Guests must check out before 12:00.

## Pet Policy

Pets are not allowed.
```

---

# 9. Chunking Strategy

The initial strategy uses:

```text
Structure-aware chunking
        +
Token / size limitation
```

Document structure should be preserved whenever possible.

Example:

```markdown
## Pet Policy
```

should normally become a separate semantic chunk from:

```markdown
## Cancellation Policy
```

Avoid blindly splitting every fixed number of characters when doing so destroys semantic structure.

---

## Chunk Metadata

Example:

```json
{
  "chunk_id": "hotel_001_pet_policy_001",
  "document_id": "hotel_policies",
  "hotel_id": "hotel_001",
  "section": "pet_policy",
  "language": "vi",
  "source": "knowledge/hotel_policies.md"
}
```

Each chunk should be traceable back to its original document.

---

# 10. Embedding

Documents and user queries must use compatible embedding models.

Conceptually:

```text
Document
   |
   v
Embedding Model
   |
   v
Vector
```

and:

```text
User Question
     |
     v
Embedding Model
     |
     v
Query Vector
```

Semantic similarity is calculated between these vectors.

The embedding provider must be accessed through an interface instead of directly from application use cases.

---

# 11. Vector Database

The initial vector database is:

```text
Supabase
   +
PostgreSQL
   +
pgvector
```

The vector store is responsible for:

```text
Insert chunks
Store embeddings
Similarity search
Metadata filtering
Delete old chunks
Re-index documents
```

Application code should depend on a vector-store interface rather than Supabase directly.

---

# 12. RAG Query Pipeline

```text
User Question
      |
      v
Query Embedding
      |
      v
Vector Search
      |
      v
Metadata Filtering
      |
      v
Similarity Threshold
      |
      v
Relevant Chunks
      |
      v
Prompt Builder
      |
      v
LLM
      |
      v
Answer + Sources
```

Default retrieval configuration:

```text
TOP_K = 5
```

Similarity threshold must be configurable.

---

## Hotel-scoped Retrieval

If the user is currently asking about:

```text
hotel_id = hotel_001
```

retrieval should be restricted to:

```text
hotel_id = hotel_001
```

The RAG system must not retrieve a policy belonging to another hotel.

---

# 13. RAG Generation Rules

The LLM must answer using retrieved context.

The system prompt should enforce rules similar to:

```text
Answer using only the provided hotel context.

If the information cannot be found in the context,
state that the information is unavailable.

Do not invent:

- hotel policies
- hotel facilities
- prices
- room availability
- booking information
```

RAG responses should contain references to their sources where possible.

Example:

```json
{
  "answer": "Khách sạn không cho phép mang thú cưng.",
  "sources": [
    {
      "document_id": "hotel_policies",
      "section": "pet_policy"
    }
  ]
}
```

---

# 14. Recommendation Architecture

```text
User Preferences
       |
       v
Fetch Candidates
       |
       v
Hard Constraint Filter
       |
       v
Valid Candidates
       |
       v
Feature Scoring
       |
       v
Final Score
       |
       v
Ranking
       |
       v
Top-K Hotels
```

Recommendation does not use the LLM to decide which hotels satisfy hard constraints.

Structured data should be used whenever structured data is available.

---

# 15. Recommendation Scoring

Initial scoring can use a weighted model.

Example:

```text
score =
    0.35 * amenity_match
  + 0.25 * price_match
  + 0.20 * location_match
  + 0.20 * rating_score
```

These weights are only an initial design and should be evaluated before being considered final.

Weights must be configurable.

---

## Recommendation Explanation

A recommendation can include reasons such as:

```json
{
  "hotel_id": "hotel_001",
  "score": 0.87,
  "reasons": [
    "Within requested budget",
    "Has swimming pool",
    "Matches beach preference"
  ]
}
```

Reasons must come from actual hotel features.

The AI must not fabricate recommendation reasons.

---

# 16. Backend Integration

The AI Service does not directly access Backend-owned transactional tables.

Use:

```text
AI Service
     |
     | HTTP
     v
Backend Service
     |
     v
PostgreSQL
```

Example:

```text
Recommendation Use Case
        |
        v
 HotelDataProvider
        |
        v
 BackendClient
        |
        v
 Backend API
```

An interface may look like:

```python
class HotelDataProvider(Protocol):

    async def search_hotels(
        self,
        criteria: HotelSearchCriteria,
    ) -> list[HotelCandidate]:
        ...
```

The application layer must not call `httpx` directly.

---

# 17. HTTP API

Base API:

```text
/api/v1/ai
```

---

## Health Check

```http
GET /health
```

Response:

```json
{
  "status": "ok",
  "service": "ai-service"
}
```

---

## RAG Chat

```http
POST /api/v1/ai/chat
```

Request:

```json
{
  "message": "Khách sạn có cho mang thú cưng không?",
  "hotel_id": "hotel_001"
}
```

Response:

```json
{
  "answer": "Khách sạn không cho phép mang thú cưng.",
  "sources": [
    {
      "document_id": "hotel_policies",
      "section": "pet_policy"
    }
  ]
}
```

---

## Recommendation

```http
POST /api/v1/ai/recommendations
```

Request:

```json
{
  "city": "Da Nang",
  "budget_max": 2000000,
  "guests": 2,
  "preferences": [
    "pool",
    "beach"
  ],
  "top_k": 5
}
```

Response:

```json
{
  "hotels": [
    {
      "hotel_id": "hotel_001",
      "score": 0.87,
      "reasons": [
        "Within requested budget",
        "Has swimming pool",
        "Matches beach preference"
      ]
    }
  ]
}
```

---

# 18. Environment Variables

Runtime configuration must come from environment variables.

Create:

```text
.env
```

Do not commit this file.

Commit:

```text
.env.example
```

instead.

Example:

```env
# ==========================================
# Application
# ==========================================

APP_ENV=development
APP_HOST=0.0.0.0
APP_PORT=8006
LOG_LEVEL=info


# ==========================================
# Backend Service
# ==========================================

BACKEND_API_URL=http://localhost:3000
BACKEND_INTERNAL_API_KEY=


# ==========================================
# LLM
# ==========================================

LLM_PROVIDER=openai
LLM_API_KEY=
LLM_MODEL=

LLM_TEMPERATURE=0.2
LLM_MAX_TOKENS=1000


# ==========================================
# Embedding
# ==========================================

EMBEDDING_PROVIDER=openai
EMBEDDING_API_KEY=
EMBEDDING_MODEL=


# ==========================================
# Supabase / Vector Database
# ==========================================

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

VECTOR_TABLE=ai_document_chunks


# ==========================================
# RAG
# ==========================================

RAG_TOP_K=5
RAG_SIMILARITY_THRESHOLD=0.70

RAG_CHUNK_SIZE=600
RAG_CHUNK_OVERLAP=100


# ==========================================
# Recommendation
# ==========================================

RECOMMENDATION_TOP_K=5

REC_WEIGHT_AMENITIES=0.35
REC_WEIGHT_PRICE=0.25
REC_WEIGHT_LOCATION=0.20
REC_WEIGHT_RATING=0.20
```

Do not expose:

```text
LLM_API_KEY
EMBEDDING_API_KEY
SUPABASE_SERVICE_ROLE_KEY
BACKEND_INTERNAL_API_KEY
```

to Frontend or Mobile applications.

---

# 19. Local Development

## Requirements

Install:

```text
Python >= 3.12
PostgreSQL + pgvector / Supabase
```

Check Python:

```bash
python --version
```

---

## Create Virtual Environment

```bash
python -m venv .venv
```

Linux/macOS:

```bash
source .venv/bin/activate
```

Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

---

## Install Dependencies

```bash
pip install -e ".[dev]"
```

---

## Environment Setup

Copy:

```bash
cp .env.example .env
```

Windows:

```powershell
Copy-Item .env.example .env
```

Then configure the required API keys.

---

## Run Development Server

```bash
uvicorn ai_service.main:app --app-dir src --reload --port 8006
```

Service:

```text
http://localhost:8006
```

FastAPI Swagger:

```text
http://localhost:8006/docs
```

OpenAPI:

```text
http://localhost:8006/openapi.json
```

---

# 20. Knowledge Ingestion

After configuring the embedding provider and vector database:

```bash
python scripts/ingest_documents.py
```

The script processes:

```text
knowledge/
    |
    v
load documents
    |
    v
normalize
    |
    v
chunk
    |
    v
embedding
    |
    v
vector database
```

Re-running ingestion should not create uncontrolled duplicate chunks.

---

# 21. Testing

Run all tests:

```bash
pytest
```

Run unit tests:

```bash
pytest tests/unit
```

Run integration tests:

```bash
pytest tests/integration
```

---

## Unit Tests

Unit tests should cover:

```text
Document Loader
Normalizer
Chunker
Prompt Builder
Retriever
Metadata Filtering
Recommendation Filtering
Recommendation Scoring
Recommendation Ranking
```

External dependencies should normally be mocked in unit tests.

Examples:

```text
LLM
Embedding Provider
Vector Store
Backend Client
```

---

## Integration Tests

RAG integration:

```text
Document
   |
   v
Embedding
   |
   v
Vector Store
   |
   v
Retriever
   |
   v
RAG Use Case
```

Recommendation integration:

```text
Backend Client
      |
      v
Candidate Filter
      |
      v
Scoring
      |
      v
Ranking
```

---

# 22. AI Evaluation

Testing whether an API returns HTTP 200 is not sufficient for an AI system.

AI behavior must also be evaluated.

---

## RAG Evaluation

Create an evaluation dataset containing questions such as:

```text
Normal answerable questions
Vietnamese questions
No-answer questions
Questions about different hotels
Ambiguous questions
```

Important retrieval metrics include:

```text
Hit Rate@K
Recall@K
```

RAG answer evaluation should consider:

```text
Faithfulness
Answer Relevance
Context Relevance
Hallucination
```

---

## Recommendation Evaluation

Recommendation tests should verify:

```text
Hard constraints are never violated
Relevant preferences affect ranking
Ranking is deterministic for the same inputs
Top-K behaves correctly
```

For example:

```text
Budget <= 1,500,000 VND
```

must never return:

```text
Hotel price = 2,000,000 VND
```

even if that hotel matches every soft preference.

---

# 23. Error Handling

Recommended error structure:

```json
{
  "error": {
    "code": "RAG_RETRIEVAL_FAILED",
    "message": "Unable to retrieve relevant hotel knowledge",
    "request_id": "request-id"
  }
}
```

Recommended HTTP status usage:

| Status | Usage |
|---|---|
| `400` | Invalid input |
| `404` | Requested resource not found |
| `422` | Request validation failed |
| `500` | Internal AI Service error |
| `502` | Backend / AI provider failure |
| `503` | External AI dependency unavailable |
| `504` | External service timeout |

---

# 24. Logging

Useful log fields:

```text
request_id
route
hotel_id
retrieval_count
retrieval_latency_ms
llm_latency_ms
backend_latency_ms
recommendation_latency_ms
total_latency_ms
error_code
```

Never log:

```text
API keys
Passwords
Access tokens
Refresh tokens
Supabase service role key
Sensitive personal data
```

---

# 25. Security Rules

1. Never commit `.env`.
2. Never expose service-role keys to clients.
3. Never expose LLM API keys to clients.
4. Validate all API inputs.
5. Validate structured LLM outputs before using them.
6. Add timeout handling for external HTTP requests.
7. Do not trust LLM-generated business data.
8. Do not allow RAG to mix knowledge from different hotels.
9. Do not allow recommendations to bypass hard constraints.
10. Realtime price and availability must come from Backend APIs.
11. Treat retrieved documents as data, not system instructions.
12. Do not allow document content to override system-level AI rules.

---

# 26. Development Principles

## Prefer structured systems before LLMs

If a problem can be solved reliably using:

```text
SQL
Backend API
Filtering
Validation
Business Rules
```

do not ask the LLM to guess the answer.

Example:

```text
"Phòng nào còn trống ngày 25/10?"
```

should use Backend data.

It should not be answered using RAG.

---

## Separate deterministic logic from generative AI

Example recommendation:

```text
Filtering
   ↓
Scoring
   ↓
Ranking
```

should remain deterministic.

LLMs may later help understand natural-language preferences, but they should not replace the core ranking rules without justification.

---

# 27. Coding Rules

When implementing code, follow these rules.

### Rule 1

Controllers must not contain application/business logic.

Bad:

```text
FastAPI router
    ↓
OpenAI
    ↓
Supabase
```

Correct:

```text
FastAPI Router
      ↓
Use Case
      ↓
Interfaces
      ↓
Infrastructure
```

---

### Rule 2

Application code must not depend directly on OpenAI, Gemini or Supabase.

Use interfaces.

---

### Rule 3

Domain code must remain independent from frameworks.

---

### Rule 4

Do not call the Backend API directly from recommendation scoring logic.

Use:

```text
HotelDataProvider
```

---

### Rule 5

Do not use LLMs for deterministic operations when ordinary code can perform them reliably.

---

### Rule 6

Every new AI feature should include tests or evaluation cases.

---

### Rule 7

Do not modify unrelated modules when implementing a task.

---

# 28. Development Roadmap

## Phase 1 — Foundation

- [ ] AI-001 Define AI Service responsibilities
- [ ] AI-002 Finalize AI architecture
- [ ] AI-003 Initialize FastAPI service
- [ ] AI-004 Configuration management

---

## Phase 2 — Knowledge Base

- [ ] AI-005 Define RAG knowledge scope
- [ ] AI-006 Define knowledge document schema
- [ ] AI-007 Prepare sample hotel knowledge

---

## Phase 3 — RAG Ingestion

- [ ] AI-008 Document loader
- [ ] AI-009 Text normalization
- [ ] AI-010 Chunking strategy
- [ ] AI-011 Chunk metadata
- [ ] AI-012 Embedding provider
- [ ] AI-013 Vector store
- [ ] AI-014 Complete ingestion pipeline
- [ ] AI-015 Knowledge re-indexing

---

## Phase 4 — RAG Query

- [ ] AI-016 Query embedding
- [ ] AI-017 Basic retriever
- [ ] AI-018 Metadata filtering
- [ ] AI-019 Similarity threshold
- [ ] AI-020 Prompt builder
- [ ] AI-021 Answer generation
- [ ] AI-022 Source attribution
- [ ] AI-023 RAG HTTP API

---

## Phase 5 — Recommendation

- [ ] AI-024 Recommendation input model
- [ ] AI-025 Hotel feature model
- [ ] AI-026 Candidate filtering
- [ ] AI-027 Recommendation scoring
- [ ] AI-028 Ranking
- [ ] AI-029 Recommendation explanation
- [ ] AI-030 Recommendation HTTP API

---

## Phase 6 — Backend Integration

- [ ] AI-031 Define Backend ↔ AI API contract
- [ ] AI-032 Implement Backend client
- [ ] AI-033 Failure and timeout handling

---

## Phase 7 — Evaluation

- [ ] AI-034 Build RAG evaluation dataset
- [ ] AI-035 Evaluate retrieval
- [ ] AI-036 Evaluate generated answers
- [ ] AI-037 Recommendation evaluation dataset
- [ ] AI-038 Unit tests
- [ ] AI-039 Integration tests
- [ ] AI-040 Logging and observability

---

# 29. Definition of Done

A task is complete when:

- [ ] Architecture boundaries are respected
- [ ] Input is validated
- [ ] Errors are handled
- [ ] Relevant tests pass
- [ ] No secrets are committed
- [ ] No unrelated modules are modified
- [ ] External dependencies are accessed through interfaces where appropriate
- [ ] Documentation is updated when contracts change
- [ ] AI behavior has appropriate evaluation cases