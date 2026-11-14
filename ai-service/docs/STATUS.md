# Trạng thái trợ lý khách sạn

Cập nhật: 2026-11-14, Asia/Ho_Chi_Minh.

## D1.10.1 — ổn định integration test HTTP timing, 2026-11-14

- Nhánh `test/d1101-stabilize-http-timing`, baseline `7f333f2`. Chỉ sửa ba file test/support và tài liệu; giữ nguyên source production, dependency/configuration, kiến thức và staging ngoài nhiệm vụ.
- Synthetic pool chuẩn bị cùng verified SSL context qua API public trước observer/deadline. Sink integration dùng handshake release/returned, tách assertion cancellation khi sink còn bị chặn khỏi successor request sau release/drain. Không tăng timeout, sleep, retry hoặc bỏ assertion quan trọng.
- Năm test lỗi trước đó chạy riêng đều pass; nhóm HTTP timing **79/79 pass**; toàn bộ unit/integration **218/218 pass**, còn 1 warning Starlette/HTTPX đã có. Ruff check/format-check 40 file và pip check qua.
- Không đọc `.env`, không Gemini live, không cài dependency hoặc đổi production provider/model/prompt/deadline/budget/readiness. D1 vẫn chưa đóng nghiệm thu live.
- Chi tiết lệnh, diff, kết quả và giới hạn: [D1.10.1_TEST_STABILIZATION.md](D1.10.1_TEST_STABILIZATION.md).

## Đồng bộ GitHub main với assistant D1, 2026-11-14

- Nhánh `fix/merge-main-assistant` tích hợp `origin/main` tại `3f45c7d` vào D1.10 (`06a6289`).
  Giải quyết ba conflict tại `FE/package.json`, `FE/package-lock.json` và `FE/src/services/api.js`.
  Giữ test tooling, cancellation, credentials, reset phiên và lỗi có mã của assistant;
  nhận dependency lịch làm việc và logic category mới từ main. Widget vẫn gắn đúng một lần;
  matcher assistant có phạm vi hẹp và việc gỡ facade recommendation cũ được giữ lại.
- Lockfile được npm tái tạo, giữ nguyên các package đã khóa của assistant; `npm ci --ignore-scripts
  --no-audit --no-fund` cài 139 package vào FE/node_modules, gồm dependency lịch mới từ main.
  Không cài phần mềm hệ thống, model hoặc dịch vụ mới. Không gọi Gemini/live evaluation.
- Bổ sung mock `ServiceRequestRepository` trong `CustomerHistoryServiceTest` cho dependency
  mới từ main; kiểm tra response có danh sách service requests rỗng. Không đổi logic nghiệp vụ.
- FE: `npm test` **8/8 pass**; `npm run lint` qua với các warning; `npm run build -- --outDir
  dist-assistant-check` qua, có cảnh báo bundle lớn. Không build đè BE/static.
- Spring: lệnh package offline/local-h2 trong README, chọn AssistantControllerTest,
  AssistantClientTest, AssistantSessionsTest, PublicRoomControllerTest, AuthControllerTest và
  CustomerHistoryServiceTest: **19/19 pass, BUILD SUCCESS** sau khi sửa mock thiếu.
- Browser: `$env:D1_LIVE_GEMINI='0'; npm run test:e2e` **3/3 pass** qua Vite/Spring/FastAPI
  với provider giả có nhãn: FAQ có nguồn, demo badge, thiếu nguồn, capability chưa bật,
  mobile/focus, JWT sai, reset và cô lập phiên A/B. Navbar mới có link đặt phòng desktop/mobile;
  cập nhật locator test theo role để chọn link đang hiển thị. Không đổi UI hoặc giảm assertion.
- Python: `python -B -m pytest -q -p no:cacheprovider tests/unit tests/integration` có
  **213 pass, 5 fail**, 1 warning Starlette/HTTPX. Các lỗi là TimeoutError tại ngưỡng chờ
  event 1 giây của test cancellation HTTP timing. Chạy riêng nhóm 7 test liên quan còn
  **4 pass, 3 fail**; chưa xác định đầy đủ nguyên nhân. Source app/unit/integration/conftest
  giống hệt trước merge, không sửa timeout/runtime để làm test xanh. Ruff check, format-check
  và pip check qua. Không kết luận toàn bộ test suite đã pass hoặc D1 đã nghiệm thu.
- Giữ nguyên staging ngoài nhiệm vụ, README nháp, 59 đường dẫn AI cũ đang xóa và các file
  untracked ban đầu; không đưa chúng vào merge commit. Không push/deploy.

## D1.10 — client HTTP timing và kiểm chứng offline, 2026-11-14

- Đã bổ sung plan theo bốn điểm review và đối chiếu source HTTPX 0.28.1/httpcore 1.0.9 trước sửa
  code. Observer/unit tests làm trước, sau đó chứng minh extension forwarding rồi mới gắn provider.
  Nhánh `feature/assistant-d1-http-timing`, không private pool hoặc monkeypatch runtime.
- Request-scoped trace đo các khoảng client connect/TLS/write/headers/body/close. Protocol chỉ từ
  explicit response extension; thiếu bằng chứng là unknown. trace_family là code namespace riêng.
  Không quan sát phase hoặc thiếu terminal thì unavailable, không suy 0 ms/reuse/provider compute.
- Logger riêng JSON schema v1, tối đa 32 samples/request; callback bỏ qua info. Queue 128 records,
  put_nowait và worker daemon cô lập sink I/O. Tests chứng minh sink chậm/lỗi, callback/clock lỗi
  không thay exception gốc hoặc giữ cancellation; giữ cancel count=1, cleanup và request tiếp theo.
  Delivery best effort, không flush/join trên request path, có cờ loss; không cam kết log không mất.
- Forwarding test dùng HTTPX thật + adapter test API public + core pool/backend synthetic trong bộ
  nhớ; không thay global client/hooks hoặc default private pool. Không có network/TLS thực; không
  suy kết quả fake backend là bằng chứng về OpenSSL hoặc Gemini thật.
- **218 tests passed**, 1 cảnh báo Starlette/HTTPX đã có; Ruff check/format-check và pip check qua.
  Bao gồm 139 tests baseline + 79 tests mới, kiểm tra budgets/mapping/readiness/cancellation và
  phase/error/stream lifecycle. Microbenchmark 1000 cặp replay: overhead median 0.07325 ms,
  p95 0.11070 ms với worker sink không I/O; không phải latency network/production hoặc SLO.
- Giữ model/prompt/deadline 20 giây/token-call budget/no-retry/public API/readiness; không đọc
  `.env`, không gọi Gemini/live batch, không cài dependency/service/model hoặc sửa FE/BE/corpus/
  dataset/artifact D1.9. Chỉ commit phạm vi D1.10, bảo toàn staging ngoài nhiệm vụ, không push/deploy.
- Chi tiết tại [D1.10_HTTP_TIMING.md](D1.10_HTTP_TIMING.md). **D1 vẫn chưa đủ điều kiện nghiệm thu**;
  cần phạm vi live riêng để dùng timing mới phân biệt sâu hơn network/provider waiting.

## D1.9 — một batch Gemini live có diagnostics, 2026-11-14

- Đã chạy đúng một batch 24 ca, 12 dev + 12 held-out, bằng Gemini thật trên runtime D1.8
  `220efa0`. Giữ model/prompt, snapshot synthetic gốc, payload/context.today=2026-11-13,
  deadline chung 20 giây, budget 8000/2000 tokens, tối đa hai generation, no-retry.
  Không probe/warm-up, không sửa source hoặc `.env`, không dùng runner ghi đè `live.json`.
- Kết quả: **18/24 final đúng trạng thái (75%), 6 DEADLINE_EXCEEDED, 0 dependency failures**.
  Đủ 24 ca, không dừng sớm; **37 countTokens + 37 generateContent = 74/96 attempts**.
  Có 68 method events HTTP 200, 6 chưa quan sát được HTTP status; không có 401/403/429.
- Xác nhận 5 timeout ở classify/generateContent, 1 ở answer/generateContent; cả 6 do application
  deadline, không ghi nhận HTTPX timeout category. Ca refund: classify mất khoảng 19 giây,
  answer/generateContent chỉ còn khoảng 887 ms. Index và countTokens hoàn tất nhanh, không lỗi.
  Chưa phân biệt được nguyên nhân sâu network/provider; không suy quota/key.
- So với 13/11 (15/24), cả 9 lỗi cũ đều hoàn tất, nhưng 6 ca từng thành công lại timeout.
  Chưa chứng minh cải thiện ổn định. Nearest-rank p50/p95: final mới **4317.47/19412.23 ms**;
  toàn bộ 24 ca **7205.71/20015.33 ms**. Không chỉ báo latency của ca thành công.
- Usage chỉ của 18 final: **12562 input / 1635 output tokens**; thiếu usage ca lỗi, chưa đo tổng
  chi phí/grounding. Cancellation không chứng minh upstream dừng compute hoặc tính phí.
- Artifact ignored riêng: `.local/assistant-evaluation/d1.9/20261114T121542_50bf6c59/`;
  254 diagnostics events, 24 case rows, manifest và summary không lưu prompt/response nhạy cảm.
  Đã đối chiếu JSON/counters/IDs và baseline; client đã đóng, source/.env/artifact cũ và staging
  ngoài nhiệm vụ được giữ nguyên. Không chạy lại runtime tests, cài dependency hoặc push/deploy.
- Chi tiết và bảng so sánh từng ca tại [D1.9_LIVE_DIAGNOSTIC.md](D1.9_LIVE_DIAGNOSTIC.md).
  Nhánh `feature/assistant-d1-live-diagnostic`, chỉ commit báo cáo/STATUS, không commit artifacts.
  **D1 chưa đủ điều kiện nghiệm thu** vì còn 25% timeout. Chưa được tự chạy thêm batch hoặc sửa
  deadline/model/prompt/retry; bước tiếp cần phạm vi riêng cho network/provider timing và khắc phục.

## D1.8 — instrumentation và kiểm thử offline, 2026-11-14

- Thêm logger JSON stderr riêng `ai_service.diagnostics`, UUID nội bộ và context cô lập theo turn.
  Events phân biệt classify/answer/probe, countTokens/generateContent/response validation,
  retrieval/index và application deadline; có duration, remaining budget, HTTP status khi có.
  Categories phân biệt HTTP timeout, deadline, transport, non-200, malformed JSON/schema/size,
  index I/O/validation/query, budget và cancellation. Không dùng raw exception hoặc input làm label.
- Chỉ serialize enums, UUID sinh nội bộ và số đo; không ghi key/JWT/PII, prompt/response, query,
  evidence, header/URL/path, thoughtSignature hoặc traceback. Không thêm dependency/config/secrets.
  Hướng dẫn trường và cách đọc tại [README](../README.md#diagnostics-d18--offline).
- Public API và error mapping giữ nguyên, gồm malformed JSON của provider vẫn là dependency error.
  Model/prompt, deadline 20 giây, token/call budget, no-retry và readiness latch không đổi. Validate
  index ban đầu vẫn ở trước budget. Sửa cleanup để provider được đóng nếu startup probe bị hủy.
- Test mới dùng MockTransport/stream có theo dõi cleanup, fake clock, event cancellation và corpus
  synthetic trong thư mục tạm. Guard chặn outbound/DNS/socket TCP, gồm đường async Windows;
  ngoại lệ duy nhất là socketpair đồng bộ nội bộ event loop. Không chạy live hoặc evaluation runner.
- Kiểm chứng: test mapping/redaction, cumulative budget qua classify/retrieval/answer, HTTP/application
  timeout, cancellation khi chờ headers/body/giữa bước, client/stream cleanup, request tiếp theo,
  context isolation, log injection, startup/shutdown và public/readiness regression.
  `python -B -m pytest -q -p no:cacheprovider tests/unit tests/integration`: **139 passed**, 1 cảnh
  báo Starlette/HTTPX đã có; 71 tests mới so với baseline 68. Ruff check/format-check cho app,
  tests/conftest.py, unit/integration đều qua; `pip check` không có dependency hỏng.
  Lệnh đầy đủ dùng virtualenv tại README; không dùng kết quả offline làm benchmark live.
- Giữ file `.env`, artifact/index cũ, báo cáo D1.7 và mọi thay đổi ngoài nhiệm vụ; không sửa FE/BE,
  knowledge, prompt/model hoặc evaluation runner. Nhánh `feature/assistant-d1-observability`;
  chỉ commit D1.8, không push/deploy. Không cài phần mềm, dependency, model hoặc dịch vụ mới.
- **D1 vẫn chưa đủ điều kiện nghiệm thu:** D1.8 cung cấp công cụ chẩn đoán cho lượt live tiếp theo,
  không xác định lại root cause lịch sử hoặc chứng minh đã khắc phục 7 timeout/2 dependency.
  Tiếp theo cần cho phép riêng một lượt live chẩn đoán giới hạn trước khi đánh giá ổn định.

## D1 — kiểm chứng Gemini thật, 2026-11-13

- Người dùng đã cấu hình key riêng trong ai-service/.env (ignored). Không in key, không đưa key vào command, Git hoặc prompt. Không thay nội dung file .env của người dùng.
- Live probe phát hiện Gemini trả `thoughtSignature` kèm text: adapter cũ từ chối metadata hợp lệ. Đã cho phép rồi bỏ qua signature, không lưu/forward; vẫn từ chối functionCall/tool parts. Regression tests: **68 pass**, 1 warning Starlette/HTTPX; Ruff qua.
- `tests/evaluation/run_d1.py --live`: **24 ca, 15 trả đúng trạng thái, 7 DEADLINE_EXCEEDED, 2 DEPENDENCY_UNAVAILABLE**. Không sửa prompt/ngưỡng bằng held-out set, không tự retry hoặc nâng deadline 20 giây. Chưa xác định nguyên nhân upstream của hai lỗi dependency; không kết luận sai key/quota chỉ từ mã tổng hợp.
- Model/version trả về: gemini-3.1-flash-lite; corpus demo_synthetic, snapshot `971d9d5ef3cc285fd170ac79afcb496bd7315c4edf4076c9263289edd7e34d2d`, prompt d1-faq-1. Trên **15 ca thành công**: p50 6747.78 ms; p95 nearest-rank 13965.50 ms. Usage quan sát được ở 15 ca này: 8677 input / 981 output tokens; không bao gồm probe, browser hoặc request lỗi, không phải tổng chi phí.
- Đã rà hai đáp án answered trong batch (Wi-Fi demo và quy định hành lý demo): citation đúng section, các khẳng định có căn cứ. Các ca lỗi không được tính đạt grounding. Không suy chất lượng production từ corpus giả lập.
- Bổ sung entrypoint live acceptance riêng `tests/integration/serve_d1_live.py`: dùng factory/lifecycle/provider thật và snapshot synthetic, không inject fake, không sửa cấu hình production hoặc .env. Khóa chỉ được Settings đọc trong process Python.
- Từ FE, `$env:D1_LIVE_GEMINI='1'` rồi `npm run test:e2e`: **3/3 pass với Gemini thật**, qua browser/Spring/FastAPI, gồm nguồn + badge demo + thiếu evidence + capability chưa bật, JWT sai/reset và member B không tái dùng conversation A. Đã xem ảnh desktop; câu trả lời Wi-Fi có căn cứ và UI gắn nhãn dữ liệu giả lập. Trace tắt để không lưu test JWT; server tạm được Playwright dừng.
- Lần E2E đầu có assertion sai: câu ngoài phạm vi astronaut được model từ chối bằng capability_unavailable đúng thiết kế; đã thay ca thiếu nguồn bằng câu FAQ về hồ bơi. Thời gian chờ test browser live đủ bao phủ các lượt tuần tự; **deadline runtime vẫn 20 giây**, không có retry/fake fallback. Lần đầu còn có 503, lần chạy lại 3/3 pass; không che các lỗi của batch.
- Kết luận: đã chứng minh **một FAQ có nguồn chạy end-to-end bằng Gemini thật**. D1 chưa được đánh dấu nghiệm thu toàn bộ: batch chỉ 15/24 hoàn tất, cần điều tra độ ổn định dependency/latency trước đóng bước. Production vẫn chưa có corpus duyệt và assistant mặc định disabled. Không thêm dependency/model/service hệ thống, không push/deploy.

Artifact local đã ignore: `.local/assistant-evaluation/live.json`, `live-review.json`, `browser-live.json`; ảnh live trong FE/test-results. Các mốc "thiếu key" bên dưới là lịch sử trước lượt này.

## D1 Task 6 — kiểm chứng và bàn giao, 2026-11-13

**D1 chưa hoàn thành nghiệm thu Gemini thật.** Đã triển khai đủ đường đi FAQ và kiểm chứng với provider fake có nhãn; không đánh đồng fake E2E với model thật. Không có GEMINI_API_KEY/GOOGLE_API_KEY trong process/user/machine; live runner báo not_run. Không bật billing, không tải model hoặc triển khai cloud.

- Python cuối: `python -B -m pytest -q -p no:cacheprovider`: **67 pass**, 1 warning Starlette/HTTPX. Ruff check/format app, unit/integration và evaluation runner qua; pip check không có dependency hỏng.
- Spring: `mvnw.cmd -o -Plocal-h2 -Dassistant.build.directory=target-assistant-d1 -Dtest=AssistantControllerTest,AssistantClientTest,AssistantSessionsTest,PublicRoomControllerTest,AuthControllerTest,CustomerHistoryServiceTest package`: **19 pass**, BUILD SUCCESS. Sau chỉnh HTTP/1.1 để tránh h2c upgrade vào Uvicorn, chạy lại 8 assistant tests/package: pass. Đây là tập liên quan, không khẳng định toàn bộ BE test suite pass.
- FE: `npm test`: **8 pass**; `npm ci --ignore-scripts` thành công; `npm run lint` exit 0 với cảnh báo nền; build riêng `dist-assistant-check` thành công, có cảnh báo bundle >500 kB. Không ghi đè BE/static.
- `npm run test:e2e`: **3 pass** qua Vite/Spring/FastAPI thật với labeled fake provider. Kiểm tra nguồn/demo badge, thiếu evidence, capability chưa bật, JWT sai, trường identity thừa, reset và member B không dùng lại conversation A. H2 chỉ in-memory synthetic. Playwright tự dừng các tiến trình sau test; không dùng MySQL/booking thật.
- Có ảnh desktop/mobile trong FE/test-results (ignored), đã xem trực tiếp. Kiểm tra nút đặt phòng và tìm phòng vẫn thao tác được khi panel mở; panel không tràn viewport, Escape trả focus. Component tests kiểm tra account switch/abort/late response và HTML được render như text. Chưa kiểm tra bàn phím mềm trên thiết bị mobile thật.
- Dataset: 12 dev + 12 held-out, nhóm paraphrase không giao nhau; mỗi split có 4 FAQ có nguồn, 4 thiếu nguồn, 4 ngoài khả năng D1. `run_d1.py --retrieval-only`: evidence chuẩn xuất hiện trong top 3 cho **8/8 ca có gold evidence**, trên corpus synthetic nhỏ; không phải grounding hoặc benchmark production. Snapshot `971d9d5ef3cc285fd170ac79afcb496bd7315c4edf4076c9263289edd7e34d2d`; tokenizer v2 chuẩn hóa wifi/Wi-Fi. Grounding, latency/token/chi phí Gemini: **chưa đo**.
- `run_d1.py --live` báo `not_run: GEMINI_API_KEY missing`; D1 không được đánh dấu done. Bước còn lại: cấu hình key/quota riêng ngoài Git, chạy live evaluation, rà từng khẳng định/citation và chạy browser với Gemini thật trước nghiệm thu.
- Dependency mới: PyYAML 6.0.3; Vitest 4.1.12, jsdom 26.1.0, Testing Library, Playwright 1.65.0. HTTPX chuyển sang runtime. Đã cài Chromium/headless shell và helper FFmpeg/Winldd vào cache người dùng cho test, không cài service hệ thống. npm audit cuối: **0 vulnerabilities**. Không nâng Node/Python/Java.
- Giữ nguyên staged blobs, README gốc đang sửa, 59 file xóa và 28 file untracked ban đầu; không sửa AGENTS.md hoặc knowledge. UI.md/EVALUATION.md untracked của người dùng được giữ nguyên; bằng chứng implementation D1 hiện hành nằm ở mục này. Tài liệu cũ bên dưới là lịch sử, không thay thế mốc D1 mới nhất.

Giới hạn: lexical retrieval còn hạn chế paraphrase; citation hợp lệ chưa chứng minh grounding. Phiên in-memory chỉ một instance, reset chat không thu hồi JWT toàn hệ thống. Provider/index lỗi không tự fallback; dependency failure giữ not ready cho đến restart sau khắc phục. Production chưa có corpus duyệt; mặc định assistant disabled, demo chỉ local. Không có business tools, Recommendation mới, thao tác booking, OCR hoặc vector service.

## D1 Task 5 — widget, 2026-11-13

- Có widget FAQ góc dưới bên phải, text/citation an toàn, badge synthetic, sáu gợi ý (nhóm chưa bật báo rõ), loading/error/cancel và Escape/focus. Chỉ hiện khi VITE_ASSISTANT_ENABLED=true; ẩn admin/staff.
- API client thêm AbortSignal/credentials/lỗi có mã; giữ convention auth cũ. Login/logout serialize reset chat, remount state theo auth token và bỏ response đến muộn. Không lưu chat vào browser storage.
- Thêm dev dependencies Vitest 4.1.12, jsdom 26.1.0 và Testing Library tương thích Node 20.19.4. Cài với --ignore-scripts. Bản Vitest đầu chọn có advisory đã thay bằng bản vá; npm audit cuối báo 0 vulnerabilities.
- `npm test`: 6 tests pass. FE lint exit 0 với cảnh báo có sẵn; chưa dùng lint làm bằng chứng UI/browser. Build và E2E được ghi trong Task 6.
- Tiếp theo: E2E/browser, evaluation và cập nhật hướng dẫn. Gemini thật chưa nghiệm thu.

## D1 Task 4 — Spring facade, 2026-11-13

- Có chat/reset endpoints, DTO đầu vào strict, cookie HttpOnly/SameSite, owner/phiên, TTL/capacity, idempotency và chặn publish sau reset.
- JWT sai ở assistant bị từ chối; Origin allowlist/CORS riêng, không mở /api/ai/**. Python chỉ nhận service credential và nội dung tối thiểu, không nhận JWT/principal/cookie.
- Client giới hạn response/deadline, kiểm tra ID/schema/mode/evidence/citation và từ chối mọi business tool call. Mặc định assistant disabled; demo chỉ local.
- `mvnw.cmd -o -Dassistant.build.directory=target-assistant-d1 -Dtest=AssistantControllerTest,AssistantClientTest,AssistantSessionsTest test`: 6 tests pass, BUILD SUCCESS. Test có upstream HTTP stub, không dùng LLM/booking thật. Còn cảnh báo Lombok/Mockito/deprecated APIs.
- Build directory riêng tránh class Recommendation cũ trong target; không xóa artifact người dùng. Chưa có widget/live Gemini; D1 chưa hoàn thành.

## D1 Task 3 — FAQ runtime, 2026-11-13

- Có orchestration FAQ: phân loại, một retrieval, trả lời từ evidence, citation registry; tối đa hai generation calls. Không có business tools hoặc continuation.
- Startup probe Gemini có timeout khi key/index/token được cấu hình; không fake readiness. Production draft vẫn bị từ chối. Không gửi identity/credentials trong provider payload; redaction mẫu credential/contact trong văn bản.
- `python -B -m pytest -q -p no:cacheprovider`: 64 pass, 1 warning. Ruff check/format qua. Integration test dùng provider fake có nhãn, không phải Gemini thật.
- Chưa có key nên chưa nghiệm thu live. Tiếp theo: Spring facade và widget. D1 chưa hoàn thành.

## D1 Task 1 — provider, 2026-11-13

Task 2 hoàn thành sau Task 1 trên nhánh feature/assistant-d1-ingestion:
- Có build snapshot offline theo allowlist, metadata/approval/hiệu lực; SQLite FTS5/BM25, manifest/checksum và evidence typed. Corpus synthetic riêng, không đổi knowledge người dùng.
- Thêm PyYAML 6.0.3 vào virtualenv/lockfile; không cài vector service hoặc embedding model.
- `python -B -m pytest -q -p no:cacheprovider`: 57 pass, 1 warning. Ruff các module mới và `pip check` qua. Đã sửa connection SQLite không đóng trên Windows; tests kiểm tra build lặp và checksum/nguồn bị rút.
- Production build từ draft bị từ chối. Retrieval/LLM thật chưa nghiệm thu; bước tiếp theo là orchestration.

- Gemini REST adapter cho gemini-3.1-flash-lite; HTTPX chuyển sang runtime, không thêm SDK.
- Interface provider/retrieval và budget tích lũy; response cap 256 KiB, không retry, lỗi không phản chiếu upstream.
- Kiểm tra: `python -B -m pytest -q -p no:cacheprovider`: 48 pass, 1 cảnh báo Starlette/HTTPX; Ruff check/format các file mới qua.
- FTS5 có sẵn. Process không có GEMINI_API_KEY; chưa gọi Gemini thật. Provider chưa gắn lifecycle/API; readiness vẫn 503.
- Tiếp theo: ingestion/index synthetic tách biệt. D1 chưa hoàn thành.

## Bước 2 — khung FastAPI, 2026-11-13

- Nhánh riêng: feature/assistant-fastapi-foundation, tạo theo yêu cầu commit từng bước; không push/deploy. Phạm vi commit gồm foundation, test, cấu hình cài đặt, hướng dẫn và hợp đồng API mà contract tests sử dụng. Staging và thay đổi ngoài bước được giữ nguyên.
- Đã tạo app/main.py, settings.py, api/boundary.py và schemas/turn.py: health 200, readiness 503 khi thiếu LLM/retrieval, xác thực service trước đọc body, giới hạn body 128 KiB kể cả chunked, request ID, validation và lỗi đã làm sạch.
- Start hợp lệ trả 503 DEPENDENCY_UNAVAILABLE; resume chưa có continuation trả 409 CONTINUATION_NOT_FOUND. Không có fake answer, MySQL, JWT khách, provider/index hoặc orchestration.
- Có schemas start/resume và kết quả tool typed; chặn trường danh tính/PII ngoài hợp đồng, tool lạ và call ID trùng. Chưa hiện thực schema output final/card/citation hoặc thực thi tool vì không có luồng thành công ở bước này.
- Đã dùng virtualenv ai-service/.venv với FastAPI/Uvicorn/Pydantic/Pydantic Settings và pytest/HTTPX/Ruff; các dependency chuyển tiếp chốt trong requirements.lock. Không cài dịch vụ hệ thống, SDK LLM hay model. Không phục hồi pyproject.toml, .env.example hoặc source/test cũ.
- Kiểm thử trước implementation đã thất bại đúng vì thiếu app.main; sau implementation kiểm tra auth, schema, lỗi, giới hạn request, readiness và ví dụ API. Lệnh thực tế ở README.md.
- Smoke test HTTP thật bằng Uvicorn trên loopback/port tạm: health=200, ready=503, thiếu service auth=401; server tạm đã dừng.
- Ruff check/format và pip check đã qua. Starlette TestClient hiện có một cảnh báo deprecation với HTTPX 0.28.1, được ghi rõ trong README, không che cảnh báo.
- Kết quả cuối: 39 tests pass; review độc lập đã xác nhận sửa lỗi mã lỗi JSON UTF-8, ngày chỉ nhận YYYY-MM-DD và boolean strict. Chưa có blocker trong phạm vi khung được review.
- Knowledge giữ nguyên approved=false; không có index hoặc số đo chất lượng AI. Dừng ở khung FastAPI, chưa làm ingestion/retrieval, Spring broker hoặc widget.

## Bước 1 — đặc tả API assistant, 2026-11-13

- Đã khảo sát controller, service, DTO, ApiResponse, security matcher và facade recommendation hiện có; tạo [API.md](API.md) cho chat Spring, turn nội bộ Python và health/readiness đề xuất.
- Đặc tả conversation/request/turn/call ID, start/resume/final, tool result, citation/evidence, card/action, lỗi, giới hạn request/budget và phiên guest/member.
- Ghi hợp đồng search_knowledge, search_rooms, list_services, list_my_bookings, get_my_booking. Dùng báo giá AvailableRoomResponse; chưa thêm get_room_quote hoặc API giá mới.
- Ghi rõ blocker ownership: getMyBookings có fallback accountId→customerId; getMemberBookingDetail có nhánh email/SĐT. Chưa được mở booking tool trước khi sửa/kiểm chứng quan hệ sở hữu; lượt này không sửa backend.
- Knowledge giữ nguyên pending_review/approved=false; production không tự nạp bản nháp. Không cài dependency, không tạo endpoint/runtime, không tự làm bước tiếp theo.
- Đã kiểm tra 6 JSON examples đọc được bằng json.loads; liên kết Markdown/source tham chiếu và code fences hợp lệ; git diff --check thành công. Đối chiếu hash baseline xác nhận chỉ thêm API.md và sửa ba tài liệu README/architecture/STATUS; knowledge, runtime và dependency không đổi. Chưa chạy contract/runtime test vì chưa có implementation.

## Bổ sung knowledge chờ duyệt — 2026-11-13

- Đã đối chiếu trực tiếp database hotel_management đang chạy theo yêu cầu mới: chỉ dùng dữ liệu có nguồn, không bổ sung tiện ích/chính sách suy đoán.
- Bộ hiện hành còn 4 tài liệu: FAQ chung, danh mục hạng phòng, thông tin booking theo schema và danh mục dịch vụ. Có 3 hạng phòng và 3 dịch vụ trong danh mục được khảo sát.
- Đã bỏ 4 bản nháp policy thiếu nguồn database; không tạo nội dung về bãi xe, giữ hành lý hoặc tiện ích không có dữ liệu. Không suy rằng thiếu dữ liệu đồng nghĩa khách sạn không cung cấp.
- Có bảng tổng hợp duyệt ở `../knowledge/README.md`; toàn bộ tài liệu để approved=false, pending_review và chưa có ngày hiệu lực.
- Tên, mô tả, tiện nghi và đơn vị dịch vụ có bảng/ID nguồn; giá, availability, trạng thái và dữ liệu riêng vẫn lấy live từ backend. Không xuất bản ghi khách/booking/thanh toán vào corpus.
- Chưa index, chưa cài dependency và chưa thay đổi runtime. Việc tiếp theo cho bộ knowledge là nhận kết quả duyệt của người dùng rồi cập nhật phiên bản/nguồn/hiệu lực.

## Đã làm

- Khảo sát stack thực: React/Vite, Spring Boot/MySQL; backend có facade recommendation, chưa có runtime AI đi kèm.
- Chốt phạm vi sáu nhóm chức năng và widget góc dưới bên phải.
- Soạn kiến trúc RAG/tool broker, UI, lộ trình, đánh giá và AGENTS.md theo từng thư mục.
- Gộp tài liệu hiện hành vào `docs/`: architecture, UI, PLAN, EVALUATION và STATUS; bỏ tầng tài liệu lặp và hợp đồng ranker cũ chưa triển khai.
- Tinh gọn README/AGENTS, bỏ prompt M1 và giả định stack cũ, cập nhật các tham chiếu trong repository.

## Điểm tái sử dụng

- FE: `App.jsx`, `AuthContext.jsx`, `services/api.js`.
- BE: `RoomCatalogService`, `CustomerBillingService`, `CustomerBookingController`, `CustomerHistoryService`.
- Spring giữ JWT/principal, thực thi tool và kiểm tra ownership; AI chỉ nhận dữ liệu tối thiểu đã được cấp quyền.

## Giới hạn và việc tiếp theo

- Đã có khung FastAPI và test suite lớp biên/schema. Chưa có widget, Spring chat, ingestion/retrieval, provider/model/index hoặc benchmark AI.
- Rà nhánh ownership qua email/SĐT trong `CustomerHistoryServiceImpl` trước mở tool booking.
- Dữ liệu synthetic chỉ dùng index test/demo riêng có nhãn, không tự fallback hoặc dùng làm corpus public/live.
- Nếu được giao triển khai, bắt đầu D1 trong [PLAN.md](PLAN.md): contract và một câu FAQ có nguồn chạy xuyên hệ thống.
- Lần dọn này chỉ thay đổi tài liệu/cấu trúc hướng dẫn; không đổi mã chạy, dependency hoặc cấu hình dịch vụ.

## Ghi nhận kiểm tra

- Đã kiểm tra 31 file Markdown và các liên kết nội bộ; không còn tham chiếu tới bộ tài liệu đã bỏ.
- Đủ AGENTS.md ở 20 thư mục còn giữ trong ai-service; tổng số file giảm từ 32 xuống 27.
- `git diff --check` thành công; không đổi mã runtime/dependency hoặc phục hồi source/test đã bị người dùng xóa.
- Không coi kiểm tra Markdown là bằng chứng chất lượng RAG hoặc phân quyền runtime.
