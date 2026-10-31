# Room recommendation architecture

```text
Browser demo -> private FastAPI recommendation routes
                         |-- Vietnamese conversation -> Gemini extraction -> Pydantic state
                         `-- deterministic RecommendationPipeline
                                             |
                                             v
                             Spring public availability API -> MySQL
```

Spring Boot is authoritative for room types, inventory, prices, booking overlap, and deposits.
The AI service never connects to MySQL directly. The JSON recommendation endpoint continues to
accept structured criteria. The conversation endpoint turns one Vietnamese message into explicit
SET/CLEAR edits, validates caller-carried criteria on every turn, asks about missing or ambiguous
inputs, and then calls that same pipeline. The LLM has no tool that can book a room or create a
price. Room-type names are resolved through Spring's live catalogue.

Within `conversation_service.py`, extraction and ambiguity checks run before state updates.
`apply_changes` keeps budget-basis and partial-year resolution in focused helpers, then
validates the resulting `SearchState`. Search validation and the recommendation pipeline
still run only after unresolved criteria are handled. The synthetic offline runner feeds the
same room fixtures to both scoring versions and shares aggregation for labeled nDCG.
These internal boundaries do not change the HTTP contract or scoring rules.

`application` owns the typed criteria, state transition, questions, and deterministic ranking.
`infrastructure` owns HTTP adapters for Spring and Gemini. `presentation` owns authentication,
request IDs, body limits, response serialization, and the local test page. `config` owns validated
environment settings. Gemini configuration is optional at startup; `/health` and structured
search remain available when it is absent.

The planned production integration is frontend -> Spring authenticated facade -> private
FastAPI. The Spring facade and cross-service tracing interceptor are not implemented. The browser
page at `/demo` is a local test harness that asks for a service token in the page; it should not
be published as a public application.
