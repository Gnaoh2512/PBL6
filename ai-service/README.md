# AI Hotel — trợ lý khách sạn

Trợ lý hỗ trợ FAQ, phòng, giá phòng, dịch vụ, booking cá nhân khi đăng nhập và chính sách khách sạn. Widget đặt ở **góc dưới bên phải**.

**Trạng thái:** có Gemini REST adapter, ingestion/index FTS5, FAQ orchestration, Spring facade và widget opt-in. Đã có FAQ end-to-end với Gemini thật và 3 E2E pass; batch live còn timeout/dependency errors nên D1 chưa được đóng nghiệm thu. Production chưa có corpus duyệt. Không có business tools hoặc runtime fallback sang fake.

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
| [Lộ trình](docs/PLAN.md) | Các lát triển khai và tiêu chí nghiệm thu |
| [Đánh giá](docs/EVALUATION.md) | Chất lượng RAG/tool, phân quyền và hiệu năng |
| [Trạng thái](docs/STATUS.md) | Đã làm, giới hạn và việc tiếp theo |

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

Không cài hay kết nối MySQL, SDK LLM hoặc vector database. Chỉ bind loopback cho chạy local; khi dùng qua mạng cần TLS và giới hạn mạng theo API.md. Chưa mở Swagger/OpenAPI hoặc route browser.

## Hành vi hiện có

| Request | Kết quả |
| --- | --- |
| GET /health | 200, status=alive |
| GET /ready | 503 khi thiếu dependency; 200 sau startup probe thật và index đúng mode hợp lệ |
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

Knowledge giữ approved=false, không tự build index khi startup. Snapshot phải build offline, đúng mode và được kiểm tra lại khi load/query. Retrieval baseline, rà grounding trên các đáp án đã nhận và latency quan sát được ghi trong STATUS; không phải benchmark production.

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

### Kiểm chứng live đã có và hướng dẫn riêng

Để chạy browser bằng Gemini thật: từ FE đặt `$env:D1_LIVE_GEMINI='1'`, rồi `npm run test:e2e`. Key được Settings đọc từ ai-service/.env, không truyền trong command. Entrypoint live bắt buộc dùng snapshot synthetic và không sửa file .env. Đọc STATUS để phân biệt 3 E2E pass với batch 24 ca còn lỗi; không chạy lại batch vô hạn để chọn kết quả đẹp.

- Python: các lệnh pytest/Ruff/pip check ở trên; thêm `tests/evaluation/run_d1.py --retrieval-only` cho baseline synthetic hoặc `--live` khi có GEMINI_API_KEY. Báo cáo trong `.local/assistant-evaluation/` đã ignore; có đáp án synthetic để người đánh giá rà grounding, không chứa prompt/credential.
- Spring: `mvnw.cmd -o -Plocal-h2 -Dassistant.build.directory=target-assistant-d1 -Dtest=AssistantControllerTest,AssistantClientTest,AssistantSessionsTest,PublicRoomControllerTest,AuthControllerTest,CustomerHistoryServiceTest package`.
- FE: `npm ci --ignore-scripts`, `npm test`, `npm run lint`, `npm run build -- --outDir dist-assistant-check`. Không ghi đè BE/static. Dependency test khóa theo Node 20.19.4; không nâng Node trong D1.
- E2E: sau Spring package, chạy `npm run test:e2e` từ FE. Playwright tự chạy Vite/Java/FastAPI test server trên 3000/19090/18006 và dừng chúng sau test. Nếu cổng đã có tiến trình, không tái sử dụng hoặc dừng dịch vụ của người dùng. Test provider ở tests/integration/serve_d1_fake.py có nhãn rõ và không thể bật bằng cấu hình runtime thông thường.
- Lần đầu cần `npx playwright install chromium`; browser và helper được cài vào cache người dùng, không vào Git. Ảnh desktop/mobile trong FE/test-results đã ignore.
- E2E fake kiểm chứng wiring/boundary/UI; không chứng minh Gemini thật hoặc grounding. `--live` thiếu key báo not_run, không đánh dấu D1 done. Chưa có corpus production được duyệt.

Build demo index offline từ `ai-service`: `.\.venv\Scripts\python.exe -m app.ingestion.snapshot --mode demo_synthetic`.
Lệnh in đường dẫn snapshot để đặt `AI_INDEX_PATH`; đặt rõ `AI_CORPUS_MODE=demo_synthetic`. Output trong `.local/assistant-index/` đã ignore. Production không chấp nhận snapshot demo hoặc bản nháp chưa duyệt.

Adapter Gemini REST và FAQ orchestration đã gắn vào route. GEMINI_API_KEY cấu hình ngoài Git; GEMINI_MODEL mặc định gemini-3.1-flash-lite. Không dùng SDK Gemini. HTTPX là dependency runtime. Startup probe tối đa 5 giây xác nhận provider; lỗi probe giữ not ready, restart sau khi sửa cấu hình/quota. Source corpus thật chưa được duyệt; không tự bật demo khi thiếu nguồn. Kết quả Gemini thật và giới hạn hiện hành xem STATUS.
