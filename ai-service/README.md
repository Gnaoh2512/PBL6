# Azure Bay — Trợ lý khách sạn (AI Service)

Trợ lý hỗ trợ FAQ, phòng, giá phòng, dịch vụ, booking cá nhân khi đăng nhập và chính sách khách sạn. Widget đặt ở **góc dưới bên phải**.

**Trạng thái:** Phase 3 có hybrid retrieval mặc định, context assembly, typed proposal (`FactSelectionProposal` gọn `d1-fact-selection-1` bật qua `proposal_mode="fact_selection"` trong profile Academic Demo; giữ tương thích `CandidateDraft` v2) và gate
D1.20 bắt buộc trong factory/FAQ (gồm máy tính giả định quyết định phía host cho `D-A14`); không có free-form supported=true bypass. Milestone D1 được user chấp nhận `ACCEPTED_WITH_LIMITATIONS` (23/11) cho Academic Demo; đợt 24–25/11 đã hoàn thiện allowlist `AI_DEMO_SOURCE_PACK=academic_policies` (10 policy/38 units), paired snapshot Qdrant (`fd7d1e18...`), phát hành & pin catalog bất biến `academic-policies-2026-11-25-v3` (42 facts / 31 `questionRules` / 33 `QuestionPattern`s / 42 templates, bổ sung điều kiện hạn 15 phút cho `D-A13`, `LOCAL_ARTIFACTS_VALID`), bổ sung FTS5 bigrams cho BM25, hoàn thiện kiểm tra câu ghép/tham số cho `QuestionBinding` (`19/19` `dev-A` bound + BM25 gate ready, `0/10` `dev-U`, `0/4` `dev-O`, `12/12` adversarial, `held_out_touched: false`), nâng `CLASSIFY` lên `d1-faq-3`, hỗ trợ `GEMINI_THINKING_LEVEL` (`gemini-3.6-flash + MINIMAL`) và đạt `644 passed, 0 failed, 0 skipped` (offline + Docker). Chưa có approved production corpus/catalog hoặc đóng quality gates live reliability/semantic. Runtime/runbook ở
[GROUNDING](docs/GROUNDING.md), bằng chứng ở [PROCESS](docs/PROCESS.md).

## Cách chia trách nhiệm

- `app/`: API nội bộ, điều phối hội thoại, retrieval, tools, ingestion, providers, schemas và prompts.
- `knowledge/`: FAQ, chính sách và hướng dẫn dịch vụ được duyệt; không chứa booking hoặc thông tin khách.
- `tests/`: unit, integration, evaluation và fixture synthetic.
- `docs/`: một bộ tài liệu hiện hành cho trợ lý.
- Mỗi thư mục có `AGENTS.md` nêu trách nhiệm, ranh giới và cách kiểm tra.

Spring Boot giữ xác thực, quyền sở hữu booking và dữ liệu nghiệp vụ. AI dùng RAG cho tài liệu; việc tra phòng/giá/dịch vụ/booking thực thi qua service backend. Không kết nối trực tiếp MySQL hoặc gửi JWT khách cho AI.

## Tài liệu

| File | Nội dung |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Quy tắc làm việc của agent |
| [Kiến trúc](docs/architecture.md) | Sơ đồ luồng, cây thư mục và ranh giới dữ liệu |
| [Hợp đồng API](docs/API.md) | Endpoint/tool đề xuất, dữ liệu trao đổi, xác thực, phiên và mã lỗi |
| [Giao diện](docs/UI.md) | Widget góc dưới bên phải, desktop/mobile |
| [Process và tiến độ](docs/PROCESS.md) | Checklist, bằng chứng, giới hạn và bước tiếp theo |
| [Đánh giá](docs/EVALUATION.md) | Chất lượng RAG/tool, phân quyền và hiệu năng |

## Khởi chạy

Đã kiểm tra trên Windows/PowerShell, Python 3.13.10. Chạy từ thư mục `ai-service`:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.lock
Copy-Item settings.example.env .env
.\.venv\Scripts\python.exe -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8006
```

`requirements.txt` liệt kê dependency runtime; `requirements-dev.txt` thêm pytest, HTTPX và Ruff. `requirements.lock` chốt toàn bộ phiên bản môi trường phát triển đã kiểm thử; lệnh trên cài cả công cụ test. Không khôi phục pyproject.toml, .env.example hoặc cây src/ai_service cũ đang bị xóa.

File mẫu không chứa credential thật. Điền AI_SERVICE_AUTH_TOKEN bằng token riêng của service trong `.env` hoặc biến môi trường; giá trị môi trường có ưu tiên cao hơn `.env`. Không dùng JWT khách làm token nội bộ. Token cấu hình phải dài 1–512 ký tự ASCII in được, không có khoảng trắng; nên tạo chuỗi ngẫu nhiên đủ mạnh, không dùng giá trị mẫu. AI_CORPUS_MODE là production hoặc demo_synthetic. Không có biến bật giả trạng thái LLM/index.

Python không kết nối MySQL hoặc dùng SDK LLM. Qdrant phục vụ paired indexing/chat hybrid mặc định; explicit `AI_RETRIEVAL_MODE=bm25` không cần Qdrant nhưng vẫn cần gate. Cả hai mode yêu cầu pinned catalog/source receipts trong `AI_GROUNDING`; thiếu artifacts giữ not-ready trước Gemini probe. Xem [indexing runbook](docs/INGESTION.md) và [Hybrid Retrieval/runbook](docs/HYBRID.md). Chỉ bind loopback khi chạy local; qua mạng cần TLS/giới hạn mạng theo API.md. Chưa mở Swagger/OpenAPI hoặc route browser.

## Hành vi hiện có

| Request | Kết quả |
| --- | --- |
| GET /health | 200, status=alive |
| GET /ready | 503 khi thiếu dependency; 200 sau valid index/catalog/source receipts và startup probe thật |
| POST /internal/assistant/turn thiếu cấu hình token | 503 AI_NOT_CONFIGURED |
| Cùng route, có cấu hình nhưng thiếu/sai credential hoặc gửi USER_JWT | 401 UNAUTHORIZED |
| Start hợp lệ với đúng token | 503 khi chưa sẵn sàng; khi ready chạy FAQ và trả final có nguồn hoặc trạng thái từ chối |
| Resume đúng schema | 409 CONTINUATION_NOT_FOUND; chưa có continuation nào được cấp |
| Payload sai/ID không khớp header | 422 VALIDATION_ERROR |
| JSON sai cú pháp có Content-Type application/json | 400 INVALID_JSON |
| Body nội bộ vượt 128 KiB kể cả gửi chunk | 413 PAYLOAD_TOO_LARGE |

Các payload lỗi trả requestId và error.code/message/retryable, không phản chiếu nội dung đầu vào. [API.md](docs/API.md) ghi rõ phần D1 final FAQ và các contract tool nghiệp vụ chưa triển khai. Nếu gửi X-Request-ID thì phải khớp requestId trong body; server sinh ID nếu header thiếu, do đó request turn với body khác ID sẽ bị từ chối.

## Kiểm tra

```powershell
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\ruff.exe check app tests/unit tests/integration
.\.venv\Scripts\ruff.exe format --check app tests/unit tests/integration
.\.venv\Scripts\python.exe -m pip check
```

Test paths chỉ gồm tests/unit và tests/integration của bước mới. Không gọi DB/cloud/model, không chạy các test của source cũ đang bị xóa. Contract test đọc ví dụ start/resume trong docs/API.md. HTTPX 0.28.1 hiện gây một cảnh báo deprecation từ Starlette TestClient; các kiểm thử vẫn pass, không lọc hoặc che cảnh báo. Cần đánh giá migration test client khi nâng dependency sau này.

Knowledge giữ approved=false, không tự build index khi startup. Snapshot phải build offline, đúng mode và được kiểm tra lại khi load/query. Retrieval baseline, rà grounding trên các đáp án đã nhận và latency quan sát được ghi trong PROCESS; không phải benchmark production.

## D1 đang triển khai

Widget bật tường minh bằng `VITE_ASSISTANT_ENABLED=true` trong process Vite. Spring mặc định disabled; xem BE/README.local.md cho cấu hình local demo. Frontend không gọi Python trực tiếp, không có provider key trong biến VITE_*.

## Kiểm chứng D1

### Diagnostics D1.8 — offline

Runtime ghi JSON từng dòng ra **stderr**, logger `ai_service.diagnostics` riêng, không propagate
lên root và không bật HTTPX/HTTPCore debug. Không cần thêm biến cấu hình hoặc dependency.
Mỗi event kết thúc một bước gồm `diagnostic_id` (UUID sinh nội bộ), `operation`, `phase`,
`provider_method`, `outcome`, `duration_ms`, `remaining_budget_ms`, `http_status`, `error_category`.
`operation` phân biệt probe/classify/answer/index_validate/retrieval/turn; `provider_method` chỉ là
countTokens/generateContent hoặc null, giúp xác định method khi phase là response_validation.

Tìm các event cùng `diagnostic_id`, đọc lỗi sâu nhất trước rồi event tổng kết turn:

- `connect_timeout`, `read_timeout`, `write_timeout`, `pool_timeout`: HTTP client timeout.
- `application_deadline`: context deadline tương ứng đã hết hạn hoặc ngân sách tích lũy đã cạn.
  Khi outer deadline hủy HTTP đang chờ, event HTTP có thể là `cancelled`, event turn là
  `application_deadline` cùng ID. Cancellation từ caller được truyền tiếp, không trở thành retry.
- `http_status`: response non-200, xem status thực nhận; không tự suy key/quota từ mã chung.
- `transport_connect/read/write/protocol/other`: lỗi transport; chưa đủ để kết luận DNS/TLS cụ thể.
- `json_decode`, `response_schema`, `response_size`: lỗi body JSON, schema/content/usage hoặc kích thước.
- `index_io`, `index_validation`, `index_query`: lỗi file/checksum/metadata hoặc SQLite cục bộ.
- `budget_limit`, `unexpected`: giới hạn token/call hoặc lỗi chưa phân loại; không ghi raw exception.

Duration của các bước lồng nhau **không cộng trực tiếp**. Ngân sách còn lại chặn dưới tại 0;
validate index đầu tiên vẫn nằm trước budget, có giá trị null. Đồng hồ dùng monotonic; log không
đổi deadline 20 giây, số HTTP requests, prompt/model, token budget hoặc no-retry.
UUID chẩn đoán không phải request/conversation/account ID của khách và không được thêm vào API.
Các lần validate index độc lập ngoài turn có ID riêng. Không lưu prompt/response, query, evidence,
API key/JWT/PII, URL/header, đường dẫn index hoặc exception message/traceback trong diagnostics.
Không cấu hình logger bên ngoài để dump headers/body. Các mã lỗi public và readiness không đổi:
FastAPI vẫn giữ not-ready sau dependency failure đến restart; client provider riêng vẫn dùng lại
được sau một lỗi request nếu transport đã phục hồi. Client được đóng cả khi startup probe bị hủy.

Chạy kiểm chứng offline từ `ai-service`:

```powershell
.\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests/unit tests/integration
.\.venv\Scripts\ruff.exe check app tests/conftest.py tests/unit tests/integration
.\.venv\Scripts\ruff.exe format --check app tests/conftest.py tests/unit tests/integration
.\.venv\Scripts\python.exe -B -m pip check
```

Test guard chặn TCP sockets/DNS/outbound, kể cả async transport Windows; chỉ cho phép socketpair
nội bộ của event loop. Mock HTTP/provider có nhãn, dữ liệu/index trong thư mục tạm, không dùng key
thật hoặc gọi model. Tests kiểm tra mapping, LogRecord redaction, budget, cancellation, stream/client
cleanup và request tiếp theo. Không chạy lại evaluation để kiểm chứng thay đổi này.
D1.8 không chứng minh Gemini thật ổn định hoặc giải thích ngược 9 lỗi cũ; D1 vẫn chưa đóng nghiệm thu.

### HTTP timing D1.10 — offline

Gemini adapter gắn request-scoped `extensions={"trace": ...}`; transport, pool, proxy/TLS,
timeout/budget, error mapping và no-retry giữ nguyên. Logger mới `ai_service.http_timing` phát
summary JSON schema v1; logger/schema D1.8 không đổi. Context dùng UUID nội bộ, không thêm vào API.

Summary gồm protocol/protocol_source, timing tổng, budget còn lại, status/category khi có và tối đa
32 samples connect_tcp/tls/proxy_tls/write_headers/write_body/wait_headers/read_body/close.
`trace_family` chỉ là namespace code path; protocol chỉ từ bytes allowlist trong explicit response
extension. Thiếu extension là `unknown`, kể cả khi HTTPX property mặc định trả HTTP/1.1.

Không có phase: unavailable, không phải 0 ms/reused. Thiếu terminal: duration_ms=null,
duration_kind=unavailable. Cặp started/failed chỉ đo đến lúc abort, không phải latency hoàn tất.
`wait_headers` không phải Gemini compute/TTFB thuần; body có thể đã buffered trong lúc đọc headers.
`pre_trace_ms` không phải pool wait. Proxy CONNECT có thể lặp chuỗi events; không suy origin hoặc
cộng parent/child intervals. Summary cancelled cần đối chiếu turn/application D1.8 để biết deadline.

Callback không đọc `info`, không I/O/await bên trong. Queue 128 records dùng put_nowait, worker daemon
ghi stderr; sink chậm/lỗi hoặc queue đầy không chặn request/cancellation. Delivery best effort:
`delivery_loss_observed` báo đã có loss, record cuối có thể mất khi process thoát; không drain/join
trên request/client shutdown. Không ghi URL/host/IP, headers/body, prompt/response, key/JWT/PII hoặc
raw exception/traceback. Giữ diagnostics worker riêng với client/service nghiệp vụ.

Chi tiết source-version, schema, bốn điểm review và offline verification tại
[D1.10_HTTP_TIMING.md](docs/D1.10_HTTP_TIMING.md). Dùng lại các lệnh test/Ruff/pip check phía trên.
Không có live run trong D1.10; D1 vẫn chưa được đóng nghiệm thu.

### Kiểm chứng live đã có và hướng dẫn riêng

Để chạy browser bằng Gemini thật: từ FE đặt `$env:D1_LIVE_GEMINI='1'`, rồi `npm run test:e2e`. Key được Settings đọc từ ai-service/.env, không truyền trong command. Entrypoint live bắt buộc dùng snapshot synthetic và không sửa file .env. Đọc PROCESS để phân biệt 3 E2E pass với batch 24 ca còn lỗi; không chạy lại batch vô hạn để chọn kết quả đẹp.

- Python: các lệnh pytest/Ruff/pip check ở trên; thêm `tests/evaluation/run_d1.py --retrieval-only` cho baseline synthetic hoặc `--live` khi có GEMINI_API_KEY. Báo cáo trong `.local/assistant-evaluation/` đã ignore; có đáp án synthetic để người đánh giá rà grounding, không chứa prompt/credential.
- Spring: `mvnw.cmd -o -Plocal-h2 -Dassistant.build.directory=target-assistant-d1 -Dtest=AssistantControllerTest,AssistantClientTest,AssistantSessionsTest,PublicRoomControllerTest,AuthControllerTest,CustomerHistoryServiceTest package`.
- FE: `npm ci --ignore-scripts`, `npm test`, `npm run lint`, `npm run build -- --outDir dist-assistant-check`. Không ghi đè BE/static. Dependency test khóa theo Node 20.19.4; không nâng Node trong D1.
- E2E: sau Spring package, chạy `npm run test:e2e` từ FE. Playwright tự chạy Vite/Java/FastAPI test server trên 3000/19090/18006 và dừng chúng sau test. Nếu cổng đã có tiến trình, không tái sử dụng hoặc dừng dịch vụ của người dùng. Test provider ở tests/integration/serve_d1_fake.py có nhãn rõ và không thể bật bằng cấu hình runtime thông thường.
- Lần đầu cần `npx playwright install chromium`; browser và helper được cài vào cache người dùng, không vào Git. Ảnh desktop/mobile trong FE/test-results đã ignore.
- E2E fake kiểm chứng wiring/boundary/UI; không chứng minh Gemini thật hoặc grounding. `--live` thiếu key báo not_run, không đánh dấu D1 done. Chưa có corpus production được duyệt.

Build demo index offline từ `ai-service`: `.\.venv\Scripts\python.exe -m app.ingestion.snapshot --mode demo_synthetic`.
Lệnh in đường dẫn snapshot để đặt `AI_INDEX_PATH`; đặt rõ `AI_CORPUS_MODE=demo_synthetic`. Output trong `.local/assistant-index/` đã ignore. Production không chấp nhận snapshot demo hoặc bản nháp chưa duyệt.

Adapter Gemini REST và FAQ orchestration đã gắn vào route. GEMINI_API_KEY cấu hình ngoài Git; GEMINI_MODEL mặc định gemini-3.1-flash-lite. Không dùng SDK Gemini. HTTPX là dependency runtime. Startup probe tối đa 5 giây xác nhận provider; lỗi probe giữ not ready, restart sau khi sửa cấu hình/quota. Source corpus thật chưa được duyệt; không tự bật demo khi thiếu nguồn. Kết quả Gemini thật và giới hạn hiện hành xem PROCESS.

## Runbook vận hành D1–D4 (FAQ, Business Tools, Booking cá nhân & Kết hợp)

### 1. Cờ bật/tắt (Feature Flags & Kill Switches)

| Tầng | Biến môi trường / Property | Mặc định | Tác dụng |
| --- | --- | --- | --- |
| Spring (`BE`) | `AI_ASSISTANT_ENABLED` (`assistant.enabled`) | `false` | Công tắc tổng bật/tắt `/api/assistant/*` (tắt nhanh trả `503 AI_NOT_CONFIGURED`) |
| Spring (`BE`) | `AI_BUSINESS_TOOLS_ENABLED` (`assistant.business-tools-enabled`) | `true` | Bật/tắt D2 business tools (`search_rooms`, `list_services`) |
| Spring (`BE`) | `AI_BOOKING_TOOLS_ENABLED` (`assistant.booking-tools-enabled`) | `true` | Bật/tắt D3/D4 booking tools cá nhân (`list_my_bookings`, `get_my_booking`, kết hợp policy) |
| Spring (`BE`) | `AI_CORPUS_MODE` (`assistant.corpus-mode`) | `production` | Chế độ corpus (`demo_synthetic` chỉ được Spring chấp nhận ở profile `local`) |
| React (`FE`) | `VITE_ASSISTANT_ENABLED` | `false` | Bật/tắt hiển thị widget góc dưới bên phải (tự ẩn trên `/admin*`, `/staff*`) |

### 2. Thứ tự khởi chạy local (Real MySQL + Hybrid Qdrant)

1. **Hạ tầng Docker**: bật container MySQL (`:3306`, schema `hotel_management`) và Qdrant (`docker compose -f compose.qdrant.yaml up -d` tại `:6333`).
2. **Kiểm tra preflight artifacts** (từ `ai-service/`):
   ```powershell
   .\.venv\Scripts\python.exe -B -m app.academic_demo_preflight --contract academic-demo.contract.json
   ```
3. **AI Service (`:8006`)**:
   ```powershell
   .\.venv\Scripts\python.exe -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8006
   ```
   Kiểm tra `GET http://127.0.0.1:8006/ready` trả `200 {"status": "ready"}`.
4. **Spring Boot (`:9090`)**: đặt `SPRING_PROFILES_ACTIVE=local` (nếu dùng `demo_synthetic`), `AI_ASSISTANT_ENABLED=true`, `AI_SERVICE_AUTH_TOKEN` trùng với `ai-service/.env`, `AI_SERVICE_URL=http://127.0.0.1:8006`, và datasource MySQL.
5. **Frontend (`:3000`)**: từ `FE/`, đặt `$env:VITE_ASSISTANT_ENABLED='true'; npm run dev`.

### 3. Lệnh kiểm chứng chuẩn cho D1–D4

- **AI Service (offline + Docker Qdrant + bộ đánh giá 80 ca D4)**:
  ```powershell
  $env:PBL6_QDRANT_DOCKER='1'
  .\.venv\Scripts\ruff.exe check app tests/conftest.py tests/unit tests/integration tests/evaluation/run_d4_eval.py
  .\.venv\Scripts\ruff.exe format --check app tests/conftest.py tests/unit tests/integration tests/evaluation/run_d4_eval.py
  .\.venv\Scripts\pytest.exe -q -p no:cacheprovider tests/unit tests/integration
  $env:PYTHONPATH='tests/unit'; .\.venv\Scripts\python.exe -B -m tests.evaluation.run_d4_eval --output .local/assistant-evaluation/d4-offline-eval.json
  ```
- **Backend (`BE/`)**: `.\mvnw.cmd test`
- **Frontend (`FE/`)**: `npx oxlint src/components/assistant/AssistantWidget.jsx src/components/assistant/AssistantWidget.test.jsx` và `npm test`

### 4. Giới hạn vận hành & xử lý sự cố

- **Single-instance in-memory**: phiên chat (`AssistantSessions` ở Spring) và `ContinuationStore` (ở FastAPI) nằm trong bộ nhớ tiến trình; restart sẽ xóa phiên đang mở (trả `404 CONVERSATION_NOT_FOUND` hoặc `409 CONTINUATION_NOT_FOUND` an toàn). Chưa hỗ trợ scale nhiều instance dùng chung session.
- **`/ready` dependency latch**: lỗi upstream Gemini (`503`/`429`) kích hoạt cooldown (`AI_DEPENDENCY_LATCH_COOLDOWN_S=5.0` ở local); lỗi `504 DEADLINE_EXCEEDED` hoặc lỗi nghiệp vụ `DATA_UNAVAILABLE` không giữ `/ready` ở trạng thái chết. Nếu lỗi kéo dài do hết quota Free Tier (`HTTP 429`), đổi khóa/gói trả phí hoặc tắt tạm bằng `AI_ASSISTANT_ENABLED=false`.
- **Chính sách & miễn trừ trách nhiệm**: mọi câu hỏi kết hợp booking + policy chỉ ghép dữ liệu đã cấp quyền từ Spring với chính sách đã duyệt qua Phase 3 Verification Gate và luôn giữ lưu ý không tự tính hoàn tiền/phí cuối cùng. Corpus `production` thật phải được người phụ trách duyệt độc lập trước khi tắt `demo_synthetic`.
