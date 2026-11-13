# Trạng thái trợ lý khách sạn

Cập nhật: 2026-11-13, Asia/Ho_Chi_Minh.

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
