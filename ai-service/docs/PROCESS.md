# Process và tiến độ trợ lý khách sạn

Cập nhật: **2026-11-26**, Asia/Ho_Chi_Minh (đồng bộ sau merge D1–D4 và commit chuẩn hóa thương hiệu Azure Bay `3a0121e` / catalog **`academic-policies-2026-11-25-v4`**).
Toàn bộ các khối **D1–D4** đã triển khai: Phase 3 nối hybrid → context → typed proposal (`FactSelectionProposal` gọn `d1-fact-selection-1` được bật qua `proposal_mode="fact_selection"` trong profile Academic Demo; giữ tương thích `CandidateDraft` v2) → gate bắt buộc (gồm máy tính giả định quyết định phía host cho `D-A14`) → verified rendering/abstention; D2 nối `search_rooms`/`list_services` qua Spring `AssistantToolBroker` + `ContinuationStore` single-use + deterministic renderer; D3 kiểm toán ownership (`R4`) và nối `list_my_bookings`/`get_my_booking`; D4 nối câu hỏi kết hợp `booking_with_policy` kèm bộ đánh giá 80 ca synthetic ([d4_suite.json](../tests/evaluation/d4_suite.json)) và runbook vận hành. Profile Academic Demo hiện pin catalog bất biến **`academic-policies-2026-11-25-v4`** (42 facts / 31 `questionRules` / 33 `QuestionPattern`s / 42 templates, nhãn Azure Bay) trong [academic-demo.contract.json](../academic-demo.contract.json) với `gemini-3.6-flash` + `GEMINI_THINKING_LEVEL=MINIMAL`.
**Milestone D1: ACCEPTED_WITH_LIMITATIONS** (user chấp nhận ngày 23/11/2026 cho Academic Demo — Approved Synthetic Hotel Knowledge); **D2–D4 đã triển khai và kiểm chứng offline + smoke live MySQL** (xem mục 14–16 cuối file: Python `668 passed`, BE `35 passed`, FE `12 passed`, bộ đánh giá D4 offline `80/80 passed`), nhưng corpus/catalog production thật, benchmark live dài hạn / live reliability gates (R1) và ký nghiệm thu chính thức vẫn còn mở.
Public API/budget không đổi. Các kết quả kiểm thử Phase 3 và D1.15 bên dưới được giữ làm bằng chứng lịch sử; kết quả kiểm chứng mới ngày 24–25/11 ghi ở các mục cuối file.

Quyết định hiện hành: [D1 Acceptance Decision — 2026-11-23](#d1-acceptance-decision--2026-11-23).
Quyết định milestone không làm mọi quality gate PASS; các trạng thái D1 còn mở/PARTIAL ở mốc cũ được giữ như lịch sử.

**Phạm vi được chấp nhận: Academic Demo — Approved Synthetic Hotel Knowledge.** Bộ tiêu chí định lượng
hiện hành ở [Academic Demo](#d1-academic-demo--scope-và-acceptance-criteria-2026-11-21).
Không phải Production readiness; giữ nguyên ngưỡng hiện hành, không tự duyệt proposal/ngân sách live còn thiếu.

Đây là nơi duy nhất cập nhật checklist, trạng thái và bước tiếp theo, thay cho hai file lộ trình/trạng thái trước đây. Thiết kế và luồng chạy nằm ở [architecture.md](architecture.md); hợp đồng ở [API.md](API.md).

## Cách đọc checklist

- `[x]`: có implementation/bằng chứng phù hợp với đúng nội dung của mục.
- `[ ]`: chưa triển khai hoặc chưa đủ bằng chứng nghiệm thu. Có code không đồng nghĩa đã nghiệm thu chất lượng model.
- Bảng kiểm chứng 13–14/11/2026 là lịch sử; các lượt offline D1.12–D1.14 và live D1.15 ghi riêng bên dưới. D1.15 không chạy lại test suite offline.

## Kết luận hiện tại

**D0 xong; milestone D1 được user chấp nhận `ACCEPTED_WITH_LIMITATIONS`; D2–D4 đã triển khai và có bằng chứng kiểm thử offline + smoke live MySQL (chờ corpus production & ký nghiệm thu chính thức).** Kiến trúc hiện tại gồm React → Spring (`AssistantOrchestrator` / `AssistantToolBroker`) → FastAPI → Gemini + hybrid BM25/query embedding/Qdrant + Verification Gate (catalog `v4`) + `ContinuationStore` single-use cho business/booking tools chỉ đọc và câu hỏi kết hợp `booking_with_policy`.

FAQ, tìm phòng/dịch vụ, booking cá nhân (`ROLE_CUSTOMER`) và câu hỏi kết hợp đã chạy smoke E2E xuyên browser/Spring/MySQL/Qdrant/Python bằng Gemini thật ở chế độ `demo_synthetic`. Tuy nhiên, live reliability dài hạn (R1: `HTTP 429` free-tier ở `gemini-3.6-flash` / `HTTP 503` ngắt quãng ở `gemini-3.5-flash-lite`; lịch sử D1.15 đạt 10/24 ca), review độc lập Gold và corpus production thật (R3: `knowledge/` vẫn là bản nháp chưa duyệt) vẫn là các gate mở trước khi phát hành production.

## Definition of Done và gate nghiệm thu D0–D4

Các gate dưới đây giữ yêu cầu kỹ thuật và bằng chứng; chưa kiểm chứng thì vẫn mở. Các kết luận D1 còn mở ở mốc cũ là lịch sử; quyết định milestone ngày 23/11 được ghi riêng cuối file. Hoàn thành code, chấp nhận milestone, quality-gate PASS và phát hành Production được phân biệt.

Definition of Done chung cho một lát công việc:

- Đúng phạm vi được giao, contract/tài liệu nhất quán; thay đổi chỉ có tài liệu không yêu cầu triển khai hoặc chạy runtime ngoài phạm vi.
- Các regression áp dụng trong ma trận bên dưới có kết quả và bằng chứng; lỗi chưa xử lý hoặc thiếu bằng chứng giữ gate mở. Ghi rõ `chưa chạy` hoặc `không áp dụng` kèm lý do, không quy đổi thành pass.
- Bằng chứng ghi ngày, command, revision/working-tree snapshot, môi trường, dataset/corpus snapshot và provider/model/prompt khi áp dụng; giữ cả ca lỗi và giới hạn. Fake, model thật, kiểm tra trạng thái và review nội dung phải được phân biệt.
- Không làm lộ credential/PII hoặc vượt quyền; blocker của phạm vi phải có bằng chứng đóng và bản ghi người chịu trách nhiệm chấp nhận kết quả. Vai trò/người ký nghiệm thu chưa được chốt, không tự gán tên hoặc ghi đã duyệt.

| Giai đoạn | Điều kiện đầu vào | Gate đầu ra và bằng chứng cần có |
| --- | --- | --- |
| D0 | Phạm vi sản phẩm được xác định | Phạm vi, trách nhiệm FE/Spring/Python, ranh giới dữ liệu/quyền và tài liệu/đường dẫn nhất quán; giữ kết luận D0 đã xong, không coi các gate mới là nghiệm thu production hồi tố |
| D1 | Thiết kế D0 và contract FAQ; corpus demo synthetic tách biệt hoặc nguồn thật được duyệt | FAQ xuyên browser/Spring/Python có nguồn; regression auth/schema/session/lỗi pass; live evaluation có giới hạn đạt tiêu chí đã chốt trước chạy; từng final có đủ provenance, được chấm grounding, citation identity/support/coverage và abstention áp dụng theo rubric, đạt tiêu chí nội dung đã chốt. D1.15 có 10/24 final đúng trạng thái, D1.16 review offline chưa đóng gate; nguồn thật được duyệt là gate production riêng |
| D2 | D1 được nghiệm thu; contract tool chỉ đọc và nguồn nghiệp vụ được xác định | Phòng/giá/dịch vụ khớp backend, ngày/bộ lọc/currency/đơn vị đúng, thẻ/link lấy từ DTO; ca ngày sai, hết phòng, dữ liệu đổi, tool lạ và backend timeout được kiểm chứng. Chưa có kết quả để nghiệm thu |
| D3 | D2 được nghiệm thu; quan hệ principal→customer/ownership và trường DTO/chính sách lưu giữ được xác định trước dùng dữ liệu thật | A không đọc booking B dù biết mã; guest/JWT hỏng bị chặn; logout/đổi account/reset/late result không lộ dữ liệu; quyền được kiểm tra trước DTO/model, không index/log/cache chung dữ liệu cá nhân. Chưa mở tool booking |
| D4 | D3 được nghiệm thu; contract phối hợp nguồn và giới hạn tool/vòng/budget được chốt | Câu kết hợp giữ ownership và policy đúng phiên bản/hiệu lực; loop/allowlist/call ID/deadline được kiểm chứng; đánh giá mở rộng chất lượng, quyền, latency và chi phí theo tiêu chí định trước, ghi giới hạn và runbook. Chưa triển khai |

Chỉ chuyển sang triển khai giai đoạn kế tiếp sau khi có bản ghi nghiệm thu giai đoạn trước và đủ điều kiện đầu vào; rà tài liệu/thiết kế không tự mở D2. Chốt ngưỡng chất lượng, tỷ lệ lỗi/latency, thiết kế batch/số lần lặp và ngân sách trước phép đo nghiệm thu; chưa có giá trị thống nhất thì giữ gate liên quan mở, không tự đặt SLO từ một batch.

## D0 — Thiết kế và ranh giới

- [x] Chốt sáu nhóm: FAQ, phòng, giá phòng, dịch vụ, booking cá nhân, chính sách; widget góc dưới bên phải.
- [x] Chia trách nhiệm React/Spring/Python; Spring giữ xác thực, quyền và dữ liệu nghiệp vụ.
- [x] Tổ chức hướng dẫn theo thư mục và bộ tài liệu kiến trúc/API/UI/đánh giá.
- [x] Giới hạn bản đầu chỉ đọc; đặt/hủy/thanh toán đi qua màn hình nghiệp vụ.

## D1 — FAQ có nguồn chạy xuyên hệ thống

### Phần đã triển khai

- [x] Contract chat/reset, start/resume/final, evidence/citation, lỗi và budget: [API.md](API.md).
- [x] FastAPI: service auth, body cap 128 KiB, request ID, validation, `/health`, `/ready` và lifecycle: [main.py](../app/main.py), [boundary.py](../app/api/boundary.py).
- [x] Gemini REST qua HTTPX, model mặc định `gemini-3.1-flash-lite`; structured output, response cap 256 KiB, không retry: [gemini.py](../app/providers/gemini.py).
- [x] Budget tích lũy: đường Spring cấp tối đa 20 giây, 8000 input/2000 output tokens, hai generation; mỗi generation có countTokens trước: [contracts.py](../app/providers/contracts.py).
- [x] Ingestion Markdown offline theo allowlist; kiểm tra approval/hiệu lực, chia section, manifest/checksum, snapshot tách mode: [snapshot.py](../app/ingestion/snapshot.py).
- [x] Retrieval SQLite FTS5/BM25, chuẩn hóa tiếng Việt/Wi-Fi, tối đa ba evidence; kiểm tra lại snapshot/nguồn trước query: [index.py](../app/retrieval/index.py).
- [x] FAQ orchestration: classify → một retrieval → reviewed preflight → typed answer → gate/renderer; missing support/coverage abstain, malformed references là protocol error: [faq.py](../app/orchestration/faq.py).
- [x] Spring facade chat/reset, cookie phiên, owner/TTL/capacity, idempotency, kiểm tra response và chặn business tool calls: [AssistantController.java](../../BE/src/main/java/com/example/pbl6/controller/assistant/AssistantController.java), [AssistantSessions.java](../../BE/src/main/java/com/example/pbl6/service/assistant/AssistantSessions.java), [AssistantClient.java](../../BE/src/main/java/com/example/pbl6/service/assistant/AssistantClient.java).
- [x] Widget opt-in, nguồn và nhãn synthetic, loading/error/cancel, keyboard/focus, reset khi đổi account và bỏ phản hồi muộn: [AssistantWidget.jsx](../../FE/src/components/assistant/AssistantWidget.jsx).
- [x] Diagnostics D1.8 phân biệt provider/index/deadline; HTTP timing D1.10 qua trace theo request, queue có giới hạn và sink không chặn cancellation: [diagnostics.py](../app/diagnostics.py), [HTTP timing](D1.10_HTTP_TIMING.md).
- [x] Sửa độ cô lập test HTTP timing D1.10.1; chuẩn bị verified SSL context trước deadline, điều khiển sink bằng handshake; không nới deadline runtime.

### Bằng chứng kiểm chứng đã có

| Phạm vi | Kết quả đã ghi nhận | Giới hạn |
| --- | --- | --- |
| Python sau D1.10.1, 14/11 | 218/218 unit/integration pass; nhóm timing 79/79; Ruff check/format và pip check qua | Offline, outbound guard; một warning Starlette/HTTPX. Không chứng minh Gemini ổn định |
| Spring sau merge main, 14/11 | 19/19 test thuộc sáu lớp được chọn; package local-h2 thành công | Không phải toàn bộ BE suite; không dùng booking/MySQL thật |
| FE sau merge main, 14/11 | 8/8 test; lint/build riêng thành công; E2E fake 3/3 | Có warning lint/bundle; fake kiểm tra wiring/UI/quyền |
| Browser Gemini thật, 13/11 | 3/3 E2E pass | Từng có 503 ở lượt đầu; không thay thế batch hoặc nghiệm thu grounding |
| Retrieval-only | Gold evidence trong top 3 ở 8/8 ca có gold | Corpus synthetic nhỏ; không phải độ đúng câu trả lời |
| Live 13/11 | 15/24 đúng trạng thái; 7 deadline, 2 dependency failures | Chưa xác định nguyên nhân sâu của hai dependency errors |
| Live D1.9, 14/11 | 18/24 đúng trạng thái; 6 deadline, 0 dependency failures | Một batch; 9 lỗi cũ qua nhưng 6 ca từng qua lại timeout; chưa chứng minh cải thiện ổn định |
| Live D1.15, 20/11 | 10/24 đúng trạng thái; 9 application deadlines, 5 HTTP 503; đủ 24 attempted | Đúng một batch collector ở tầng FAQ/provider; đủ provenance cho 10 final, đã review offline tại D1.16; chưa có review độc lập hoặc nghiệm thu semantic |

Nguồn lịch sử: foundation/provider/ingestion/FAQ/widget và kiểm chứng đã được ghi trong các commit trước baseline; kết quả D1.10.1 tại `e1ec7c8`, merge tại `d836c90`, điều tra test tại `7f333f2`. Hai báo cáo test đã được gộp vào file này; bản đầy đủ vẫn có trong Git của các commit đó.

Chi tiết D1.9 và bảng từng ca: [D1.9_LIVE_DIAGNOSTIC.md](D1.9_LIVE_DIAGNOSTIC.md). Artifact ignored đã đọc trực tiếp: `ai-service/.local/assistant-evaluation/d1.9/20261114T121542_50bf6c59/summary.json`, xác nhận 24 attempted, 18 final/matched, 6 `DEADLINE_EXCEEDED`, 37 countTokens + 37 generateContent. Artifact này không lưu câu trả lời để chấm grounding.

Trong batch D1.9, 5 timeout ở classify/generateContent, 1 ở answer/generateContent; diagnostics ghi application deadline, không ghi HTTPX timeout. Chưa tách được thời gian network/provider. p50/p95 nearest-rank của **toàn bộ 24 ca**: 7205,71/20015,33 ms; riêng 18 final: 4317,47/19412,23 ms. Usage 12562 input/1635 output chỉ của final; tổng chi phí chưa đo.

### Quality gates còn mở sau quyết định chấp nhận milestone D1

- [x] Chứng minh một FAQ có nguồn chạy end-to-end bằng Gemini thật.
- [x] Có kiểm thử offline cho schema/auth, thiếu nguồn, lỗi dependency, cancellation và cô lập phiên.
- [ ] Khắc phục/đánh giá độ ổn định live; D1.15 còn 9/24 deadline và 5/24 HTTP 503, vẫn là blocker; D1.9 trước đó có 6/24 deadline.
- [ ] Hoàn tất review grounding, citation identity/support/coverage và abstention cho từng final theo tiêu chí nghiệm thu; D1.16 đã có review offline 10 final, còn thiếu rà độc lập và chấp nhận kết quả.
- [ ] Chốt tiêu chí chất lượng/latency nghiệm thu; không tự coi HTTP 200 hoặc status đúng là nội dung đúng.
- [ ] Corpus thật được người phụ trách duyệt, có version/hiệu lực, trước khi phục vụ production. Đây là điều kiện phát hành production riêng với demo synthetic.

[Audit grounding có sẵn](D1.11_GROUNDING_CITATION_AUDIT.md) chỉ đối chiếu được nội dung hai câu FAQ baseline với fixture; thiếu provenance của evidence từng lượt. D1.9 không lưu answer/citation/evidence/query nên **18 final chưa đủ dữ liệu chấm nội dung**, sáu ca lỗi không có final. D1.16 đã review 10 final D1.15 có provenance, nhưng chưa có rà độc lập/tiêu chí được chấp nhận để đóng nghiệm thu grounding; không dùng review đó chấm hồi tố D1.9. File audit đang có lỗi ký tự tiếng Việt trong bản nháp; giữ nguyên vì chứa rubric/gap ledger riêng.

### Giới hạn vận hành

- Assistant mặc định disabled/opt-in; demo synthetic chỉ được Spring chấp nhận ở profile local, UI hiện nhãn; production không nhận snapshot demo và không tự fallback sang fake.
- Startup cần token nội bộ, key, index hợp lệ và probe thật tối đa 5 giây. Dependency failure loại `DEPENDENCY_UNAVAILABLE` trong turn giữ service not-ready đến restart; deadline đơn thuần không bật latch này.
- Phiên Spring in-memory, chưa hỗ trợ nhiều instance/Redis; reset chat không thu hồi JWT toàn hệ thống.
- Lexical retrieval hạn chế paraphrase. Citation ID hợp lệ chưa chứng minh support; Phase 3 kiểm closed typed facts với gate bắt buộc, còn phụ thuộc tính đúng của catalog review.
- Validate index đầu turn ở trước budget; I/O SQLite/checksum còn đồng bộ. Chưa có bằng chứng đây là nguyên nhân timeout Gemini.
- Chưa kiểm tra bàn phím mềm trên thiết bị mobile thật, tổng chi phí hoặc benchmark production.

## D2 — Phòng, giá và dịch vụ: đã triển khai bản đầu (chờ kiểm chứng live & nghiệm thu)

- [x] Nối `search_rooms` (`RoomCatalogService.findAvailableRooms`) và `list_services` (`CustomerBillingService.getActiveServices`) in-process qua `AssistantToolBroker` tại Spring; đồng bộ key cọc `hotel.bank.deposit-percentage` trong `RoomCatalogServiceImpl`; hỏi lại (`needs_clarification` + `missingFields`) khi thiếu ngày nhận/trả hoặc số khách.
- [x] Trả giá/currency (`VND`)/đơn vị/`priceScope="room_charge_estimate"` từ backend, chặn ép giá `null` thành `0` (`DATA_UNAVAILABLE`); Python dùng `ContinuationStore` single-use (TTL ≤ 120s, replay `409`) và deterministic renderer ở `phase=resume` (0 lượt LLM thêm).
- [x] Spring `AssistantOrchestrator` + `AssistantClient` giữ Turn Ledger để lắp ráp `cards` (`room`/`service`, có `retrievedAt`, loại bỏ `roomNumber`/`floor`/`note`/`status`) và lọc `actions` theo allowlist (`open_room_search` → `/booking`, `open_services` → `/guest/services` chỉ cho `CUSTOMER`); [AssistantWidget.jsx](../../FE/src/components/assistant/AssistantWidget.jsx) hiển thị thẻ phòng/dịch vụ và link an toàn.
- [x] Kiểm thử offline/mock cho ngày sai, hết phòng (`no_results`), giá nguồn `null` (`DATA_UNAVAILABLE`), dịch vụ ngừng hoạt động, tool ngoài allowlist/giả mạo card/action (`502 AI_PROTOCOL_ERROR`), vượt budget (`503 BUDGET_EXCEEDED`), replay continuation (`409`) và lỗi backend (`DEPENDENCY_UNAVAILABLE`). *(Chưa chạy E2E live qua Gemini + MySQL thật.)*
- [ ] Đánh giá E2E live (Gemini thật + Spring + MySQL + trình duyệt) và ký nghiệm thu D2 theo tiêu chí đầu ra.
- [ ] Nếu cần, đánh giá ranker ưu tiên mềm sau lọc điều kiện cứng; đây là tùy chọn, không là điều kiện để FAQ/D2 chạy.

## D3 — Booking cá nhân: đã triển khai và kiểm chứng offline + live MySQL

- [x] Rà/sửa quan hệ `Account ↔ Customer` và xóa fallback `accountId` / `email` / `phone` chưa xác minh trong [CustomerHistoryServiceImpl.java](../../BE/src/main/java/com/example/pbl6/service/CustomerHistoryServiceImpl.java), [AuthServiceImpl.java](../../BE/src/main/java/com/example/pbl6/service/AuthServiceImpl.java), [CustomerBookingServiceImpl.java](../../BE/src/main/java/com/example/pbl6/service/CustomerBookingServiceImpl.java) và [DataInitializer.java](../../BE/src/main/java/com/example/pbl6/config/DataInitializer.java) trước khi mở tool.
- [x] Spring kiểm tra principal `ROLE_CUSTOMER` + ownership FK `Customer.account.accountId == account.accountId` trước khi tạo DTO tối thiểu (`BookingItem`/`BookingDetail`), không gửi JWT/PII/QR/số phòng/note sang Python/model.
- [x] Ràng buộc tool call/result/continuation với phiên/account, TTL và cancellation; lỗi sai chủ hoặc không tồn tại trả đồng nhất `NOT_FOUND` (chống existence oracle).
- [x] Kiểm tra offline & live MySQL: A không đọc được booking B dù biết mã/trùng `accountId`/trùng email-SĐT; guest nhận `requires_login` + `open_login`, JWT hỏng bị 401; logout/đổi account xóa sạch hội thoại riêng và không lưu booking vào storage trình duyệt.
- [ ] Ký nghiệm thu D3 và chạy kiểm thử cách ly tải lớn / nhiều tài khoản khách hàng song song trước production.

## D4 — Câu hỏi kết hợp và nghiệm thu mở rộng: đã triển khai và kiểm chứng offline + smoke live MySQL

- [x] Ghép booking đã cấp quyền (`get_my_booking` / `list_my_bookings`) với policy đã duyệt đúng phiên bản/hiệu lực qua Phase 3 Verification Gate (`booking_with_policy`, `CombinedPolicyContext`); giữ nguyên cảnh báo không tự tính hoàn tiền/phí cuối cùng, và từ chối fail-closed (`requires_login` cho guest, `no_results` thống nhất cho đơn lạ, `insufficient_evidence` khi thiếu nguồn chính sách).
- [x] Tool broker & continuation có allowlist, call ID duy nhất, số vòng (`<= 2` batches / `<= 4` tool calls), deadline 20s, budget tích lũy (`min_tool_calls=2` cho câu kết hợp) và kiểm thử đơn vị/tích hợp trên cả Python lẫn Spring (`AssistantOrchestratorTest`, `test_d4_combined_booking_policy.py`).
- [x] Mở rộng dataset đánh giá 80 ca synthetic theo [EVALUATION.md](EVALUATION.md) ([d4_suite.json](../tests/evaluation/d4_suite.json): 6 nhóm × 10 = 60 ca + 20 ca kết hợp/ngoài phạm vi/bảo mật-lỗi, tách `dev`/`held_out` theo `paraphraseGroup`) kèm runner [run_d4_eval.py](../tests/evaluation/run_d4_eval.py) và unit test [test_d4_evaluation_suite.py](../tests/unit/test_d4_evaluation_suite.py).
- [x] Cập nhật runbook vận hành D1–D4 trong [README.md](../README.md) và chạy smoke live kết hợp trên MySQL thật + Qdrant + Gemini thật.
- [ ] Duyệt corpus/catalog production thật, ký nghiệm thu chính thức D2–D4 và đánh giá batch độ ổn định/chi phí live dài hạn trước khi mở production.

## Ranh giới Local, Staging, Production và phát hành

Local dưới đây mô tả hành vi đã có; Staging/điều kiện phát hành là yêu cầu đề xuất, chưa phải hạ tầng đã provision hoặc đã kiểm chứng. Môi trường triển khai và `AI_CORPUS_MODE` là hai khái niệm khác nhau; không thêm profile hay mode mới trong lượt này.

| Môi trường | Ranh giới dữ liệu và truy cập | Điều kiện cho phép sử dụng/phát hành |
| --- | --- | --- |
| Local | Opt-in tường minh; demo synthetic có snapshot riêng và nhãn UI; Spring chỉ chấp nhận demo ở profile local. Fake chỉ ở entrypoint test có nhãn; production mode vẫn phải kiểm tra approval | Dùng phát triển/demo theo [runbook](../README.md); fake E2E không chứng minh model thật, model thật trên synthetic không chứng minh chính sách khách sạn hoặc sẵn sàng production |
| Staging — đề xuất, chưa xác minh | Môi trường hạn chế truy cập, gần production; dùng production corpus mode, nguồn công khai đã duyệt không chứa dữ liệu cá nhân, credential tách môi trường, TLS và origins được giới hạn. Không bật synthetic bằng profile local để gọi đó là staging | Cần xác định/provision môi trường, kiểm tra cấu hình/quyền và chạy regression áp dụng; live đánh giá chỉ theo phạm vi riêng đã được giao. Không suy đã có staging từ test server local hoặc tự cho phép booking thật |
| Production — chưa đủ điều kiện phát hành | Corpus thật được duyệt/có hiệu lực; service credential ngoài browser/model/log; TLS, origins/access và cấu hình triển khai được kiểm chứng; chỉ bật khả năng đã nghiệm thu | Đạt gate của giai đoạn được phát hành, có kết quả staging và bản ghi chấp nhận theo tiêu chí định trước; xác định người vận hành, giám sát lỗi/deadline/readiness và quy trình tắt/khôi phục assistant. Chưa có đủ bằng chứng cho các điều kiện này |

Phát hành FAQ chỉ cần các gate áp dụng đến D1 và gate môi trường, không cần đợi D2–D4; việc bật tool sau này cần nghiệm thu giai đoạn tương ứng. Phiên hiện giữ in-memory: chưa được suy hỗ trợ nhiều instance; phạm vi single-instance, giới hạn tải và mất phiên khi restart phải được đánh giá/chấp nhận trước release. Monitoring và quy trình tắt/khôi phục là yêu cầu cần kiểm chứng, không phải tính năng mới đã làm; không sửa deadline/model/retry để bỏ qua blocker.

## Ma trận regression

Ma trận xác định kiểm tra cần chọn khi có thay đổi, không phải báo cáo chạy mới. Lệnh và thư mục làm việc lấy từ [README — kiểm chứng D1](../README.md#kiểm-chứng-d1); không chạy lại batch chỉ để cập nhật tài liệu.

| Khi thay đổi | Tầng/ca regression | Runner hoặc nguồn hiện có | Bằng chứng và trạng thái phủ hiện tại |
| --- | --- | --- | --- |
| Chỉ tài liệu | Link/anchor, code fence, đường dẫn/command, số liệu và trạng thái nhất quán | Script Markdown stdlib đọc file; `git diff --check -- ai-service/docs/PROCESS.md` | Diff chỉ đúng tài liệu; không thay checkbox/số liệu lịch sử; chạy trong lượt này, ghi kết quả bàn giao |
| API/schema/auth hoặc lifecycle Python | Auth trước body, validation/body cap/ID, health/readiness, resume từ chối | Pytest unit/integration và Ruff/pip check theo README | Có test hiện hành; kết quả 218 pass là lịch sử toàn suite, không phải pass mới cho từng nhóm |
| Provider/prompt/budget/timing | HTTP/schema/error mapping, ngân sách tích lũy, không retry, cancellation/cleanup/successor, log redaction/sink | Pytest provider/diagnostics/HTTP timing trong unit/integration | Offline có mock/outbound guard; cần regression theo phạm vi, không suy ổn định Gemini thật |
| Corpus/chunking/retrieval | Approval/hiệu lực/mode/checksum/revocation, top-k và gold evidence | Pytest ingestion; evaluation `--retrieval-only` theo README | Có test và baseline synthetic 8/8; runner evaluation có thể build snapshot/ghi artifact, không chạy trong lượt chỉ tài liệu |
| Spring contract/identity/session | Schema/ID/citation/budget, JWT hỏng, owner/TTL/reset/idempotency và phiên A/B | Các lớp Assistant và test hồi quy được chọn trong lệnh Maven của README | 19 test được chọn pass lịch sử; không phải toàn BE suite hoặc bằng chứng booking tool đã an toàn |
| Widget/API client/wiring | Text/nguồn/demo badge, error/cancel, focus/mobile, đổi account và phản hồi muộn | FE tests/lint/build; Playwright E2E với `D1_LIVE_GEMINI=0` | 8 FE và 3 fake E2E pass lịch sử; bàn phím mềm trên thiết bị thật chưa kiểm tra |
| Provider/model/prompt/corpus cần nghiệm thu thật | Reliability toàn batch, thiếu nguồn/capability, review claim/citation/abstention với provenance; browser live | Runner `--live` và E2E `D1_LIVE_GEMINI=1` theo README, chỉ khi được giao riêng | Có kết quả lịch sử nhưng D1 còn mở; cần criteria/run design định trước và artifact synthetic đủ dữ liệu chấm. Không chạy trong lượt này |
| Tool/DTO/ownership/orchestration D2–D4 | Giá/dữ liệu sống đổi, lọc cứng, tool lạ/call ID/budget; A/B booking, policy version và câu kết hợp | Ca bắt buộc trong [EVALUATION.md](EVALUATION.md); runner/test cho tool chưa triển khai | Coverage mục tiêu, không có test tool đã chạy; không gán pass từ test nghiệp vụ hoặc FAQ hiện có |

## Risk register — blocker và khoảng trống có bằng chứng

Mức chặn gắn với gate bị ảnh hưởng, không ước lượng xác suất hoặc suy nguyên nhân chưa đo. Biện pháp hiện có chỉ giới hạn phạm vi, không tự đóng rủi ro.

| ID / gate bị ảnh hưởng | Bằng chứng hiện có | Giới hạn/biện pháp hiện tại | Việc còn lại và bằng chứng đóng |
| --- | --- | --- | --- |
| R1 — chặn D1 reliability/release | [D1.9](D1.9_LIVE_DIAGNOSTIC.md): 6/24 application deadlines; D1.15: 9/24 application deadlines và 5/24 HTTP 503; nguyên nhân sâu network/provider chưa rõ | Budget 20 giây, không retry/fake fallback; D1 giữ mở, assistant opt-in | Phân tích artifacts/timing D1.15 đã lưu; mọi batch mới cần giao riêng, không chạy bù. Lưu cả lỗi và toàn bộ latency, không chỉ ca thành công |
| R2 — chặn D1 grounding/citation | D1.9: 18 final thiếu provenance; D1.16 review 10 final D1.15 chỉ có một FAQ claim có citation. D1.17 fake provider cố ý sai: supported=true với citation hợp lệ nhưng không hỗ trợ claim vẫn được trả answered | Có review offline có mẫu số rõ và test thể hiện giới hạn semantic gate; không phải bằng chứng Gemini thật đã sinh claim sai. Chưa có review độc lập/đại diện production | Rà độc lập rubric D1.16, đánh giá trên corpus/gold được duyệt và quyết định xử lý semantic gate trong phạm vi riêng; không chấm hồi tố D1.9 bằng replay |
| R3 — chặn corpus Staging/Production | [Knowledge](../knowledge/README.md) còn approved=false/pending_review; chưa có policy thật đủ điều kiện | Production từ chối draft/demo; snapshot tách mode | Người phụ trách duyệt nội dung/nguồn/version/hiệu lực; build/validate snapshot và regression trên nguồn được duyệt; không tự suy ngày hiệu lực |
| R4 — chặn mở booking D3 | [API — điều kiện booking](API.md#điều-kiện-trước-khi-mở-booking-tools): fallback email/SĐT và quan hệ account/customer phải rà | D1 không có booking tools; chưa kết luận đã xảy ra lộ booking qua assistant | Chứng minh/sửa ownership theo principal và DTO tối thiểu; kiểm thử A/B, guest/JWT hỏng, logout/late result và lưu giữ dữ liệu trước bật tool |
| R5 — chặn xác nhận deployment/release | Phiên in-memory; chưa có bằng chứng staging, nhiều instance, giới hạn tải hoặc runbook vận hành được nghiệm thu | Assistant mặc định disabled/opt-in, demo local | Provision/kiểm chứng staging; chốt single-instance và tải cho phép hoặc thiết kế mở rộng riêng; kiểm tra TLS/origins/readiness, giám sát và tắt/khôi phục với người chịu trách nhiệm |
| R6 — chặn ký nghiệm thu chất lượng/chi phí | Summary D1.9 ghi totalCost=not_measured; usage chỉ của 18 final; chưa có ngưỡng/SLO và số lần lặp thống nhất | Giới hạn token/call/deadline, báo rõ mẫu số; không coi usage final là tổng phí | Chốt chỉ tiêu, ngân sách/phạm vi đo và cách tính phần request lỗi; báo tổng hoặc giới hạn đo được, người nhận trách nhiệm ký nghiệm thu. Không tự thêm giá/SLO |
| R7 — cần đánh giá deadline trước release | [Luồng hiện tại](architecture.md): validate index ban đầu trước budget, SQLite/checksum đồng bộ | Kiểm tra integrity/approval còn được giữ; chưa có bằng chứng đây là nguyên nhân 6 timeout | Đo thời gian toàn request/index và responsiveness trong phạm vi riêng; đối chiếu deadline đã cam kết. Không gộp với lỗi timing test D1.10.1 hoặc tự đổi runtime |

## ADR nhẹ và quyết định còn mở

Dùng ADR khi thay provider/index, mô hình quyền/phiên, topology hoặc chính sách vận hành có đánh đổi đáng kể; không cần ADR cho mỗi chỉnh sửa câu chữ. Chưa tìm thấy convention ADR riêng; mẫu inline dưới đây không tạo thêm thư mục/file hay phê duyệt hồi tố lựa chọn hiện có.

```text
ADR-<ID>: <Tên quyết định>
Ngày: <YYYY-MM-DD> | Trạng thái: Proposed / Accepted / Superseded / Deprecated
Bối cảnh và bằng chứng: <vấn đề, nguồn, giới hạn>
Quyết định: <phạm vi và lựa chọn; còn Proposed khi chưa được chấp nhận>
Phương án khác và lý do không chọn: <đánh đổi>
Hệ quả: <lợi ích, rủi ro, chi phí/compatibility>
Kiểm chứng và người chấp nhận: <gate, bằng chứng, trách nhiệm đã được xác nhận>
Thay thế/được thay thế bởi: <ID hoặc không áp dụng>
```

Giữ bản ghi quyết định cũ khi bị thay thế, liên kết quyết định mới thay vì xóa lịch sử. Các quyết định chưa chốt: ngưỡng chất lượng/reliability/latency/chi phí và số lần lặp; hạ tầng/truy cập Staging; người duyệt corpus/ký nghiệm thu/vận hành; phạm vi single-instance/giới hạn tải và quy trình monitoring/tắt/khôi phục. Chỉ biết nguồn còn chờ duyệt, không tự gán người duyệt. Ghi rõ trạng thái còn mở, không tự đánh dấu hoàn thành hoặc triển khai để lấp chỗ trống.

## Quy trình cho bước tiếp theo

1. Đọc file này và kiến trúc; kiểm tra Git và AGENTS theo phạm vi. Chỉ triển khai lát được giao, giữ thay đổi ngoài nhiệm vụ.
2. Ưu tiên đóng khoảng trống D1: rà độc lập D1.16/D1.17 và contract/test specification D1.19 kế thừa thiết kế D1.18. Nếu được giao triển khai tiếp, bắt đầu prototype offline đúng schema v2/oracle G01–G20 trên synthetic facts/question bindings; chưa tự wire runtime hoặc đổi prompt/schema. Đánh giá semantic support, coverage/false-abstention trên gold độc lập; offline tests không xác định nguyên nhân upstream của 503/deadline. Không tự chạy thêm batch hoặc đổi model/prompt/deadline/retry; mọi live investigation tiếp theo cần giao riêng.
3. Kiểm chứng đúng tầng: offline cho logic/boundary, live cho provider, review evidence cho grounding. Ghi command, ngày, commit, dataset/snapshot và hạn chế.
4. Cập nhật checklist/bằng chứng trong file này; sửa API/kiến trúc/UI khi hành vi thay đổi. Tạo nhánh/commit đúng phạm vi, không tự push/deploy.

## Sắp xếp tài liệu — lần gộp tại c031267 (lịch sử)

- [x] Gộp lộ trình và trạng thái vào `PROCESS.md`; bỏ các khẳng định cũ mâu thuẫn với runtime D1.
- [x] Gộp hai báo cáo điều tra/ổn định test vào phần bằng chứng ở trên. Nguyên nhân test: nạp CA/SSL context đồng bộ vượt cửa sổ event 1 giây và sink tự nhả sau 2 giây; sửa test ở D1.10.1, không coi đây là root cause timeout live.
- [x] Giữ API, kiến trúc, UI, kế hoạch đánh giá, báo cáo live/timing và audit có nội dung riêng. Giữ hướng dẫn AGENTS và knowledge; không phục hồi các file cũ đang bị người dùng xóa.

Bản README gốc repository đang là thay đổi nháp có sẵn, còn mô tả AI chỉ có thiết kế; lượt này giữ nguyên bản nháp ngoài phạm vi commit. Dùng README của ai-service và kiến trúc này làm nguồn hiện hành cho assistant.

Kiểm tra của lần gộp: script Python stdlib kiểm tra đường dẫn liên kết/code fence trong Markdown hiện có, đọc và đối chiếu JSON summary D1.9; `git diff --check` qua. Hash snapshot xác nhận không đổi runtime hoặc nội dung ngoài phạm vi; staging ban đầu được đối chiếu riêng khi commit. Không chạy lại Python/Spring/FE/E2E; không cài dependency, model hoặc dịch vụ mới. Số file/liên kết kiểm tra cuối được ghi trong thông báo bàn giao của lần gộp.

Lượt bổ sung gate/process dựa trên HEAD `c031267`: chỉ sửa file này; giữ trạng thái giai đoạn, checkboxes và số liệu lịch sử. Kiểm tra diff, links/anchors/fences, source/command tham chiếu và bảo toàn Git staging/nội dung ngoài phạm vi; kết quả ghi ở bàn giao. Không chạy runtime/live Gemini, không cài thêm gì, không commit/push hoặc triển khai D2.

## Kiểm chứng offline deadline/HTTP cancellation — 2026-11-19

- Nhánh `test/d1-faq-deadline-cancellation`, baseline HEAD `c031267`. Thêm [test FAQ/HTTP deadline](../tests/integration/test_faq_http_deadline.py): ba luồng classify, answer và refund-shaped, mỗi luồng chặn generateContent ở headers hoặc body, tổng cộng sáu ca synthetic. Tái sử dụng public core transport/backend/frames; fixture capture HTTP timing được chuyển sang conftest integration để dùng chung với test provider.
- Clock chỉ trong test đồng bộ budget, asyncio và hai logger; refund-shaped tiến 19 giây giả lập trong classify rồi retrieval/countTokens thành công, answer bị deadline chung hủy. Kiểm tra cùng budget/start time xuyên turn, giới hạn 20 giây không đổi, application_deadline, correlation diagnostic/attempt IDs, không retry, cleanup trước đóng client và lượt tiếp theo thành công trên cùng client/transport.
- Kết quả: **90/90 test offline được chọn pass** (sáu ca mới, 79 HTTP timing hiện có và năm ca deadline/budget liên quan); một warning Starlette/HTTPX đã có. Ruff check/format-check ba file test được sửa/thêm qua. Đây là tập kiểm tra liên quan, không phải toàn suite; không chạy FE/Spring hoặc Gemini thật.

Lệnh thực tế từ `ai-service`:

```powershell
.\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests/integration/test_faq_http_deadline.py tests/integration/test_http_timing_provider.py tests/integration/test_http_timing_transport.py tests/unit/test_http_timing.py tests/integration/test_d1_observability.py::test_outer_deadline_cancels_active_http_and_preserves_source tests/integration/test_d1_observability.py::test_turn_shares_budget_across_classify_retrieval_answer tests/unit/test_provider_diagnostics.py::test_fake_clock_preserves_cumulative_time_and_call_budget tests/unit/test_diagnostic_lifecycle.py::test_inner_application_timeout_is_not_http_timeout --tb=short
.\.venv\Scripts\ruff.exe check tests/integration/conftest.py tests/integration/test_faq_http_deadline.py tests/integration/test_http_timing_provider.py
.\.venv\Scripts\ruff.exe format --check tests/integration/conftest.py tests/integration/test_faq_http_deadline.py tests/integration/test_http_timing_provider.py
```

Không đổi source runtime, timeout/configuration hoặc production instrumentation; không thêm dependency/model/dịch vụ, không live/commit/push. TLS/network vẫn synthetic; các ca mới kiểm tra cơ chế và hình dạng luồng, không replay sáu lỗi lịch sử hoặc xác định nguyên nhân network/provider D1.9. **D1 vẫn mở**, chưa có bằng chứng live/grounding mới.

## D1.13a — standalone collector, kiểm chứng offline — 2026-11-19

- Nhánh `feature/d113a-synthetic-collector`, HEAD baseline `c031267`; giữ nguyên draft PROCESS và các regression trước đó. Thêm entrypoint [collect_d1_live.py](../tests/evaluation/collect_d1_live.py), module schemas/privacy/export và recording wrappers trong `tests/evaluation/`; không sửa `app/`, legacy runner hoặc dependency.
- Preflight pin snapshot/dataset/fixture, chỉ đọc, không build/overwrite; CLI mặc định validate-only, chỉ `--live` tường minh mới có thể tạo provider thật. Recording Faq/Gemini/KnowledgeIndex lưu input/query/context, evidence thực nhận/thực gửi, parsed output, final/full citations và model version quan sát theo generation; failed generation không kế thừa version cũ.
- Correlation case→diagnostic→HTTP attempt từ hooks/trace observer; capture có giới hạn, reconciliation báo missing/ambiguous/unavailable/omitted/partial và cutoff sequence. Export atomic ở ranh giới ca, privacy checks trước persist, safe failure/not-run summary, metadata retention 14 ngày full/90 ngày summary. [EVALUATION.md](EVALUATION.md#d113a--collector-synthetic-độc-lập) ghi schema, caps, stopping rules và hạn chế.
- **120/120 test offline liên quan pass**: 30 collector checks và 90 deadline/timing regression trước đó; một warning Starlette/HTTPX đã có. Ruff check/format-check năm file Python mới qua. Lần chạy kết hợp đầu phát hiện collector restore logger về NOTSET sau khởi tạo emitter, khiến INFO timing của test tiếp theo bị lọc; đã sửa lifecycle trong collector và chạy lại cùng ma trận thành công, không đổi production instrumentation.
- Đã chạy CLI `--validate-only` trên snapshot D1.9 hiện có: trả `validated`, `live=false`, 24 ca; không tạo artifact run mới, không đọc Settings/key hoặc gọi provider. Nội dung snapshot/artifact cũ và staging ngoài nhiệm vụ được giữ nguyên. Không chạy live Gemini, không commit/push, không cài thêm gì. **D1 chưa nghiệm thu**; test synthetic không giải thích nguyên nhân sáu timeout lịch sử hay chấm grounding thật.

Lệnh kiểm tra từ `ai-service`:

```powershell
.\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests/unit/test_d1_collector.py tests/integration/test_d1_collector_integration.py tests/integration/test_faq_http_deadline.py tests/integration/test_http_timing_provider.py tests/integration/test_http_timing_transport.py tests/unit/test_http_timing.py tests/integration/test_d1_observability.py::test_outer_deadline_cancels_active_http_and_preserves_source tests/integration/test_d1_observability.py::test_turn_shares_budget_across_classify_retrieval_answer tests/unit/test_provider_diagnostics.py::test_fake_clock_preserves_cumulative_time_and_call_budget tests/unit/test_diagnostic_lifecycle.py::test_inner_application_timeout_is_not_http_timeout --tb=short
.\.venv\Scripts\ruff.exe check tests/evaluation/collect_d1_live.py tests/evaluation/d1_collector_schema.py tests/evaluation/d1_collector_capture.py tests/unit/test_d1_collector.py tests/integration/test_d1_collector_integration.py
.\.venv\Scripts\ruff.exe format --check tests/evaluation/collect_d1_live.py tests/evaluation/d1_collector_schema.py tests/evaluation/d1_collector_capture.py tests/unit/test_d1_collector.py tests/integration/test_d1_collector_integration.py
```

Giới hạn: chưa có live run cho collector; trace client không tách được provider queue/compute khỏi network. Privacy dựa trên nguồn synthetic đã pin, credential đã biết và patterns, không bảo đảm nhận diện mọi PII tự do. Không thêm auto-cleanup hoặc hard-kill watchdog; retention cần thao tác riêng, writer/hard-kill có thể để run chưa finalize. Capture limits là bytes encode, không phải RSS hay tổng phí upstream.

## D1.13c — sửa cancellation/finalization của collector, offline

- Nhánh `fix/d113c-collector-finalization`, HEAD `c031267`. D1.13b trước sửa: 161 pass, hai regression fail trong ma trận 163 ca; tái hiện riêng hai lỗi trước khi sửa. Giữ toàn bộ test D1.13b và sáu ca deadline D1.12, không sửa runtime/legacy runner, timeout, model, prompt, dependencies hoặc snapshot.
- Catch cancellation ở cả settling ngoài FAQ: ghi `user_cancelled`, reconcile phần đã quan sát, cập nhật marker ca, export/cleanup rồi re-raise; ca chưa chạy mang cùng reason. Ca đã có final không bị đổi thành lỗi model.
- Finalization ghi checkpoint với manifest `stopped`, summary trước và manifest cuối sau. Chỉ ghi completed sau khi các artifact bắt buộc đã xuất; summary chứa hash manifest cuối dự kiến. Summary-write failure giữ manifest stopped. Lỗi completion marker sẽ sửa summary thành stopped nếu còn ghi được; nếu disk hỏng tiếp thì marker stopped/hash mismatch vẫn chặn coi run đã finalize. [EVALUATION.md](EVALUATION.md#d113c--finalization-và-privacy-bounds) ghi protocol và giới hạn nhiều file.
- Có bằng chứng performance cho privacy scan trước size gate: alphabetic 1024/2048/4096 ký tự mất khoảng 4,5/18,8/75,3 ms; probe vượt cap bị dừng sau ba giây trong process cô lập. Đưa kiểm tra encoded bytes lên trước scan; cùng probe sau sửa trả `capture_limit` khoảng 0,8 ms. Không đổi patterns hoặc bỏ privacy checks cho payload trong cap; ba test spy kiểm tra thứ tự mà không dùng ngưỡng thời gian dễ flaky.
- Kết quả ma trận đầy đủ: **170 passed, một warning Starlette/HTTPX đã có, 64,03 giây**. Gồm 163 ca D1.13b được giữ và bảy ca mới (ba size gates, ba failure/recovery finalization, một completion-order/hash integrity). Ruff check và format-check năm file collector/test qua; kiểm tra diff, links và bảo toàn nội dung ngoài phạm vi được báo ở bàn giao.

Lệnh từ `ai-service`:

```powershell
.\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests/unit/test_d1_collector.py tests/integration/test_d1_collector_integration.py tests/integration/test_faq_http_deadline.py tests/integration/test_http_timing_provider.py tests/integration/test_http_timing_transport.py tests/unit/test_http_timing.py tests/integration/test_d1_observability.py::test_outer_deadline_cancels_active_http_and_preserves_source tests/integration/test_d1_observability.py::test_turn_shares_budget_across_classify_retrieval_answer tests/unit/test_provider_diagnostics.py::test_fake_clock_preserves_cumulative_time_and_call_budget tests/unit/test_diagnostic_lifecycle.py::test_inner_application_timeout_is_not_http_timeout --tb=short
.\.venv\Scripts\ruff.exe check tests/evaluation/collect_d1_live.py tests/evaluation/d1_collector_schema.py tests/evaluation/d1_collector_capture.py tests/unit/test_d1_collector.py tests/integration/test_d1_collector_integration.py
.\.venv\Scripts\ruff.exe format --check tests/evaluation/collect_d1_live.py tests/evaluation/d1_collector_schema.py tests/evaluation/d1_collector_capture.py tests/unit/test_d1_collector.py tests/integration/test_d1_collector_integration.py
```

Không live Gemini, commit/push hoặc cài phần mềm/dịch vụ/dependency mới. Privacy scan trong cap vẫn chưa có giới hạn CPU riêng; hard kill, cancellation lần hai hoặc storage hỏng có thể mất phần RAM/chưa finalize. Chỉ xác nhận các regression offline của collector; **D1 vẫn mở**, không có bằng chứng live/grounding mới hoặc kết luận nguyên nhân sáu timeout D1.9.

## D1.14 — pre-live review, 2026-11-20 (chưa chạy live)

Review trên nhánh `review/d114-pre-live`, HEAD `c031267`; ghi nhận working tree có thay đổi chưa commit. Đối chiếu diff D1.13c tại đầu review với baseline D1.13b đã lưu: đúng sáu file, +136/−4 dòng; sửa cancellation/finalization và thứ tự size/privacy, thêm bảy ca test, cập nhật hai tài liệu. Git index và các thay đổi ngoài nhiệm vụ được giữ nguyên. Lượt D1.14 chỉ bổ sung phần review này.

| Gate | Kết quả | Bằng chứng/phạm vi |
| --- | --- | --- |
| Diff/Git và bảo toàn evidence | PASS | Đã đọc diff thực tế, không chỉ dựa vào HEAD vì collector/test còn untracked; giữ runtime, dependencies, snapshot, artifact lịch sử và staging |
| D1.12 | PASS | Sáu ca classify/answer/refund-shaped × headers/body còn đủ; file regression, shared conftest và test timing provider byte-identical baseline D1.13b |
| Collector và regression offline | PASS | Chạy lại đúng ma trận ở D1.13c: **170 passed, 1 warning Starlette/HTTPX, 77,50 giây**; gồm 80 collector + 90 deadline/timing; Ruff check và format-check năm file qua |
| Pinned snapshot preflight | PASS | CLI `--validate-only` trả validated/live=false/cases=24; không build hoặc ghi đè index, không tạo provider hay live run directory |
| Dataset/thứ tự/provenance | PASS | 24 ID duy nhất: 12 dev rồi 12 held-out theo thứ tự trong dataset đã pin, nhóm không giao nhau; tất cả payload có history rỗng, chỉ search_knowledge; hash fixture/dataset/index/manifest và 21 source files đã đối chiếu |
| Model/prompt/budget | PASS | Requested/configured model gemini-3.1-flash-lite, prompt d1-faq-1/hash khớp; mỗi turn 20000 ms, 8000 input/2000 output, 1 tool/0 broker; tối đa 2 generation/4 HTTP attempts mỗi ca, 48 countTokens + 48 generateContent toàn batch |
| Stop/capture/privacy | PASS | Dừng trước HTTP dispatch tiếp khi cap/drift/privacy/correlation lỗi hoặc 401/403/429; missing/duplicate expected events dừng, partial/unavailable được ghi rõ. Deadline/dependency/5xx ghi rồi tiếp ca sau nếu không có stop flag; không retry/probe/warm-up. Cap 256 KiB/ca, 32 KiB/event, 1024 events, 16 MiB/run; size gate trước scan, credential/pattern checks trước persist, runtime logs không chứa nội dung synthetic/credential trong test |
| Export/finalization/storage | PASS | Manifest completed ghi cuối, hashes đối chiếu đủ; summary đơn lẻ không chứng minh finalize. Cancellation/unrun reasons và writer failures qua test. Probe temporary cùng volume kiểm tra exclusive create + atomic replace, đã xóa riêng probe; parent không redirect, disk còn khoảng 103,8 GB tại review |
| Thực thi live trong lượt này | BLOCKED | Người dùng yêu cầu không gọi live. Chỉ xác nhận Settings hợp lệ/key hiện diện/model khớp bằng boolean, không in hoặc hash credential; chưa xác nhận remote key/quota/model availability bằng request |
| Nghiệm thu D1 | BLOCKED | Chưa có batch collector live/grounding mới; các gate offline không đóng D1 |

Fingerprint tại review (SHA-256):

- Dataset: `a3ce75ce3e421a956fa3f0f743e798bdc45fe25a8de21650906de3005752a03a`; fixture: `70c38269eeef80b828f7e8480be29833741cba81350a8bd426703ff1fa1c241f`.
- Snapshot ID: `971d9d5ef3cc285fd170ac79afcb496bd7315c4edf4076c9263289edd7e34d2d`; index.sqlite: `47933b5dcb3a78dc07fbef560730234eab09c621128a3e23769b2a56157e9ada`; snapshot manifest: `9666f19f5d4e341d1782057f8057b5c35ad8330752623d5e28dc287f38323e3c`.
- Prompt classify: `861c6baa847580a5df7dc8ea339ea20072af184c4e5d6b09e6e140598ac291ad`; answer: `44a56a3b6fd9803288687ddea7c7fe24c92f630906257f90cdc85ec80dca6f05`.
- Source-map fingerprint: `ff5345f902a6056856d836de08c2d03bae25d84141de91c9ec20c64d27a5ebd4`, tính SHA-256 của JSON manifest.source_sha256 với sort_keys=True, separators=(',',':'), UTF-8. Map gồm 21 file đã pin; không chứa .env hoặc secret. Context giữ ngày synthetic 2026-11-13, locale vi-VN, Asia/Ho_Chi_Minh, VND; started_at của run tương lai sẽ là UTC thực tế.

Lệnh validate-only đã chạy từ `ai-service`:

```powershell
.\.venv\Scripts\python.exe -B tests/evaluation/collect_d1_live.py --validate-only --snapshot-id 971d9d5ef3cc285fd170ac79afcb496bd7315c4edf4076c9263289edd7e34d2d
```

Lệnh chuẩn bị cho **một batch live duy nhất trong nhiệm vụ được giao sau**, chưa thực thi:

```powershell
Set-Location D:\University\PBL6\ai-service
.\.venv\Scripts\python.exe -B tests/evaluation/collect_d1_live.py --live --snapshot-id 971d9d5ef3cc285fd170ac79afcb496bd7315c4edf4076c9263289edd7e34d2d
```

Không có blocker offline mới cho một batch synthetic có giới hạn; 24 là số ca dự kiến, stop sớm phải giữ lý do cho các ca chưa chạy. Remote availability/key/quota chỉ có thể được quan sát khi batch tương lai thực thi, không thêm một probe riêng. Nếu source/snapshot/config đổi sau review thì kiểm tra lại gate tương ứng. Không tự chạy lại để chọn kết quả đẹp. Lưu sáu artifact ở run UUID mới dưới `.local/assistant-evaluation/d1-investigation/`; kiểm tra manifest/summary/hashes trước review nội dung. Privacy vẫn không phải detector PII tổng quát, scan trong cap không có CPU cap riêng, và hard kill/storage failure có thể mất phần RAM/chưa finalize. Không commit/push, cài thêm dependency/dịch vụ hoặc mở nghiệm thu D1.

## D1.15 — một batch collector live, 2026-11-20

Người dùng cho phép đúng một lần chạy sau D1.14. Preflight offline PASS: branch ban đầu `review/d114-pre-live`, HEAD `c031267`; snapshot, dataset/fixture/index/manifest, model cấu hình, prompt và source-map SHA-256 `ff5345f902a6056856d836de08c2d03bae25d84141de91c9ec20c64d27a5ebd4` khớp D1.14. Chuyển sang `evaluation/d115-single-live`, giữ staging/thay đổi có sẵn; không sửa các input đã pin. Không có warm-up, probe Gemini, retry, replay hoặc chạy bù.

Lệnh thực thi **đúng một lần**, exit code 0:

```powershell
Set-Location D:\University\PBL6\ai-service
.\.venv\Scripts\python.exe -B tests/evaluation/collect_d1_live.py --live --snapshot-id 971d9d5ef3cc285fd170ac79afcb496bd7315c4edf4076c9263289edd7e34d2d
```

Run ID `82c5419b-571c-402d-9509-e28faf11e30d`; started_at `2026-11-19T17:33:23.210473+00:00` (00:33:23 ngày 20/11 tại Việt Nam). Context synthetic vẫn là 2026-11-13. Artifacts local ignored: `ai-service/.local/assistant-evaluation/d1-investigation/82c5419b-571c-402d-9509-e28faf11e30d/`; xem [summary](../.local/assistant-evaluation/d1-investigation/82c5419b-571c-402d-9509-e28faf11e30d/summary.json), [manifest](../.local/assistant-evaluation/d1-investigation/82c5419b-571c-402d-9509-e28faf11e30d/manifest.json) và [24 cases](../.local/assistant-evaluation/d1-investigation/82c5419b-571c-402d-9509-e28faf11e30d/cases.jsonl). Không đưa raw answers/evidence vào Git.

### Reliability và latency quan sát được

- `state=completed`, stop_reason=null nghĩa là đã xử lý hết batch; **không có nghĩa D1 pass**. Planned/attempted=24, not_run=0, active_case_id=null, completed_cases=24, provider_closed=true, baseline_unchanged=true.
- Final/captured final/status matches: **10/24 (41,7%)**. Lỗi **14/24 (58,3%)**: chín `DEADLINE_EXCEEDED`/application_deadline (37,5%) và năm `DEPENDENCY_UNAVAILABLE`/HTTP 503 (20,8%). Không có final sai status trong mười ca trả được; điều này chưa chứng minh nội dung đúng.
- Theo nhãn kỳ vọng: answered trả final 1/8, insufficient_evidence 5/8, capability_unavailable 4/8. Mười final thực tế gồm một answered, năm insufficient_evidence, bốn capability_unavailable.
- p50/p95 nearest-rank **toàn bộ 24 ca, gồm lỗi**: **10041,39 / 20022,28 ms**; min/max 1439,37 / 20027,90 ms. Riêng mười final: p50/p95 5908,69 / 14431,97 ms. Đây là elapsed của RecordingFaq, có index validate/capture; không phải latency provider thuần hoặc toàn bộ thời gian export batch.
- 62 HTTP attempts: 31 countTokens + 31 generateContent, mỗi cặp operation/method trong ca xuất hiện đúng một lần. Status: 48 HTTP 200, năm HTTP 503, chín chưa nhận status. Các 503 đều ở classify/generateContent; không nằm trong nhóm stop 401/403/429. Chín deadline đều hủy generateContent khi đang wait_headers: tám classify, một answer (`dev-pets`); budget còn lại bằng 0 tại turn và attempt. Không có bằng chứng để quy riêng cho provider compute/queue, proxy hoặc network; đây không phải kết luận root cause D1.9.
- Usage 6356 input/564 output tokens chỉ của mười final; tổng token/chi phí gồm request lỗi chưa đo. Request bị hủy tại client không chứng minh upstream đã ngừng compute hoặc tính phí.

### Đối chiếu artifacts và provenance

- Đủ sáu file, strict schema hợp lệ; manifest và summary completed, năm SHA-256 tham chiếu trong summary khớp files. Summary tự hash: `ca3ad2b0a3a2e4808f2f1d0fe1cfa5300815871080f3b60b6fc8da425ed814c4`. Không có file tạm hoặc run bù.
- Thứ tự 24 ID/split/context/budget khớp corpus/dataset. Có 24 diagnostic ID riêng; 203 diagnostic events + 62 HTTP timing events = 265 capture sequences duy nhất/liên tục. 62 attempt IDs ghép đúng case→diagnostic→HTTP; mỗi method có đúng một diagnostic match, turn summary đủ, tất cả timing có mặt trước cutoff của ca. `gaps={}`, không missing/ambiguous/orphan; không có probe event.
- 62 timing summaries trace_state=observed, không truncated/delivery_loss flag. Protocol 53 http1 theo response extension, chín unknown khi chưa nhận headers; không suy unknown là reuse/HTTP1 hoặc 0 ms. Khoảng thời gian abort không phải phase hoàn tất thành công.
- Source-map, 21 pinned files và snapshot vẫn khớp D1.14 sau batch. Requested model và 17 successful generation modelVersion đều là gemini-3.1-flash-lite; failed generations không kế thừa version cũ. Prompt d1-faq-1/hashes giữ nguyên.
- Bảy ca có retrieval evidence không rỗng; query và evidence thực nhận khớp input answer, response evidence khớp retrieval. Một citation trong answered final khớp toàn bộ metadata của evidence đã truy xuất. Đây là kiểm tra identity/provenance, **chưa chấm claim support/coverage hoặc semantic correctness**. Các abstention có evidence vẫn cần rà rubric, không lấy status đúng thay cho nội dung đúng.
- Privacy checks với credential hiện có và patterns qua cho toàn bộ artifact; không in/hash secret. Nguồn/input đã pin synthetic, không có business data hoặc JWT khách. Không bảo đảm nhận diện mọi PII tự do; giữ giới hạn như D1.13c. Artifacts mới giữ nguyên sau audit, lịch sử D1.9/snapshot không bị ghi đè.

### Kết quả từng ca

HTTP 503 dưới đây là classify/generateContent. Deadline là classify/generateContent trừ `dev-pets` ở answer/generateContent. Latency gồm cả ca lỗi; đơn vị ms.

| Case ID | Kỳ vọng | Kết quả | Latency | HTTP attempts |
| --- | --- | --- | ---: | ---: |
| dev-wifi-place | answered | HTTP 503 | 2708,78 | 2 |
| dev-code-provider | answered | application_deadline | 20027,90 | 2 |
| dev-luggage-day | answered | HTTP 503 | 12438,55 | 2 |
| dev-help-place | answered | application_deadline | 20013,55 | 2 |
| dev-pool | insufficient_evidence | insufficient_evidence | 4681,71 | 4 |
| dev-parking | insufficient_evidence | insufficient_evidence | 6503,46 | 4 |
| dev-breakfast | insufficient_evidence | HTTP 503 | 14432,40 | 2 |
| dev-pets | insufficient_evidence | application_deadline (answer) | 20017,10 | 4 |
| dev-booking | capability_unavailable | HTTP 503 | 9315,46 | 2 |
| dev-prices | capability_unavailable | HTTP 503 | 10041,39 | 2 |
| dev-stock | capability_unavailable | capability_unavailable | 3243,24 | 2 |
| dev-pay | capability_unavailable | capability_unavailable | 5908,69 | 2 |
| test-luggage-danger | answered | answered | 3029,70 | 4 |
| test-contact-number | answered | application_deadline | 20014,07 | 2 |
| test-wifi-real | answered | application_deadline | 20020,76 | 2 |
| test-luggage-real | answered | application_deadline | 20013,17 | 2 |
| test-gym | insufficient_evidence | application_deadline | 20009,19 | 2 |
| test-shuttle | insufficient_evidence | insufficient_evidence | 14431,97 | 4 |
| test-smoking | insufficient_evidence | insufficient_evidence | 9446,96 | 4 |
| test-refund-policy | insufficient_evidence | insufficient_evidence | 8107,70 | 4 |
| test-booking-detail | capability_unavailable | application_deadline | 20016,94 | 2 |
| test-price-range | capability_unavailable | application_deadline | 20022,28 | 2 |
| test-stock-date | capability_unavailable | capability_unavailable | 1439,37 | 2 |
| test-cancel | capability_unavailable | capability_unavailable | 8505,02 | 2 |

D1.15 có tỷ lệ final quan sát thấp hơn D1.9 (10/24 so với 18/24), nhưng hai batch ở thời điểm khác nhau và collector có capture/export riêng: không suy ra quan hệ nhân quả hoặc độ ổn định thống kê. Bước tiếp theo là review offline một answered final và chín final abstention/capability theo rubric grounding/citation/abstention, đồng thời phân tích artifacts của 14 lỗi đã có; không tự chạy live mới. D1.9 vẫn thiếu provenance lịch sử, không được thay bằng output D1.15 rồi chấm hồi tố.

Không sửa code/model/prompt/timeout/dataset/snapshot/dependency hoặc staging; chỉ cập nhật tài liệu và tạo đúng một bộ artifact ignored. Không commit/push, không cài phần mềm/dịch vụ mới; không chạy lại offline suite trong D1.15. **D1 acceptance vẫn mở**, grounding/chi phí not_measured và acceptance not_assessed.

## D1.16 — review D1.15 từ artifacts, 2026-11-20

Nhánh `docs/d116-artifact-analysis`, HEAD `c031267`; chỉ sửa PROCESS.md và EVALUATION.md. Đã kiểm tra lại sáu hashes của run `82c5419b-571c-402d-9509-e28faf11e30d` và đối chiếu 24 case với nhãn corpus.dataset; giữ nguyên [bảng từng ca D1.15](#kết-quả-từng-ca). Không gọi Gemini, chạy lại batch, query MATCH, build snapshot hoặc test suite. Đọc ba dòng search/metadata của SQLite bằng mode=ro&immutable=1, hash snapshot không đổi. Staging, archive untracked có sẵn và các thay đổi ngoài phạm vi được giữ nguyên.

[Báo cáo chi tiết D1.16](EVALUATION.md#d116--phân-tích-artifacts-d115-2026-11-20) gồm rubric từng final, hai bảng timing cho 14 lỗi, token/evidence ledger và ma trận tests offline đề xuất.

- **Đối chiếu status:** answered 1/8, insufficient_evidence 5/8, capability_unavailable 4/8 trả final đúng nhãn; 14 ca còn lại không có final. End-to-end vẫn là 10/24, không đổi thành 10/10 accuracy.
- **Semantic review theo artifacts:** mười final đều phù hợp các trục áp dụng trong rubric, nhưng chỉ một answered final có một FAQ claim để chấm grounding/citation support/coverage; năm final thiếu nguồn và bốn capability là từ chối phù hợp, không phải chín fact khách sạn được grounding. Citation của test-luggage-danger khớp evidence/snapshot và hỗ trợ claim trong phạm vi demo. Mười bốn lỗi ghi N cho semantic, vẫn giữ là lỗi reliability. Review do trợ lý đọc artifacts, chưa có người đánh giá độc lập/người duyệt policy production ký nghiệm thu; không sửa các trường not_measured/not_assessed trong summary lịch sử.
- **Năm 503:** đều classify/generateContent, nhận headers 503 khi còn khoảng 5,57–17,30 giây budget; không phải deadline. wait_headers complete không có nghĩa HTTP thành công. Không có error body/request ID/server trace nên chưa biết overload, quota, gateway hay nguyên nhân upstream khác.
- **Chín deadline:** tám classify, một answer; generateContent bị cancelled khi wait_headers, turn/application_deadline và budget=0 cùng diagnostic ID. dev-pets đã tốn khoảng 7,15 giây cho classify; sau retrieval và answer countTokens chỉ còn 12,7485 giây, không reset về 20 giây. Retrieval đo 9,873 ms gồm nested validate 7,222 ms; không cộng duration lồng nhau. Không thể gán wait_headers cho provider compute hoặc network riêng; 13/14 lỗi trước retrieval không thể do passages của retrieval đã chạy trong lượt đó.
- **Retrieval:** bảy lượt đều trả ba chunks, sáu câu không có đáp án vẫn nhận evidence không hỗ trợ; đọc thủ công chỉ một trong 21 question–passage pairs có thông tin trả lời câu hỏi. Cả bảy queries có khach/san, không bị stop-list loại; cả ba FTS rows chứa chúng và MATCH ghép OR, không relevance gate. Bỏ dấu còn tạo overlap hồ/hỗ, cưng/cung, sân/sạn, tiền/tiện. Cơ chế generic match đã xác định từ code/index; đóng góp score vào rank và lợi ích của một gate tương lai chưa được đo. Không diễn giải 1/21 là precision production hoặc retrieval gây 14 lỗi provider.
- **Phân biệt bản ghi:** năm ca final thiếu nguồn đều đã gọi answer và nhận supported=false; final dùng template của FAQ, không phải phần giải thích do model sinh. dev-pets không có answer result nên không chấm quyết định abstention chưa xảy ra. dev-pay rewrite mất sắc thái yêu cầu thực hiện thanh toán, nhưng intent/final unavailable đúng D1 và không có side effect; ghi rủi ro khi mở tools, không coi đã phát sinh lỗi quyền/booking.
- **Đề xuất, chưa thực hiện:** mở rộng oracle của tests HTTP 503/shared-budget/slow headers vs body hiện có; thêm domain-negative/generic-token/homophone fixtures bên cạnh positive gold cho retrieval; fake-index/provider tests phân biệt empty evidence và unsupported answer; bảng intent cho imperative vs hỏi policy. Không đặt threshold theo cảm giác hoặc tune trên held-out D1.15 đã được xem; cần held-out độc lập cho lần đánh giá sau. Tests local chỉ kiểm chứng cơ chế, không xác định root cause cloud.

Đã kiểm tra cấu trúc/hashes/correlation, nguồn span của claim và tính nhất quán tài liệu; đây không phải runtime test run mới. Các 503/deadline vẫn là blocker reliability; một FAQ claim và chín quyết định từ chối chưa đại diện chất lượng RAG toàn hệ thống. Production corpus chưa duyệt, tổng chi phí/request lỗi và nguyên nhân upstream vẫn chưa biết. Không thêm phần mềm/dependency/dịch vụ, không commit/push; **không kết luận D1 acceptance**.

Rà bổ sung **2026-11-21** trên cùng nhánh/HEAD: đọc lại 24 cases, parsed generations và 10 final; đối chiếu 14 lỗi theo diagnostic/attempt IDs, sáu hashes artifacts và 21 file đã pin đều khớp. Giữ nguyên rubric/kết quả từng ca; làm rõ trong EVALUATION sự khác nhau giữa scoring BM25, relevance thủ công và scoring semantic. Với snapshot chỉ có ba chunks cùng MATCH, top-3 hiện trả cả ba: chỉ đổi thứ hạng không loại được passages không hỗ trợ. Đây là suy luận có điều kiện từ code/snapshot, không phải thử nghiệm ablation hoặc bằng chứng BM25 sai.

Collector gọi FAQ/provider trực tiếp, không đi qua FastAPI/Spring/browser. Việc tiếp ca sau HTTP 503 không kiểm chứng service tự hồi phục: FastAPI hiện có dependency-failure latch. Bổ sung đề xuất offline tests phân biệt hai tầng này, cùng oracle cho score/tie/top-k trên corpus thử nghiệm lớn hơn ba chunks; chưa tạo hoặc chạy các tests đó. Bước tiếp theo vẫn là rà độc lập và giao tests offline trước chọn thay đổi; không tune trên held-out D1.15 đã được xem. Lượt này chỉ sửa PROCESS/EVALUATION, kiểm tra tài liệu và bảo toàn staging/nội dung ngoài phạm vi; không sửa production code, artifacts hoặc snapshot, không gọi Gemini/chạy batch/test suite, không commit/push. **D1 acceptance vẫn mở.**

Kiểm chứng lượt rà bổ sung: script Python stdlib qua `ai-service/.venv/Scripts/python.exe -B -` từ gốc repository đối chiếu hashes, nhãn/correlation của 24 ca và đọc immutable SQLite; kiểm tra **63 liên kết local cùng anchors, code fences cân bằng** trong hai tài liệu. `git diff --check -- ai-service/docs/PROCESS.md ai-service/docs/EVALUATION.md` qua sau khi bỏ trailing whitespace có sẵn; đối chiếu hash Git index và files ngoài hai tài liệu để bảo toàn thay đổi người dùng. Đây là kiểm tra artifacts/tài liệu, không phải kết quả chạy lại runtime tests; không cài thêm phần mềm, dependency hoặc dịch vụ.

## D1.17 — kiểm chứng hypotheses bằng offline tests, 2026-11-21

Nhánh `test/d117-offline-hypotheses`, HEAD vẫn `c031267`; giữ nguyên staging và các thay đổi chưa commit có sẵn. Chỉ sửa hai file test integration, thêm một file test unit và cập nhật PROCESS/EVALUATION. Không sửa `app/`, prompt/model/timeout/dependencies, fixture đã pin, snapshots hoặc artifacts D1.15. [Bảng hypotheses/oracle D1.17](EVALUATION.md#d117--kiểm-chứng-hypotheses-bằng-offline-tests-2026-11-21) phân biệt kết luận local và unknowns upstream.

- [Runtime](../tests/integration/test_faq_runtime.py): thêm sáu ca. 503 thật qua adapter nhưng network synthetic làm FastAPI latch not-ready, chặn lượt sau trước dispatch; direct FAQ trên cùng provider vẫn có thể thành công. App mới có latch riêng; deadline fake không latch và lượt API sau thành công. Bốn ca abstention phân biệt empty, unrelated supported=false, supported=true cố ý sai và positive control; kiểm tra shared budget/call count/evidence, không leak draft/citation khi abstain.
- [Deadline](../tests/integration/test_faq_http_deadline.py): giữ sáu ca cũ, thêm hai ca D1.15-shaped với 7,15 giây classify giả lập và answer block ở headers/body. Helper thêm tham số test-only, mặc định 19 giây cũ cho refund-shaped không đổi; assert cùng budget/start, answer không nhận lại 20 giây, elapsed_until_abort và unknown protocol khi chưa nhận headers, cleanup/no retry/correlation/successor.
- [Retrieval hypotheses](../tests/unit/test_retrieval_hypotheses.py): **15 ca mới** — sáu mức top-k kiểm tra numeric BM25/ties trên corpus tạm năm chunks/bốn candidates, ba domain negatives ablate generic tokens, hai positive gold controls và bốn normalization collisions. Tổng D1.17 thêm **23 ca**: 6 runtime + 2 deadline + 15 retrieval.

Các lượt nhóm đã chạy từ `ai-service`:

```powershell
.\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests/integration/test_faq_runtime.py --tb=short --show-capture=no
.\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests/integration/test_faq_http_deadline.py --tb=short --show-capture=no
.\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests/unit/test_retrieval_hypotheses.py tests/unit/test_ingestion.py --tb=short --show-capture=no
```

Kết quả theo nhóm: runtime **14 passed** (gồm sáu mới), deadline **8 passed** (gồm hai mới), retrieval/ingestion **25 passed**. Lượt đầu runtime 9 pass/1 fail do body frame synthetic của 503 còn trong hàng đợi sau adapter đóng response chưa đọc body; sửa framing riêng trong test để body đi cùng headers, chạy lại thành công. Đây là lỗi fixture, không sửa adapter/runtime.

Ma trận kết hợp với collector và regression deadline/timing trước đó:

```powershell
.\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests/integration/test_faq_runtime.py tests/unit/test_retrieval_hypotheses.py tests/unit/test_ingestion.py tests/unit/test_d1_collector.py tests/integration/test_d1_collector_integration.py tests/integration/test_faq_http_deadline.py tests/integration/test_http_timing_provider.py tests/integration/test_http_timing_transport.py tests/unit/test_http_timing.py tests/integration/test_d1_observability.py::test_outer_deadline_cancels_active_http_and_preserves_source tests/integration/test_d1_observability.py::test_turn_shares_budget_across_classify_retrieval_answer tests/unit/test_provider_diagnostics.py::test_fake_clock_preserves_cumulative_time_and_call_budget tests/unit/test_diagnostic_lifecycle.py::test_inner_application_timeout_is_not_http_timeout --tb=short --show-capture=no
.\.venv\Scripts\ruff.exe check tests/integration/test_faq_runtime.py tests/integration/test_faq_http_deadline.py tests/unit/test_retrieval_hypotheses.py
.\.venv\Scripts\ruff.exe format --check tests/integration/test_faq_runtime.py tests/integration/test_faq_http_deadline.py tests/unit/test_retrieval_hypotheses.py
```

Kết quả ma trận kết hợp: **211 passed, một warning Starlette/HTTPX đã có, 289,90 giây**, exit code 0. Gồm 23 ca D1.17 mới và 188 ca trước đó được chọn; sáu ca deadline D1.12 vẫn giữ. Ruff check và format-check ba file đã qua. Đây là tập regression liên quan, không phải toàn suite hoặc phép đo hiệu năng sản phẩm. Outbound guard chặn network thật; không chạy Spring/FE/E2E hoặc Gemini.

Xác nhận local: dependency-failure latch khác deadline; shared budget/cancellation; numeric rank/tie/top-k; generic OR/normalization có thể tạo matches không hỗ trợ; empty hoặc supported=false giữ abstention. Bác bỏ bảo đảm rằng citation identity/nonempty retrieval tự chứng minh semantic support: fake provider cố ý trả supported=true vẫn đưa unsupported claim vào final. Đây là characterization của giới hạn hiện tại, không phải PASS grounding hoặc lỗi Gemini thật đã quan sát.

Chưa biết: origin của năm 503/chín deadline D1.15, provider queue/compute/network, tổng chi phí và recall/latency/chi phí của một gate tương lai. Không chọn threshold/đổi stop-list từ fixture; intent-preservation chưa triển khai trong bước này. Bước tiếp theo là rà độc lập kết quả và giao phạm vi xử lý semantic/relevance cùng corpus/gold/tiêu chí nghiệm thu; không tự chạy live mới. Không cài thêm phần mềm/dependency/dịch vụ, không commit/push; **D1 acceptance vẫn mở**.

Kiểm tra bàn giao: 72 liên kết local/anchors và code fences trong PROCESS/EVALUATION hợp lệ; `git diff --check` cho các file tracked của nhiệm vụ qua, kiểm tra whitespace trực tiếp cả tests untracked. Sáu hashes artifacts D1.15 và 21 pinned files vẫn khớp; hash Git index không đổi, HEAD giữ nguyên, thay đổi ngoài năm file nhiệm vụ được bảo toàn. Không dựng/build lại pinned snapshot; mọi corpus mới của test nằm trong tmp_path.

## D1.18 — thiết kế semantic verification gate, 2026-11-21

Nhánh `docs/d118-semantic-gate-design`, HEAD `c031267`, working tree có D1.17 và các thay đổi có sẵn chưa commit. Lượt này chỉ sửa architecture/PROCESS/EVALUATION; không sửa production code, tests, prompt/model/timeout/dependencies, snapshot hoặc artifacts. API.md vẫn mô tả contract hiện hành; contract model mới dưới đây chỉ là đề xuất nội bộ, không đổi public envelope.

- Đối chiếu [prompt](../app/prompts/faq.py), [GroundedAnswer](../app/schemas/faq.py), [Gemini parser](../app/providers/gemini.py), [FAQ](../app/orchestration/faq.py) và [Spring response validation](../../BE/src/main/java/com/example/pbl6/service/assistant/AssistantClient.java): supported=true do model sinh; Python/Spring kiểm tra schema/identity/metadata, chưa có claim→support mapping hoặc verifier entailment. D1.17 fake false-positive là bằng chứng local của gap, không phải lỗi Gemini thật được quan sát.
- [Thiết kế/contract/flow D1.18](architecture.md#d118--semantic-verification-gate-thiết-kế-đề-xuất-chưa-triển-khai) đề xuất profile đóng: ApprovedCatalog/atomic facts và qualifiers, SourceBinding tới đúng excerpt/turn, QuestionBinding độc lập model, CandidateDraft có claims typed, VerificationResult do code tạo và renderer cố định. Không dùng supported, BM25 hoặc quote match làm bằng chứng semantic support. Catalog/question binding/renderer hiện chưa tồn tại; nội dung/approval phải được giao riêng, không tự tạo dữ liệu production.
- Fail-closed đề xuất: schema/reference/citation sai → 502 AI_PROTOCOL_ERROR; draft hợp lệ nhưng unsupported/contradicted/unknown hoặc thiếu coverage → insufficient_evidence toàn answer, không partial/draft/citation leak. Dependency/integrity/budget/deadline vẫn giữ error path riêng, không giả thành thiếu nguồn. Không thêm verifier LLM call hoặc budget mới; chuyển schema/prompt là lát integration tương lai, chưa được thực hiện.
- [Test matrix D1.18](EVALUATION.md#d118--test-matrix-cho-semantic-verification-gate-đề-xuất) gồm 20 tình huống đề xuất: positive support, citation đúng ID nhưng sai support, missing citation, empty/conflicting evidence, partial/multi-claim coverage, qualifiers, question relevance, legacy schema, drift/cancellation và renderer limits. Có ca catalog biên tập sai để nêu giới hạn của deterministic guarantee. Chưa viết/chạy các tests này; kết quả 211 pass D1.17 giữ nguyên là lịch sử, không quy thành gate pass.

Điều code có thể xác minh là consistency/provenance và matching của facts/renderer trong miền đóng. Semantic judgment vẫn cần cho biên tập facts từ prose, scope/ngoại lệ, câu hỏi tự do, entailment và mâu thuẫn ngoài vocabulary; hash/citation/quote đúng không giải quyết các việc đó. Bước tiếp theo được đề xuất là review thiết kế và chọn miền FAQ/gold/criteria/người duyệt, rồi mới giao prototype offline. Chưa chọn catalog vocabulary/aliases/rules hoặc ngưỡng coverage/false-abstention; chưa thay behavior hiện tại. **D1 acceptance vẫn mở.**

Kiểm chứng lượt này dùng script Python stdlib qua `ai-service/.venv/Scripts/python.exe -B -` từ gốc repository: 113 liên kết local/anchors, một ví dụ JSON hợp lệ, fences/whitespace và 20 ID test matrix duy nhất. `git diff --check -- ai-service/docs/PROCESS.md ai-service/docs/EVALUATION.md ai-service/docs/architecture.md` qua. Đối chiếu hashes xác nhận staging, source/tests/API.md ngoài phạm vi, sáu artifacts D1.15 và 21 pinned files/snapshot không đổi; chỉ ba tài liệu trên thay đổi trong lượt này. Đây là kiểm chứng tài liệu, không phải semantic/runtime test run. Không chạy runtime suite hoặc Gemini/live batch, không cài phần mềm/dependency/dịch vụ, không commit/push.

## D1.19 — hoàn thiện contract và test specification, 2026-11-21

Nhánh `docs/d119-gate-contract-spec`, HEAD `c031267`, giữ nguyên working tree và staging có sẵn. Chỉ cập nhật architecture/EVALUATION/PROCESS; không tạo implementation, tests hoặc artifact catalog. Đã đọc và đối chiếu GroundedAnswer/FAQ/Gemini parser, ingestion approval/hiệu lực, FastAPI error mapping và Spring citation/length checks; production vẫn chưa có verification gate.

- [Contract D1.19](architecture.md#d119--contract-cho-semantic-verification-gate-chỉ-đặc-tả) chốt oracle cho specification: fact revision/value/unit/qualifier/timeScope/validity/approval/provenance, typed claim v2 và citation-binding pair, vocabulary/rule-based QuestionBinding, coverage/contradiction/eligibility và VerifiedFactSet cho renderer. Version v2 hoàn thiện draft v1 của D1.18, không thay schema/prompt runtime hiện tại.
- Làm rõ mapping: fact pending/hết hạn trong catalog khỏe → abstention trước generation; required source/catalog hỏng hoặc drift → dependency error. Pair citation/binding sai source → protocol error; pair hợp lệ nhưng thuộc fact khác → insufficient_evidence. Không auto convert units/time periods, không partial release hoặc legacy fallback.
- [Specification G01–G20](EVALUATION.md#d119--test-specification-g01g20-chưa-viết-tests) có shared context/source/fact/question/candidate fixtures synthetic và outputs S/A/E502/E503/E504/E500 cùng usage U1/U2. Mỗi nhóm có input delta, decision/reason và expected output/side effects; variants bao phủ lifecycle, units/time windows, valid citation sai binding, hai nguồn conflict, unknown/ambiguous vocabulary và model extra claim. Tất cả mới là đặc tả, không có test pass mới; 211 pass D1.17 vẫn là lịch sử.
- Phân biệt quyết định thiết kế (schema strict/equality/coverage/renderer/error precedence) với giả định human review và hypotheses coverage/false acceptance/false abstention/CPU. G20 giữ trường hợp catalog approved sai nghĩa nhưng hash đúng có thể qua deterministic gate; independent semantic oracle phải đánh FAIL, không ép code tự hiểu prose để báo an toàn giả.

Bước tiếp theo chỉ được đề xuất là review specification và giao prototype/tests riêng theo G01–G20; chưa tự triển khai hoặc sửa tests D1.17. Policy/vocabulary production, người duyệt, tiêu chí/SLO và chất lượng trên gold độc lập chưa được phê duyệt/đo. Kiểm chứng lượt này chỉ là links/anchors/fences/JSON/consistency và Git/hashes; không chạy runtime suite, Gemini/live batch, không cài thêm phần mềm/dependency/dịch vụ, không commit/push. **D1 acceptance vẫn mở.**

Kiểm tra bàn giao bằng script stdlib qua `ai-service/.venv/Scripts/python.exe -B -`: 121 local links/anchors, hai ví dụ JSON parse được (draft v1 lịch sử và v2 normative), exact field sets của v2, 20 IDs G01–G20 trong phần D1.19, fences/whitespace hợp lệ. `git diff --check -- ai-service/docs/architecture.md ai-service/docs/EVALUATION.md ai-service/docs/PROCESS.md` qua. Git index/HEAD và files ngoài ba tài liệu được đối chiếu hash; sáu artifacts D1.15 và 21 pinned files/snapshot giữ nguyên. Đây là kiểm chứng tính nhất quán tài liệu, không phải implementation tests hoặc đánh giá semantic đã chạy.

## Working tree D1.20 — ghi nhận trước Phase 1

Đã có core/catalog/QuestionBinding/typed claims/verifier/renderer, prompt v2 riêng và adapter
FAQ opt-in trong `app/orchestration/verification` cùng unit/fake-provider tests. Factory trong
`app/main.py` vẫn tạo `Faq(...)` không truyền gate. Chưa có catalog/publisher/source adapter
production được cấu hình; không coi core đã triển khai là semantic gate đang bảo vệ chat mặc
định hoặc mọi variants G01–G20 đã được nghiệm thu. Phase 1 giữ nguyên code này.

## Phase 1 — nền tảng dữ liệu Hybrid RAG

Yêu cầu từ file đính kèm ngày 2026-11-21: triển khai ingestion → chunking → metadata →
embedding → Qdrant, giữ FTS5 và không triển khai Hybrid Retrieval. Làm trên nhánh hiện tại
`chore/sync-origin-main-d120` vì merge đã resolve nhưng chưa commit; giữ nguyên index staging,
HEAD, MERGE_HEAD và mọi thay đổi ngoài phạm vi. Không commit/push.

### Implementation thực tế

- Tái sử dụng allowlist/parser và normalize của D1. Nguồn/chunking mới giữ toàn section cùng
  document preamble; reject nguồn thiếu/unapproved/expired/duplicates và section quá lớn.
  Metadata/provenance chung đi vào cả SQLite và Qdrant, UUIDv5 point ID từ SHA-256 chunk ID.
- Cấu hình embedding riêng tập trung trong `app/indexing.py`: mặc định embedding 001/768,
  REST v1beta; hỗ trợ model 2 bằng input recipe đúng tài liệu, dimension 768/1536/3072,
  L2/finite/nonzero checks và lỗi transport/protocol rõ ràng. Không đổi generation model D1.
- Qdrant REST bằng HTTPX sẵn có; không thêm dependency Python/SDK. Thêm Compose Qdrant
  v1.17.0, pin digest, bind loopback, Docker named volume. Đã khởi động Docker Desktop có sẵn
  và tải image; không đụng container/volume nghiệp vụ. Test containers đã tự stop sau suite.
- Rebuild tạo SQLite staged và collection mới, audit toàn payload/IDs/vectors/checksums,
  đọc lại nguồn, rồi atomic replace một pointer local chọn cả cặp. Không alias hai nơi,
  không overwrite active, không tự GC. Giữ cặp cũ khi lỗi trước publication; cleanup lỗi
  được báo `cleanup_pending`. Source/config/model/dimension drift làm active audit fail-closed.
- CLI `rebuild/status/lexical/search`; rebuild gọi Gemini thật phải có flag tường minh.
  Không có fake provider trong runtime/CLI. Phase 1 chạy fake encoder chỉ trong tests.
- [Runbook](INGESTION.md) có cấu hình, lệnh Docker/rebuild/search, schema, crash recovery,
  hạn chế và việc Phase 2. [Evaluation matrix](EVALUATION.md#phase-1--test-matrix-ingestionembeddingqdrant)
  đối chiếu đủ chín nhóm tests và phạm vi của PASS.

### Kiểm chứng

Các lệnh chạy từ `ai-service`:

```powershell
.\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests/unit/test_index_documents.py tests/unit/test_embedding_adapter.py tests/unit/test_qdrant_adapter.py tests/unit/test_vector_pipeline.py tests/unit/test_vector_cli.py
$env:PBL6_QDRANT_DOCKER='1'
.\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests/integration/test_qdrant_indexing.py
.\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests/unit tests/integration --tb=short --show-capture=no
.\.venv\Scripts\ruff.exe check app tests/unit tests/integration
.\.venv\Scripts\ruff.exe format --check app tests/unit tests/integration
.\.venv\Scripts\python.exe -m pip check
docker compose -f compose.qdrant.yaml config --quiet
```

Nhóm Phase 1 cuối cùng: **85 passed** (81 unit + 4 Docker thật) trong 7,98 giây.
Regression đầy đủ cuối cùng trên implementation cuối: **484 passed, 0 failed, 1 Starlette
TestClient deprecation warning** trong 113,38 giây (399 cases có sẵn + 85 cases mới).
Không nâng dependency để che warning. Ruff check/format (70 Python files), pip check và
Compose config đều qua. Các lượt 473/482 pass trước đó là checkpoint, không thay kết quả cuối.
CLI help qua; `rebuild --mode demo_synthetic` không có consent flag trả exit 1 với
`EMBEDDING_API_NOT_AUTHORIZED` trước dispatch, đúng thiết kế.

Hai lỗi trong quá trình kiểm chứng đã xử lý: lượt Docker đầu bị offline network guard chặn
(fixture chỉ mở đúng port test, guard chung không đổi); teardown sau hardening gặp Qdrant
`DELETE` trả 200/false cho collection đã xóa, adapter hiện xác nhận absence bằng GET trước
khi coi idempotent cleanup thành công. Suite nhóm cuối không còn fail/error. Mutation test
duplicate guard bị test bắt và source đã được khôi phục nguyên bytes.

Đối chiếu Git/hashes với baseline đầu Phase 1: chỉ sửa sáu file đã có trong phạm vi
docs/config (`README`, architecture/PROCESS/EVALUATION, settings example, gitignore);
586 file/absence ngoài phạm vi giữ nguyên, cùng 21 protected files gồm env/artifacts/snapshots.
HEAD/index staging/MERGE_HEAD giữ nguyên, không unmerged paths. Links/anchors của runbook và
bốn tài liệu được sửa đều hợp lệ. Các file mới chưa stage; không đưa index/secret vào Git.

### Acceptance Phase 1

| Criterion được giao | Decision và evidence |
| --- | --- |
| Pipeline ingestion hoạt động | PASS: valid/invalid input và CLI pipeline với fake encoder, real Docker |
| Chunking bảo toàn context/quan hệ tài liệu | PASS: section/preamble/nested heading/table/list/exception tests |
| Metadata/provenance đủ | PASS: source/version/section/checksum/approval/date được so trong cả hai stores |
| Embedding đúng dimension/model configuration | PASS cho contract offline: body REST 001/2, task recipe, dimension/L2/error tests; Gemini thật chưa chạy theo yêu cầu |
| Qdrant lưu/truy vấn vector | PASS: bốn Docker integration cases, cosine/filter/round-trip thật |
| SQLite FTS5 hiện tại vẫn chạy | PASS: original ingestion/KnowledgeIndex và toàn regression pass, source D1 không đổi |
| Chunk/source identity nhất quán | PASS: full inventory/SQLite equality và real query ID comparison |
| Rebuild an toàn | PASS: publication visibility, source/config change, ack/upsert/audit/disk failures giữ cặp cũ |
| Lỗi được xử lý rõ | PASS: typed sanitized codes, cleanup_pending, no silent fake/partial publication |
| Regression hiện tại không bị phá | PASS: 484 cases toàn suite, gồm 399 cases có sẵn |
| Tests mới pass hoặc có lỗi giải thích rõ | PASS: 85/85 mới pass, không còn failure/error; lỗi checkpoint nêu trên đã sửa |

PASS chỉ có phạm vi kỹ thuật offline/Docker đã nêu. Deployment production còn PARTIAL vì
corpus chưa duyệt và availability/chất lượng/cost của Gemini thật chưa được đo; đây không là
bằng chứng nghiệm thu D1, cũng không là yêu cầu mở live run trong Phase 1.

### Giới hạn và bước tiếp theo

Production corpus vẫn pending review; không tự duyệt hoặc index synthetic vào production.
Gemini REST được kiểm tra bằng mock HTTP, chưa có Gemini embedding thật, đo chất lượng/cost
hoặc live evaluation mới. Chưa đo semantic Recall@k, không suy từ known-vector similarity.
Không đổi D1 snapshot/artifacts, generation prompts/model/budget, business tools, API hoặc
semantic gate. D1 acceptance vẫn mở.

Pipeline chỉ điều phối một host, full audit phù hợp corpus nhỏ; chưa có crash/power-loss/HA
test, auto GC/rollback hoặc phục hồi stale lock tự động. Model name không pin upstream weights;
operator revision và rebuild cần review. Quá 2000 ký tự/section phải biên tập lại; chưa có
embedding token meter và không cắt text. Các vấn đề này được ghi cụ thể trong runbook.
Phase 2 cần thiết kế/query embedding + candidate fusion/RRF + context/citation integration và
đánh giá trên gold độc lập; chưa tự triển khai Phase 2 hoặc mở business tools.

## Phase 2 — Hybrid Retrieval và FAQ opt-in

Triển khai theo yêu cầu đính kèm ngày 2026-11-21. Đây là Phase 2 của nền tảng dữ liệu RAG,
không phải mở D2 business tools. Git vẫn `chore/sync-origin-main-d120`, HEAD `c031267`, merge
`origin/main@9d6b581` đã resolve/chưa commit. Không reset/commit/push, đổi `.env`, duyệt corpus,
sửa snapshots/artifacts lịch sử hoặc chạy Gemini thật. [Runbook](HYBRID.md) ghi contract/lệnh.

### Implementation thực tế

- Tái sử dụng Phase 1 profile/body/response/vector validator cho query embedding async.
  Không encode theo candidate. Thêm native async query transport; HTTP timeout lấy min của
  configuration và thời gian còn lại trong cùng TurnBudget. Component có outer deadline,
  cleanup/cancellation được test; generation prompt/model/tokens/call budget không đổi.
- `PairedIndex.local_active` tách local pin/validation khỏi full vector audit. Hai nhánh đọc
  cùng release: FTS5/BM25 stable rowid, Qdrant physical collection tương ứng. Query kiểm tra
  collection config/count và exact hit payload; full vector checksum audit vẫn ở Phase 1 status.
- `fusion.py` dùng rank-only RRF, constant/top-k cấu hình `AI_HYBRID`; duplicate một vote
  mỗi backend, cùng ID khác payload bị reject, stable ties. Metadata mode/source/category/
  approval/validity được filter trước final top-k. Scores/ranks chỉ phục vụ debug/evaluation.
- Internal result phân biệt snapshot invalid, query embedding error, một/both backend lỗi,
  empty và full hybrid. **Không có degraded mode hoặc silent BM25 fallback.** Public error
  codes vẫn 503 DEPENDENCY_UNAVAILABLE, 504 DEADLINE_EXCEEDED và 502 AI_PROTOCOL_ERROR phù hợp.
- `AI_RETRIEVAL_MODE=hybrid` nối component vào factory/FAQ; default `bm25` giữ đường cũ.
  Adapter giới hạn ba evidence và giữ nguyên citation/public fields. Existing gate được host
  inject vẫn kiểm tra snapshot thực của batch; stale catalog bị reject, không bypass bằng RRF.
- CLI query có consent flag; không rebuild hoặc generation. Không cài thêm dependency/model/SDK.
  Docker dùng image/storage isolation của Phase 1; fake encoders/generation chỉ trong tests.

### Tests và commands

Chạy từ `ai-service`:

```powershell
$env:PBL6_QDRANT_DOCKER='1'
$env:PBL6_HYBRID_BENCHMARK_REPORT=(Join-Path (Get-Location) '.local\paired-index\phase2-benchmark.json')
.\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests/unit tests/integration --tb=short --show-capture=no
.\.venv\Scripts\ruff.exe check app tests/unit tests/integration tests/evaluation/benchmark_hybrid.py
.\.venv\Scripts\ruff.exe format --check app tests/unit tests/integration tests/evaluation/benchmark_hybrid.py
.\.venv\Scripts\python.exe -m pip check
docker compose -f compose.qdrant.yaml config --quiet
```

Lượt cuối **550 passed, 0 failed, 1 warning** trong **126,85 giây**: 484 cases có sẵn +
66 cases Phase 2 (63 offline/FAQ cases và 3 Docker cases). Ruff check/format trên 82 Python
files, pip check và Compose config qua. Cảnh báo Starlette/HTTPX deprecation cũ vẫn giữ.
CLI hybrid/benchmark help qua; CLI không có consent flag trả EMBEDDING_API_NOT_AUTHORIZED
trước configuration/dispatch. Direct benchmark script không tự thêm app vào sys.path:
runbook dùng lệnh `-m tests.evaluation.benchmark_hybrid` đã kiểm tra.

Docker tests có native async query/Qdrant round-trip, missing collection và benchmark thật;
thêm test xuyên **factory FastAPI thật → retrieval HTTP async → Qdrant thật → FAQ final**,
chỉ mock embedding HTTP và generation. Các tests khác bao phủ config/dimension/protocol,
empty, một/both failures, source/snapshot drift, publication giữa query, filters, exact scores,
ties/dedup và stale gate. Mutation rank→raw-score bị test bắt, source được restore nguyên bytes.

Rà soát tìm được ca `approved=1`: Python equality coi bằng True nhưng strict Chunk schema
từ chối. Test tái hiện failure trước fix; hiện chuyển thành typed QDRANT_PROTOCOL_ERROR,
không uncaught validation/partial success. Score integer quá lớn cũng được bắt typed protocol
thay vì OverflowError. Query bị nở quá cap sau redaction cũng giữ AI_PROTOCOL_ERROR trước
embedding dispatch. Không còn failure/error ở lượt cuối. Các checkpoints trước edge cases
cuối là lịch sử kiểm chứng, không thay kết quả 550 hiện tại.

### Benchmark cùng synthetic gold

Report `.local/paired-index/phase2-benchmark.json` (ignored). Dataset `synthetic-hybrid-gold-1`:
18 queries/8 sections, 16 answerable và 2 unanswerable. Labels được ghi trước khi đo; không
đổi corpus/gold/top-k/constant để cải thiện kết quả. Fake SHA-256 character trigram encoder
không đọc gold; Qdrant và SQLite thật. Không phải Gemini vectors hay production evidence.

| Method | Recall@3 | MRR@3 | Precision@3 | p50 ms | p95 ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| BM25 | 0,9375 | 0,9375 | 0,3854 | 25,21 | 48,22 |
| Vector (fake encoder) | 1,0000 | 1,0000 | 0,3542 | 39,00 | 74,38 |
| Hybrid RRF | 1,0000 | 1,0000 | 0,3542 | 47,05 | 92,07 |

Recall/MRR/precision lấy 16 answerable. Cả ba methods trả nonempty cho **2/2 unanswerable**:
retrieval không tự chứng minh evidence hỗ trợ hoặc abstention. Vector tìm được `wifi-typo`
(`wifii`) mà BM25 miss; không có ca BM25 hit/vector miss trong bộ này, không tự tạo ca để
báo đối xứng. Hybrid bằng vector về metrics, precision thấp hơn BM25; **không chứng minh
Hybrid tốt hơn vector**. Latency một pass local gồm validation trước/sau, không gồm rebuild,
không đại diện API Gemini, concurrency hoặc SLO production. Gold/metrics chi tiết ở EVALUATION.

### Acceptance và giới hạn

| Criterion được giao | Decision |
| --- | --- |
| Query embedding tương thích document profile | PASS offline contract: shared model/API/task/recipe/dimension và drift guards; Gemini thật chưa chạy |
| BM25 retrieval | PASS: FTS5 thật, configurable candidate k, numeric score và rowid tie tests |
| Vector retrieval | PASS: native async + Qdrant Docker thật, query embedding HTTP mock |
| RRF kết hợp đúng | PASS: exact rank formula và mutation test, không cộng raw scores |
| Duplicate/tie stable | PASS theo candidate lists đã nhận; ANN boundary cần đánh giá khi scale |
| Metadata filtering | PASS: actual source/mode/category/approval/validity, không thêm business rules |
| Provenance | PASS: exact payload/IDs/source/version/checksums, citation adapter và snapshot binding |
| Failure classification | PASS: explicit branch states, strict fail-closed, existing public codes, no degraded fallback |
| FAQ integration | PASS opt-in: actual factory/transport/store + fake generation và existing API tests |
| Benchmark cùng gold hoặc ghi blocker | PASS cho synthetic gold/measurement; PARTIAL cho semantic/production quality vì thiếu production gold và Gemini vectors thật |
| Regression | PASS: 550 cases, gồm toàn bộ 484 cases trước Phase 2 |
| Không thay ngoài phạm vi | PASS theo Git/hash audit: không generation prompt/model/budget/API hoặc historical artifacts; no reset/commit/push |

Chưa có production gold được khách sạn/người đánh giá độc lập duyệt, Gemini availability,
semantic recall/latency/cost thật, đa ngôn ngữ/paraphrase held-out hoặc phép đo repeated/concurrent.
Full local validation còn synchronous; chưa đo scale/SLO, ANN boundary ties hoặc caching.
Default vẫn BM25, corpus production pending, gate D1.20 chưa bật mặc định; D1 acceptance mở.
Phase 3 chỉ đề xuất đánh giá dữ liệu thật/semantic quality và context assembly có budget;
chưa triển khai reranking, LLM judge, agent/knowledge graph, distributed infrastructure hoặc
business tools. Không tự chuyển Phase 3.


## Phase 3 — Grounded Generation

Ngày 2026-11-21, nhánh `chore/sync-origin-main-d120`, HEAD `c031267`, merge
`origin/main@9d6b581` resolve/chưa commit. Baseline `.git/codex-phase3-backup/20261121-153252/`.
Runbook riêng ở [GROUNDING](GROUNDING.md), giữ D1.18–D1.20/Phase 1–2 như lịch sử.

### Khảo sát và implementation

- Reuse D1.20 CatalogData/VerifiedCatalog, QuestionBinding, TypedClaim/CandidateDraft v2,
  coverage/qualifier/unit/time/conflict verifier, single-use host grant và canonical renderer.
  Ban đầu core chỉ opt-in, factory thiếu publications, FAQ còn free-form supported=true bypass.
- `verification/artifacts.py`: separately pinned catalog + source receipts, authority/hash/schema/
  path validation; independent reader so actual allowlisted Markdown/manifest/index/source bytes,
  version/ref/checksum/approval/validity/mode. Không auto-approve/default fact/fixture trong app.
  CLI validator offline không gọi Gemini/Qdrant, không build hoặc sửa publications.
- `verification/assembly.py`: whole-section selection, source checks, exact dedup, reject cùng ID
  khác payload; không truncate hoặc thêm facts. GroundingConfig có max_evidence 1–3 và total
  answer input cap 1–8000/default 6000. Không vừa thì BUDGET_EXCEEDED, không tự cắt scope/ngoại lệ.
- `TurnBudget.per_call_input_limit` áp quanh answer, dùng countTokens/usage hiện có để chặn
  dispatch/release vượt cap. Model/20s/8000 input/2000 output/max2 generation/no retry giữ nguyên.
- RRF loại metadata ineligible trước votes/dedup; tests chặn unauthorized duplicate vote/poison.
  Không đổi rank formula/top-k/constant hoặc Phase 2 gold để cải thiện benchmark.
- Faq bắt buộc gate trước classify; mọi FAQ qua verified adapter, bỏ free-form v1 fallback.
  Factory load gate trước tạo/probe generation provider; readiness kiểm source/catalog. Default
  retrieval là hybrid, explicit BM25 vẫn có gate. Không sửa `.env` thật hoặc public API/Spring/FE.
- Generation dùng versioned typed prompt D1.20 đã có, offered facts có actual retrieved binding
  và question scope. Model không cấp approval/provenance/verification. Renderer chỉ canonical
  fact/template và actual refs, không release partial support hoặc model prose.
- Unsupported/contradicted/unknown/partial → abstention; schema/reference sai → 502; required
  artifact/source hỏng → 503; deadline/budget/unexpected giữ mapping riêng, không blanket 200.
- Collector đọc legacy records, ghi typed inputs/result và prompt/source-map mới; CLI live yêu
  cầu gate trước tạo provider. Privacy omission không bị rendered final ghi đè. Không chạy live
  collector. Explicit test server chuyển sang test gate/v2; không production fake fallback.

### Kiểm chứng và commands

PowerShell từ `ai-service`, fake providers/MockTransport và loopback Qdrant test container:

```powershell
$env:PBL6_QDRANT_DOCKER='1'
.\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests/unit tests/integration --tb=short --show-capture=no
.\.venv\Scripts\python.exe -B -m tests.evaluation.evaluate_grounding --output .local/paired-index/phase3-evaluation.json
.\.venv\Scripts\ruff.exe check app tests/unit tests/integration tests/evaluation
.\.venv\Scripts\ruff.exe format --check app tests/unit tests/integration tests/evaluation
.\.venv\Scripts\python.exe -m pip check
```

Lượt full đầu 582/582 pass (550 Phase 2 + 32 mới), gồm Docker native async factory. Sau đó thêm
ba ca RRF/unexpected-renderer; target 31 fusion/factory tests pass, lượt full cuối ghi trong
`.local/paired-index/phase3-pytest.txt` và verification report ignored. Warning Starlette/HTTPX
đã có vẫn giữ; không upgrade dependencies hoặc lọc warning.

Factory tests thực sự đi startup/ready → loader/source receipts → classify → hybrid retrieval →
Gemini REST parse → gate → canonical final/error, với MockTransport. Docker test dùng native async
factory và Qdrant thật/query embedding HTTP mock. Missing catalog chặn trước generation probe;
no-gate chặn trước provider. Context vượt count không dispatch answer; equal cap qua, actual usage
vượt cap chặn final. Empty retrieval/query không answer. Unexpected renderer trả 500, no final.
Mapping 24 yêu cầu ở GROUNDING; unit gate không được dùng thay bằng chứng factory.

Mutation tạm thay configurable context cap bằng 8000 khiến budget factory test thất bại đúng
(200 thay expected 503); đã restore exact bytes/hash trước regression. Lỗi migration đầu lượt
đã sửa: legacy FAQ fixtures thiếu gate; catalog fixture phát diagnostics ngoài turn; privacy
omission bị final ghi đè. Timing/readiness tests giữ shared-budget/latch oracle. D1.17 false-positive
characterization đổi thành regression chặn unknown question; tài liệu/artifacts cũ giữ lịch sử.

### Evaluation và acceptance

27 ca mới, gold SHA `fc8505fb3815c991e0d8a380496a8df71a564ace9f82ea9981c9c7d13120181b`.
Sáu nhóm sufficient/empty/partial/conflict/hallucination/bad_citations có bốn ca mỗi nhóm, hai
dependency faults và G20 wrong review. Gold literals viết trước chạy, độc lập output; chưa có
reviewer con người độc lập. Fake retrieval/generation, không judge/API, không sửa D1.15/Phase 2.

- Contract 27/27, abstention 13/13; deliberate protocol faults 7/27 (25,93%), dependency faults
  2/27 (7,41%). Đây là composition fault injection, không đo reliability tự nhiên.
- Answer correctness 4/5 answered, citation identity 5/5, citation semantic support 4/5;
  supported claims 5/6, unsupported claim rate 1/6 (16,67%). Lỗi semantic duy nhất là G20.
- G20 review sai nhưng hashes/approvals khớp: deterministic verified, independent source oracle
  FAIL. Giữ semantic_acceptance=false. Bốn answered cases review đúng có 5/5 supported claims;
  không lấy subset này đóng nghiệm thu semantic.

| Acceptance | Decision/phạm vi |
| --- | --- |
| Context/provenance/approval/validity/mode/dedup | PASS offline + factory; required artifact drift fail-closed |
| Configurable token cap | PASS countTokens/usage, reject-over-budget, không truncate section |
| Generation dùng evidence/schema | PASS REST mock contract; PARTIAL Gemini thật chưa chạy |
| Gate thực sự trong factory/runtime, no bypass | PASS default factory/API + native Docker và no-gate negative |
| Citation source/chunk/metadata structure | PASS actual registry/provenance tests |
| Citation thực sự hỗ trợ claim | PASS closed facts review đúng; PARTIAL tổng quát vì G20/reviewer/prose trust |
| Unsupported/contradicted/unknown/coverage/abstention | PASS typed contract + evaluation; chưa chứng minh production coverage |
| Demo/production separation | PASS negative guards/default fail-closed; production corpus thiếu |
| Tests/regression | PASS offline/Docker, report cuối dưới đây |
| Synthetic evaluation và giới hạn | PASS explicit denominators/fault composition/G20 FAIL |
| Scope preservation | PASS Git/hash audit; không Spring/FE/model/tổng budget/dependencies/historical snapshot changes |

**Implementation và kiểm chứng offline Phase 3 hoàn thành trong phạm vi cho phép; acceptance tổng
thể PARTIAL, D1 vẫn mở.** Blockers: approved production corpus/catalog và publisher/approval workflow,
review source→fact→template độc lập, live Gemini v2, production paraphrase gold/false abstention/
false acceptance/latency/cost/concurrency. Full alias matching và deterministic equality không là
free-form entailment. Validation sync chưa có scale proof. D1.15 còn 5 HTTP 503/9 deadlines;
không coi tests mới chữa reliability hoặc xác định upstream root cause.

Bước tiếp: hoàn tất review/publication thật/gold độc lập và chốt quality/latency gates; chỉ chạy
Gemini/live khi có authorization riêng. Không Phase 4/rerank/agent/graph/judge/OCR/booking tools.
Không cài dependency/model/dịch vụ mới, tái dùng Docker/Qdrant đã có và cleanup test containers.
Không reset/commit/push. Git/index/protected-artifact verification report cuối ở phần dưới.


### Lượt kiểm chứng cuối và bảo toàn Git

- Full regression cuối: **585 passed/0 failed/0 skipped**, 131,06 giây, một warning Starlette/HTTPX
  đã có. Tăng 35 cases so Phase 2; gồm 16 context/artifact, 16 factory, một evaluation và hai
  ineligible-vote cases. Tất cả bảy Docker integration cases của Phase 1–2 chạy opt-in, cleanup xong.
- Ruff check + format-check app/unit/integration/evaluation PASS (96 Python files), pip check
  không broken requirements; tất cả local links và hai Phase 3 anchors trong docs đã sửa hợp lệ.
- Offline evaluation process exit 0, contract 27/27 và semantic_acceptance=false đúng G20;
  output `.local/paired-index/phase3-evaluation.json`, không phát sinh Gemini/network API.
- Audit baseline 625 paths: 24 paths cũ thay đổi đúng scope ai-service, 11 file mới; không có
  path ngoài ai-service đổi. Cached binary diff SHA-256 khớp baseline, giữ staging nguyên vẹn;
  59 file đã bị xóa vẫn vắng mặt. HEAD/branch/MERGE_HEAD không đổi, không unresolved conflict.
- 21/21 `.env`/snapshot/artifact paths được bảo vệ khớp hash trước pull; 24 D1.15 v1 records vẫn
  đọc được bằng schema hiện tại. Phase 1/2 reports, golds, snapshots và dependency locks không đổi.
- Verification report: `.local/paired-index/phase3-verification.json` (ignored); không reset,
  stash apply, commit/push, deploy hoặc nâng/cài dependency/model/dịch vụ trong Phase 3.


### Tái kiểm chứng Phase 3 — strict raw CandidateDraft, 2026-11-21

Yêu cầu được gửi lại qua attachment `6d941f12-b309-4023-96c7-5a9acfcf0342/pasted-text-1.txt` có
SHA-256 giống attachment Phase 3 trước (`7fa0d267c80e29cf566dc3be41fc531e3259f93fecf51bc4affd4eb6a9f07923`).
Không viết lại pipeline; audit working tree/runtime, giữ staging và merge hiện có. Baseline vòng
này: `.git/codex-phase3-reaudit/20261121-173712/state.json` (641 paths, gồm artifacts lịch sử).

Phát hiện và tái hiện một khoảng trống mà tests raw gate cũ chưa chứng minh qua REST:
Gemini adapter parse JSON thành CandidateDraft trước khi gate nhận dữ liệu; JSON có hai khóa
claims có thể làm claim ngoài schema ở khóa đầu bị parser âm thầm bỏ, rồi release câu canonical
ở khóa cuối. Factory regression mới trước fix nhận HTTP 200 thay expected 502. Không phải
model đã được gọi thật; toàn bộ request/response là MockTransport.

Sửa tại `CandidateDraft.model_validate_json`: kiểm tra duplicate JSON keys ở mọi nesting level
**trước** typed parsing; không đổi fields/schema, model, prompt, budget hoặc provider behavior của
các schemas khác. ValueError được adapter hiện có map thành 502 AI_PROTOCOL_ERROR, không final,
không fallback/abstention hoặc dependency latch. Gate vẫn kiểm độc lập như trước.

Tests mới: một factory REST duplicate-claims case; năm raw JSON variants (claims, escaped key,
factId, value.data, support ref), một clean round-trip/schema control; hai adapter cases citation
ID hợp lệ nhưng chunkId/sectionId sai → dependency integrity error trước answer dispatch.
Lượt target 69 tests pass; lượt kế tiếp 14 adapter/raw tests pass. Full đầu vòng 592 pass (chưa
có hai metadata cases), sau đó chạy full cuối với cả hai ca mới. Commands giữ nguyên block
Phase 3 ở trên; raw logs/report vòng này đặt riêng dưới
`.local/paired-index/phase3-reaudit/20261121-173712/`, không ghi đè reports/artifacts trước.

Evaluation chạy lại exit 0: 27/27 contract decisions, 13/13 abstentions; correctness/citation
support 4/5, citation identity 5/5, supported claims 5/6, unsupported rate 1/6. G20 vẫn semantic
FAIL và semantic_acceptance=false. Không đổi gold/fixtures/evaluator để làm đẹp metrics.
Acceptance và blockers production ở trên vẫn áp dụng: offline integration đã kiểm chứng,
semantic tổng quát/live/approved production corpus/catalog/review còn PARTIAL, D1 mở.


Kết quả cuối vòng tái kiểm chứng: **594 passed/0 failed/0 skipped**, 135,38 giây, một warning
Starlette/HTTPX đã có; gồm cả bảy Docker cases, containers đã cleanup. Ruff check/format-check
97 Python files và pip check PASS. CandidateDraft JSON Schema trước/sau giống hoàn toàn;
không đổi public API/model/prompt/budget/dependencies hoặc flow ngoài typed v2 parsing.
Git audit vòng này: bảy paths cũ thay đổi đúng scope + một test file mới; HEAD/branch/MERGE_HEAD,
261 staged paths/cached diff, `.env`, mọi historical `.local` artifacts và 59 deletions giữ nguyên.
Report cuối `.local/paired-index/phase3-reaudit/20261121-173712/verification.json` có matrix
24 yêu cầu, file hashes và acceptance/blockers; các reports Phase 3 trước không bị ghi đè.

## D1 acceptance closure — audit và chuẩn bị nghiệm thu, 2026-11-21

**Kết luận: D1 vẫn PARTIAL, chưa ký nghiệm thu.** Đây là audit tài liệu/source/artifacts, không
phải đợt test hoặc live evaluation mới. 594 tests pass là bằng chứng lịch sử Phase 3; đã đối
chiếu hash 105 source/test files với snapshot/report sau fix, không chạy lại runtime/tests.
Chi tiết semantic review, gold/rubric và reliability protocol ở
[EVALUATION — D1 acceptance readiness](EVALUATION.md#d1-acceptance-readiness--audit-2026-11-21).
Không tạo thêm roadmap, corpus/gold production hoặc quyết định approval.

### D1 acceptance matrix tại mốc audit trước khi chốt Academic Demo

Ma trận dưới giữ evidence và blocker của lần audit; scope/ngưỡng hiện hành được cụ thể hóa ở
[D1 Academic Demo](#d1-academic-demo--scope-và-acceptance-criteria-2026-11-21). Thiếu hạ tầng
enterprise hoặc publication production không tự là blocker của Academic Demo; nội dung demo
được phép sử dụng, human review, gold độc lập và reliability trên đường thật vẫn bắt buộc.

| Gate | Evidence đã có | Trạng thái và bằng chứng còn thiếu |
| --- | --- | --- |
| Hybrid → context → typed v2 → gate → verified rendering/abstention | Source factory/FAQ và 594 tests lịch sử, gồm native async/Qdrant Docker + Gemini HTTP mock | PASS kỹ thuật offline; chưa có nghiệm thu live pipeline Phase 3 |
| Source/chunk identity, hash, approval/validity/mode, schema, budget | Loader độc lập actual-source/receipts, negative tests, strict raw v2 JSON | PASS offline integrity; hash/authority label không chứng minh nội dung được duyệt đúng |
| Source correctness và catalog semantic approval | Bốn knowledge files vẫn approved=false; workspace chưa có publication JSON trong .local/grounding | OPEN: owner khách sạn xác nhận nguồn có thẩm quyền + reviewer độc lập ký source→fact→rule→renderer |
| G20/semantic false acceptance | Wrong-approved fact/template vẫn được deterministic gate nhận; source oracle FAIL | Giới hạn đã chứng minh, chưa phải gate semantic tổng quát PASS; phải kiểm chứng quy trình review trước publication |
| Vocabulary/QuestionBinding và coverage FAQ | Full-alias matching, unknown/ambiguous fail-closed; không có recall paraphrase thật | OPEN: xác định phạm vi sản phẩm và đo false abstention trên gold không lấy từ aliases/catalog |
| Answer/citation support/coverage/abstention | Phase 3 synthetic 27 ca; D1.15 chỉ một answered FAQ claim, chưa independent human sign-off | PARTIAL: có oracle synthetic, thiếu gold/reviewer độc lập cho FAQ khách sạn thật |
| Reliability | D1.15: 10/24 final, 9 application deadlines + 5 upstream HTTP 503 | BLOCKER: 14/24 không final; SLO/ngân sách phép đo chưa chốt, chưa có Phase 3 live evidence |
| Auth/session/readiness/end-to-end | Offline Spring/FE/API tests và live browser v1 lịch sử; D1.15 là direct FAQ | PARTIAL: phải kiểm default hybrid/gate qua FastAPI/Spring/browser với artifacts đã review; không suy service hồi phục từ collector |
| Evaluation harness/observability | Legacy collector capture tốt, v2 schema đã cập nhật; vẫn KnowledgeIndex/direct FAQ | PARTIAL: cần harness đúng default path và provenance hybrid/catalog/embedding trước live mới |
| Cost/latency/concurrency | D1.15 có latency mọi attempted case; usage chỉ final, tổng cost unknown | OPEN: chốt tiêu chí, đo toàn request/calls gồm embedding/probe, không chỉ successful finals |
| Git/data preservation của audit này | HEAD/merge/index hashes + baseline paths, kiểm chỉ hai docs thay đổi | PASS bảo toàn, không liên quan việc nghiệm thu semantic/reliability |

### G20 và các blocker cần đóng bằng evidence

G20 không phải citation ID giả hay parser bỏ sót field: test cố ý duyệt sai boolean và renderer,
nhưng giữ nguyên source phủ định; hash, binding và proposal cùng khớp bản duyệt sai. Code chứng
minh consistency với catalog, không suy luận entailment tổng quát từ prose. Không sửa oracle,
thêm heuristic phủ định hoặc dùng supported/self-judge của generation để che phản ví dụ này.

Cần đóng ba lớp độc lập: (1) technical validation khớp bytes/schema/provenance, (2) source
correctness do người có thẩm quyền khách sạn xác nhận, (3) human semantic approval xác nhận
atomic facts/qualifiers/rules/templates phản ánh đúng và đủ nguồn. Calculating review_hash,
status=approved và authorityRef allowlist không tự tạo chữ ký hay chứng minh reviewer độc lập.
Fact revision immutable là contract/publisher duty; runtime hiện không có registry đối chiếu
lịch sử mọi publication để tự phát hiện reuse factId/factVersion sau khi đổi nghĩa.

### Quyết định cần người dùng/reviewer xác nhận — chưa chốt

1. **Đã chốt sau audit: Academic Demo**, không production-ready. Còn phải chốt inventory FAQ,
   nguồn dữ liệu/nguồn gốc thật hay mô phỏng, ngôn ngữ/độ phức tạp và kỳ vọng paraphrase. Không
   tự hạ scope thành alias-only để bỏ các câu answerable bị từ chối sau khi đã xem kết quả.
2. Ai sở hữu/duyệt nguồn khách sạn, ai biên tập facts, ai review ngữ nghĩa độc lập và ai ký phát
   hành/acceptance. Tên người/authority/decision IDs thực chưa có; không tự gán vai trò cho model.
3. Gold/rubric/split theo proposal EVALUATION: số lượng tối thiểu, trọng số topic/risk, cách
   adjudicate bất đồng và bảo vệ held-out; gold được tạo trong nhiệm vụ riêng sau khi có nguồn.
4. Chấp nhận safety gates đề xuất (zero observed critical false acceptance, exact citation
   identity/mandatory qualifiers) và chốt ngưỡng false abstention/coverage, tỷ lệ final, p95,
   concurrency cùng mức chi phí. Chưa có SLO thống nhất thì không đánh PASS theo số tự chọn.
5. Xác nhận kế hoạch live có giới hạn: windows/sample size, artifact retention/privacy, tổng
   calls/chi phí gồm query embedding và startup probes, stop policy và người quyết định restart.
   Audit này không cấp phép chạy Gemini, service startup probe hoặc batch.
6. Xác nhận behavior lỗi cần giữ hay mở ticket riêng: dependency latch sau upstream 503; outer
   generation response JSON decode hiện map 503, còn CandidateDraft schema/reference sai map
   502; generation/retrieval HTTP clients có trust_env khác nhau. Không sửa trong audit này.

### Thứ tự đề xuất tại mốc audit — trước khi chốt Academic Demo

Thứ tự hiện hành sau quyết định scope ở
[Academic Demo](#d1-academic-demo--scope-và-acceptance-criteria-2026-11-21); bảng này giữ mốc audit.

| Ưu tiên | Việc / role cần chỉ định | Exit evidence để chuyển bước |
| --- | --- | --- |
| P0 | Product/acceptance owner chốt scope D1, SLO/rubric, người ký và budget | Biên bản tiêu chí, scope demo/production và approval matrix; các ô chưa chốt vẫn OPEN |
| P1 | Source owner + editor + independent semantic reviewer kiểm toàn release | Source authority/hiệu lực, review packet/hash, fact/rule/template diff, unresolved conflicts=0 trong miền bật, reviewer sign-off; không dùng fixture publisher làm approval production |
| P2 | Independent evaluator lập gold từ whole approved sources, freeze held-out | Dataset proposal được duyệt, gold evidence/required meanings/abstain labels, disagreement resolution, catalog/rules và dataset pins độc lập |
| P3 | Người phụ trách integration chuẩn bị harness đúng hybrid/default API | Task riêng cho capture/source-map hybrid/embedding/catalog/receipts/turn path, readiness/cancel/error evidence offline; không gọi legacy collector rồi coi như default pipeline |
| P4 | Người dùng phê duyệt controlled live reliability/semantic run | Preflight/pins/call cap/stop policy được ký; chạy đúng profile, giữ failed/not-run, không retry hoặc đổi timeout/model để đẹp số |
| P5 | Review độc lập kết quả và quyết định D1 | Matrix từng gate có evidence/sign-off; chất lượng/reliability chưa đạt thì giữ D1 mở, không tự chuyển Phase 4 |

P1/P2 có thể chuẩn bị nhân sự/quy trình song song sau P0; không phát hành source chưa duyệt hoặc
sinh gold production chỉ để đủ số ca. Việc hoàn tất code/offline tests không thay thế các exits.

### Kiểm chứng audit và Git state

Branch `chore/sync-origin-main-d120`, HEAD `c0312670032147c9f41ed0dc6d3ebfaa3e8270ef`,
MERGE_HEAD `9d6b581f1eb9225a17f9d1a1051a6efaf8c4e654`, 261 staged paths đúng thực tế khi audit.
Merge đã resolve nhưng chưa commit; không có unresolved paths. Baseline 648 paths tại
`.git/codex-d1-closure-audit/20261121-195459/state.json`, gồm .env và historical artifacts.

Đọc trực tiếp sáu artifacts D1.15: năm hashes được summary pin khớp, summary hash khớp bản lưu;
24 cases, 62 timing events và 203 diagnostics được đối chiếu IDs/counters. Không replay query,
build index, chạy evaluation/test suite, start service, gọi provider hoặc cài phần mềm. Chỉ
PROCESS/EVALUATION được cập nhật; architecture hiện mô tả đúng topology và G20 trust limit nên
không đổi. Cuối lượt kiểm links/anchors/fences, số liệu và hash toàn phần ngoài hai tài liệu,
HEAD/index/merge; bảo toàn staging, .env, artifacts, runtime/tests và các file đã xóa. Không
reset/commit/push, không đổi model/prompt/timeout/retry/dependencies, không Phase 4.

## D1 Academic Demo — scope và acceptance criteria, 2026-11-21

### Quyết định đã có và phạm vi được nghiệm thu

**ĐÃ CHỐT: Academic Demo**, theo yêu cầu người dùng. **CHƯA CHỐT:** corpus/inventory cụ thể,
người ký nội dung, independent semantic reviewer, bộ ngưỡng cuối và live budget/stop policy.
Các con số trong [EVALUATION — Academic Demo](EVALUATION.md#academic-demo--bộ-ngưỡng-định-lượng-đề-xuất)
là đề xuất để ký trước đo, không phải kết quả đã đạt hoặc sự phê duyệt tự động.

- Một inventory FAQ/thông tin khách sạn tĩnh giới hạn, được phép dùng và review đúng nguồn,
  phiên bản, hiệu lực, conditions/exceptions. Danh mục và các giới hạn phải freeze trước gold.
- Giữ đầy đủ ingestion/embedding thật, vector search thật, BM25, hybrid/RRF, context, typed
  generation, citation identity/support, mandatory verification, canonical rendering/abstention.
  Không thay chúng bằng fake trong run dùng để nghiệm thu execution path thực tế.
- Main evaluation dùng corpus được con người xác nhận và gold độc lập. Báo riêng origin
  thật/mô phỏng, approval status và fake/live provider; nguồn synthetic vẫn là synthetic dù đã
  được review hoặc model là Gemini thật. Chưa được phép gọi dữ liệu mô phỏng là policy khách sạn.
- Academic Demo là scope nghiệm thu, không thêm corpusMode/environment mới. Giữ các guards
  demo_synthetic/production hiện có; mode không tự chứng minh quyền dùng dữ liệu hoặc readiness.
- Giữ service auth, session isolation, privacy, fail-closed và error mapping. Không booking
  cá nhân/dữ liệu nhạy cảm; giá/tồn phòng/booking/thanh toán chưa có tool vẫn trả capability.
- Không agent loop/tool broker, HA/autoscaling, distributed session store, enterprise publisher
  UI hay hạ tầng production. Manual two-person review + immutable files/hashes + review record
  đủ làm quy trình xác nhận học thuật nếu người có trách nhiệm chấp thuận; không đòi chứng chỉ
  production hoặc chữ ký số enterprise để đóng D1.

### Phân loại acceptance criteria

| Loại | Nội dung | Tình trạng |
| --- | --- | --- |
| Bắt buộc — core invariants | Gate thật/no bypass; approved/valid evidence đúng mode; canonical facts; không unsupported/contradicted/partial answer, fake citation, lộ credential hoặc dữ liệu ngoài quyền | Không bỏ để giảm scope; bằng chứng offline đã có, release/live còn phải kiểm đúng snapshot được review |
| Bắt buộc — bộ ngưỡng đề xuất | Retrieval/answer/citation/coverage/FAR/false abstention/reliability/p95 theo bảng EVALUATION | Chưa được ký, chưa có phép đo nghiệm thu trên corpus đã xác nhận |
| Tham khảo | Precision@3, baseline BM25/vector, p50, phase latency/cost breakdown, repeated-case variance | Báo để giải thích, không tự nâng thành gate hoặc đòi hybrid thắng mọi baseline |
| Chưa xác định | Người duyệt, inventory/topic/ngôn ngữ, size/split cuối, số tiền/call cap và thời điểm live | Cần con người quyết định; thiếu các mục tiền đề thì chưa chạy live |
| Ngoài scope | Production-ready, HA/autoscaling, enterprise operations và tools nghiệp vụ mới | Không là điều kiện đóng Academic Demo, không tự triển khai Phase 4 |

### Bộ ngưỡng tóm tắt để phê duyệt — chưa đo/chưa nghiệm thu

| Hạng mục | Đề xuất gate Academic Demo |
| --- | --- |
| Hybrid retrieval | Macro Recall@3 ≥90%, MRR@3 ≥0,80; complete supporting evidence set trong top-3 cho ≥90% gold-A queries |
| Answer correctness | 100% answered finals đúng/đủ/relevant theo human gold; không cho phép vài câu sai chỉ vì điểm trung bình cao |
| Citation | Identity 100%, support 100%, mọi released hotel claim có đủ valid supports/qualifiers |
| Question coverage | ≥90% gold-A planned được trả lời đúng và đủ mọi required meanings; refusal/error/not-run không được coi là covered |
| Unsafe answer / false acceptance | Zero observed unsafe answered finals, zero answered trên gold-U; zero accepted invalid proposals trong catalog đã review đúng; G20 phải được review process reject trước publication |
| False abstention | ≤10% gold-A có semantic final; tách insufficient_evidence và capability misrouting, báo errors riêng |
| Reliability | ≥95% planned queries có valid nonerror final và đúng expected status trong từng run hoàn chỉnh, không gộp run tốt để che run lỗi |
| Latency | p95 elapsed tại Spring public chat path ≤18 giây, gồm failure/abort đã attempted; giữ nguyên deadline 20 giây, không tăng timeout để đạt |

N nhỏ phải báo counts và làm tròn theo EVALUATION, không chỉ percentages. Coverage tránh việc
abstain tất cả để đạt zero unsafe. G20 vẫn FAIL nếu dùng deterministic gate đơn độc; criterion
đóng demo dựa trên chuỗi review-source/catalog và verifier trong miền đã được xác nhận, không
tuyên bố general prose entailment. Không đổi G20 hoặc tính review approval từ fixture helper.

### Người có thẩm quyền và các quyết định còn cần xác nhận

1. Người có thẩm quyền khách sạn xác nhận quyền dùng, tính đúng, inventory, versions/hiệu lực
   của nội dung thật và thông tin nào không được công bố. Nếu chỉ có nguồn mô phỏng, người dùng
   phải xác nhận rõ scenario học thuật và người chịu trách nhiệm nội dung; người hướng dẫn duyệt
   mô phỏng không được coi là phê duyệt policy thật của khách sạn.
2. Semantic reviewer độc lập người biên tập facts/rules/templates và người adjudicate bất đồng;
   người ký nghiệm thu học thuật. Chưa có tên/authority/decision IDs thực được điền.
3. Người dùng/người ký chốt bộ ngưỡng, min sample/split, coverage topic/paraphrases và profile
   đo. Chưa chấp thuận bảng đề xuất thì chưa áp nó như SLO đã thống nhất.
4. Người dùng duyệt tiền/calls cho document/query embeddings, retrieval comparison, generation,
   countTokens và startup probes; lịch/số run và stop policy. Scope Academic Demo không tự cấp
   phép Gemini thật. Mọi sửa retry/model/timeout/network cần nhiệm vụ riêng, không làm ở đây.

### Thứ tự công việc còn lại cho Academic Demo

1. Chốt inventory, origin/quyền dữ liệu, danh tính người review/ký và ngưỡng/sample/budget.
2. Review source→atomic facts→qualifiers/validity→QuestionBinding→renderer; giải quyết conflicts,
   kiểm G20/controls, chốt review packet/source hashes. Catalog/receipts final phải được bind
   và xác nhận lại với actual paired snapshot trước run, không ký trên IDs giả định.
3. Lập independent gold dev/held-out và chuẩn bị protocol benchmark ba phương pháp; không tạo
   gold từ output/aliases, không ép nhãn U cho câu hệ thống chưa hiểu nhưng nguồn đủ trả lời.
   Chưa chạy document/query embedding API hoặc benchmark thật khi chưa có authorization.
4. Chuẩn bị offline harness đúng default hybrid/gate qua Spring/FastAPI, kiểm error/cancel/
   readiness; legacy direct KnowledgeIndex collector chưa đủ. Task implementation riêng.
5. Khi nguồn được phép dùng và có API authorization: build index với embeddings thật, bind/
   review final catalog/receipts và gold evidence vào actual snapshot, freeze pins; đo retrieval
   ba phương pháp, smoke giới hạn từ dev, rồi measured runs theo EVALUATION. Giữ failed/not-run,
   không retry/restart giữa run để xóa lỗi hoặc tune trên test; không lấy retrieval output làm gold.
6. Reviewer ký từng gate trên evidence snapshot. Gate chưa đạt/thiếu bằng chứng thì D1 vẫn mở;
   không chuyển Phase 4, không tuyên bố production-ready.

Lượt này chỉ thay PROCESS/EVALUATION; không tạo corpus/gold, chạy tests/evaluation/Gemini hoặc
đổi runtime/config. HEAD `c031267`, branch `chore/sync-origin-main-d120`, merge `9d6b581` và 261
staged paths được đối chiếu trước/sau; .env, artifacts và các files đã xóa/chỉnh sửa khác giữ
nguyên. Baseline audit: `.git/codex-d1-academic-scope/20261121-214107/state.json` (648 paths).

## D1 Acceptance Decision — 2026-11-23

| Thuộc tính | Quyết định |
| --- | --- |
| Decision | `ACCEPTED_WITH_LIMITATIONS` |
| Accepted by | `user` |
| Decision date | `2026-11-23` |
| Scope | **Academic Demo — Approved Synthetic Hotel Knowledge**; không phải Production |
| Accepted components | RAG Foundation, Embedding, Qdrant, BM25, Hybrid Retrieval, Grounded Generation, Citation, Verification và Abstention |

Đây là quyết định của người dùng chấp nhận **milestone D1 trong phạm vi nêu trên**,
không đồng nghĩa mọi quality gate đều PASS. Không sửa kết quả kiểm thử lịch sử,
không thay đổi ngưỡng acceptance hiện hành hoặc tự coi proposal chưa ký là đã được duyệt.
Không có quyền chạy API/indexing, phát hành Production hoặc mở giai đoạn triển khai kế tiếp từ quyết định này.

### Acceptance decision và quality gates được theo dõi riêng

| Hạng mục | Trạng thái tại 23/11/2026 | Bằng chứng/giới hạn |
| --- | --- | --- |
| Milestone D1 Academic Demo | ACCEPTED_WITH_LIMITATIONS | User chính thức chấp nhận scope và các thành phần nêu trên |
| Policy nguồn demo | Approved synthetic, hiệu lực 22/11/2026 | Policy gốc và 10 publication; approval không biến nguồn thành dữ liệu khách sạn thật hoặc approved catalog |
| Gold Dataset | pending_review, approved:false, scorable:false | 80 cases và 20 controls; chưa human-approved, chưa có hai reviewer độc lập/resolver được chỉ định |
| Held-out | Chưa blind/freeze | Cùng AI soạn hai split; family IDs rời nhau không chứng minh semantic independence hoặc topic coverage |
| Live evaluation | Chưa hoàn tất | Không có live run mới trong lượt ghi quyết định này; không suy từ kiểm tra tĩnh |
| Reliability D1.15 | Blocker chất lượng còn mở | Lịch sử 10/24 final đúng trạng thái, 9 application deadlines, 5 HTTP 503; chưa có bằng chứng khắc phục |
| Semantic quality/G20 | Chưa đóng quality gate | Deterministic verification kiểm consistency với catalog; catalog đúng cấu trúc nhưng sai nghĩa vẫn cần oracle/review độc lập |
| Production | Ngoài phạm vi chấp nhận | Không nới guards synthetic/production, allowlist hoặc quyền dữ liệu |
| D2–D4/Phase 4 | Không triển khai trong task | Bước tiếp theo chỉ chuẩn bị Human Review Gold Dataset |

Mọi dòng “D1 còn mở/PARTIAL” ở các mốc trước 23/11 là trạng thái acceptance lịch sử.
Quyết định này thay trạng thái **milestone**; các ô quality chưa kiểm chứng vẫn giữ nguyên, không đổi thành PASS.
594 tests/27 synthetic cases và các tỷ lệ live trước đó vẫn là bằng chứng lịch sử với phạm vi cũ.
Corpus demo đã approved/effective không có nghĩa đã ingestion, review facts/catalog hoặc bind runtime snapshot.

### Chuyển sang Human Review Gold Dataset

Packet hiện có: [policy-gold-2026-11-22-v1](../tests/evaluation/policy-gold-2026-11-22-v1/README.md).
Báo cáo review và danh sách đầy đủ các case cần con người xem:
[EVALUATION — Gold review preparation](EVALUATION.md#gold-review-preparation--2026-11-23).

- Đã đọc cả 80 query/expected outcomes và 20 controls, đối chiếu với 38 publication units hiện tại.
  Evidence anchors/version/hash và 17 phép tính/ngày đã được kiểm tra tĩnh; không dùng assertion count
  làm bằng chứng semantic correctness hoặc human approval.
- Dev/held-out mỗi bên 40 ca (24 A/12 U/4 O), tổng 33 family IDs không giao nhau; held-out chưa blind/freeze.
  Cần review topic gaps, minimal support sets, claim-level support và ranh giới U/O trong báo cáo.
- Tất cả D-A01–D-A24, H-A01–H-A24, D-U01–D-U12, H-U01–H-U12,
  D-O01–D-O04, H-O01–H-O04 và C01-P/N–C10-P/N vẫn cần human review.
  Không có case nào được approve hoặc freeze trong lượt này.
- Manifest Gold pin PROCESS/EVALUATION phiên bản 22/11. Cập nhật decision ngày 23/11 làm hai
  reference-document hashes lệch có chủ đích; xem kết quả kiểm tra sau sửa trong EVALUATION.
  Giữ nguyên manifest/validation.json/README và toàn bộ Gold; chưa re-pin để che drift.

Thứ tự tiếp theo: chỉ định hai reviewer độc lập và disagreement resolver; review 100% cases theo
rubric và các findings; xử lý bất đồng/label/minimal sets/topic coverage trong nhiệm vụ Gold riêng.
Trước blind evaluation phải có held-out độc lập phù hợp scope, source/scope pins và actual snapshot
binding được review/freeze. API budget/stop policy và kiểm chứng reliability D1.15 vẫn cần quyết định
và nhiệm vụ riêng; không chạy live, đổi retry/model/timeout hoặc indexing trong bước Human Review này.

### Bảo toàn và phạm vi kiểm tra lượt này

Chỉ sửa PROCESS.md/EVALUATION.md; Gold, policy, code, SQL và dữ liệu không đổi.
Kiểm tra tĩnh chỉ đọc, không gọi application/provider, không ghi đè historical validation.
HEAD `c031267`, branch `chore/sync-origin-main-d120`, MERGE_HEAD `9d6b581`,
261 staged paths và 59 paths đang xóa được đối chiếu trước/sau; index/cached diff, .env,
historical artifacts và toàn bộ paths ngoài hai tài liệu phải giữ nguyên.
Không stage/commit/push/reset/stash/đổi branch, không cài dependency.

Trạng thái bàn giao: **D1_ACCEPTED_WITH_LIMITATIONS / GOLD_REVIEW_READY**.
GOLD_REVIEW_READY chỉ xác nhận đã có packet và danh sách vấn đề để con người review,
không phải Gold approved, held-out frozen, quality-gate PASS hay Production readiness.

## Hướng A — Mở khóa 10 Policy Academic Demo, Reliability & Harness (2026-11-24)

Thực hiện theo ủy quyền của người dùng ngày 24/11/2026 trên working tree nhánh `chore/sync-origin-main-d120` (HEAD `c031267`, giữ nguyên `MERGE_HEAD=9d6b581` và 261 staged paths ngoài `ai-service/` để không ảnh hưởng staging ngoài phạm vi). Không cài thêm dependency, model hay dịch vụ mới.

### 1. Chẩn đoán định lượng D1.15 từ `http-timing.jsonl` (bằng chứng gốc)

Đọc trực tiếp 62 bản ghi trong `ai-service/.local/assistant-evaluation/d1-investigation/82c5419b-571c-402d-9509-e28faf11e30d/http-timing.jsonl`:

- `countTokens`: **31/31 thành công HTTP 200**.
- `generateContent`: **17 thành công HTTP 200**, **5 lỗi HTTP 503 (`classify`)**, **9 bị hủy bởi outer deadline (`8 classify`, `1 answer`)**.
- Toàn bộ 14 ca lỗi đều có `pre_trace_ms` chỉ 1,8–5,7 ms và `write_headers + write_body` < 2 ms; thời gian dồn vào **`wait_headers`** (2,3–14,3 giây cho các ca 503 và 12,7–19,9 giây cho các ca deadline). Điều này xác nhận nguyên nhân D1.15 là độ trễ/quá tải phía upstream `generateContent`, không phải lỗi TCP/TLS hay SQLite cục bộ.

### 2. Thay đổi đã triển khai trong `ai-service/`

- **Allowlist 10 Policy Academic Demo (`AI_DEMO_SOURCE_PACK`)**:
  - [snapshot.py](../app/ingestion/snapshot.py): giữ nguyên `SOURCES["demo_synthetic"]` mặc định (`d1_fixture`) để bảo toàn toàn bộ test D1 cũ; bổ sung `DEMO_SOURCE_PACKS["academic_policies"]` gồm đủ 10 file `knowledge/policies/publication-draft/pol-01..pol-10` và hàm `sources_for(mode, source_pack)` chặn tuyệt đối `academic_policies` ở mode `production`.
  - Truyền `source_pack` xuyên suốt [documents.py](../app/ingestion/documents.py), [vector_pipeline.py](../app/ingestion/vector_pipeline.py) (tách thư mục `.local/paired-index/demo_synthetic/academic_policies`), [vector_cli.py](../app/ingestion/vector_cli.py), [index.py](../app/retrieval/index.py), [hybrid.py](../app/retrieval/hybrid.py), [hybrid_cli.py](../app/retrieval/hybrid_cli.py), [artifacts.py](../app/orchestration/verification/artifacts.py), [settings.py](../app/settings.py), [indexing.py](../app/indexing.py), [main.py](../app/main.py).
- **Mở rộng Verification Schema & Catalog Capacity cho miền Policy**:
  - [verification.py](../app/schemas/verification.py): mở rộng `Unit` từ `minute|hour` sang `minute|hour|calendar_day|working_day|night|percent|vnd|guest|room`; nâng giới hạn `QuestionRule.aliases` (32 → 64) và `CatalogData.{questionRules,templates,facts}` (256 → 512).
  - [catalog.py](../app/orchestration/verification/catalog.py): nâng `MAX_CATALOG_BYTES` từ 256 KiB lên 1 MiB.
  - [publisher.py](../app/orchestration/verification/publisher.py): thêm helper/CLI offline tạo `sources.json` (`grounding-sources-1`) bất biến có `review_hash` và SHA-256 pin từ allowlisted sources đã duyệt; không tự tạo/duyệt facts và không chạy trên đường online.
- **Hardening Reliability & Phase 3 Harness**:
  - [gemini.py](../app/providers/gemini.py): đặt `trust_env=False` đồng bộ với `GeminiEmbedding`, `Qdrant` và `AsyncHTTP`.
  - [main.py](../app/main.py) & [settings.py](../app/settings.py): thêm `AI_DEPENDENCY_LATCH_COOLDOWN_S` (mặc định `0.0` giữ nguyên permanent latch đến restart; khi cấu hình `>0` cho phép phục hồi sau thời gian chờ).
  - [serve_d1_live.py](../tests/integration/serve_d1_live.py): cập nhật hỗ trợ Phase 3 (`--retrieval-mode hybrid|bm25`, `--source-pack`, bắt buộc `AI_GROUNDING` pins).
  - [run_policy_demo.py](../tests/evaluation/run_policy_demo.py): harness mới đánh giá retrieval offline (`--retrieval-only`) trên 10 policy (38 units) × 80 câu Gold và hỗ trợ `--live --allow-live-api` chạy đúng qua `create_app()`.
- **Kiểm thử mới**: [test_academic_policies_and_reliability.py](../tests/unit/test_academic_policies_and_reliability.py) (13 ca unit/integration mới).

### 3. Bằng chứng kiểm chứng & Baseline BM25 đo được (2026-11-24)

- **Baseline offline trước sửa**: `pytest -q tests/unit tests/integration` → **587 passed, 7 skipped (Docker opt-in), 0 failed, 1 warning Starlette/HTTPX**.
- **Regression sau sửa trên toàn bộ 21 test suites bị tác động** (gồm 13 test mới): **282 passed, 0 failed, 1 warning Starlette/HTTPX** (97,78s).
- **Ruff & dependency check**: `ruff check` + `ruff format --check` trên 100 file Python (`app/`, `tests/conftest.py`, `tests/unit/`, `tests/integration/`, 7 file evaluation ngoài packet Gold) → **All checks passed, 100 files already formatted**; `pip check` → **No broken requirements found**.
- **Phase 3 synthetic grounding evaluation**: `python -B -m tests.evaluation.evaluate_grounding` → **27/27 contract pass**, giữ nguyên phản ví dụ G20 (`semantic_acceptance: false`).
- **Diagnostic BM25 offline trên 10 policy (38 units) × 80 câu Gold (`pending_review`, chưa phải nghiệm thu)** — artifact `.local/assistant-evaluation/policy-demo-bm25-diagnostic.json` (ignored):
  - Tổng 48 câu Answerable (`A`): `unit_hit_any@3 = 81,25%` (39/48), `complete_evidence_set@3 = 72,92%` (35/48, miss 13 ca), `MRR@3 = 0,6910`, `Precision@3 = 0,2986`.
  - Theo split: `dev` (19 A) đạt `complete_set@3 = 89,47%`, `MRR@3 = 0,7807`; `held_out` (29 A) đạt `complete_set@3 = 62,07%`, `MRR@3 = 0,6322`.
  - Theo topic: `POL-03/06/07/10` đạt 100% complete-set; điểm yếu lớn nhất của BM25 là **`POL-04` (20%, 1/5)** và **`POL-02` (40%, 2/5)** do trùng từ khóa chung — chứng minh định lượng sự cần thiết của Qdrant + Gemini Embeddings (Hybrid Retrieval) cho bộ 10 policy.
  - Unanswerable/Out-of-scope: **24/24 U** và **8/8 O** vẫn có hits lexical (retrieval không thay thế abstention/gate).
  - Latency local: `p50 = 251,7 ms`, `p95 = 442,4 ms` (phần lớn là `index_validate` đọc/parse lại 10 YAML đồng bộ mỗi query; xác định định lượng R7).

### 4. Giới hạn còn mở sau đợt Hướng A

- **Human Review Gold Dataset**: chưa có người review thật (`review-events.jsonl` = 0/100 events); AI không tự ký duyệt Gold. Lưu ý: vì code trong `app/ingestion/documents.py` đã đổi có chủ đích theo Hướng A, validator tĩnh của packet `policy-gold-2026-11-22-v1` báo drift baseline tại file đó (giữ nguyên packet/manifest không tự re-pin để che drift).
- **Docker Qdrant & Live Gemini Run**: Docker daemon hiện chưa chạy trên máy và chưa có `catalog.json` được người review biên tập cho 10 policy, nên chưa thực hiện rebuild Qdrant bằng Gemini Embedding thật hoặc chạy `--live` qua `run_policy_demo.py`.
- **Git**: Chưa thực hiện `git commit`/`push` để bảo toàn 261 staged paths của bản merge `origin/main@9d6b581` ngoài `ai-service/`.

## Lifecycle regression — 2026-11-24

Trạng thái: **LIFECYCLE_REGRESSION_FIXED**. Chỉ sửa test và ghi bằng chứng tại mục này;
không sửa runtime hoặc thay quyết định acceptance/quality gates D1.

- Nguyên nhân: mock `KnowledgeIndex` trong ba biến thể của
  [lifecycle test](../tests/integration/test_d1_observability.py) dùng `lambda *args`,
  không nhận keyword-only `source_pack` mà factory hiện truyền vào; cả ba dừng bằng
  `TypeError` trước probe. Đã tái hiện riêng **3 failed** trước sửa.
- Thay mock bằng `create_autospec(KnowledgeIndex, return_value=index)` và kiểm tra lời gọi
  có `source_pack`. Giữ toàn bộ assertion cũ; bổ sung probe gọi đúng một lần và cancellation
  không đi vào thân lifespan. Client phải chưa đóng trong thân lifespan và đóng đúng một lần
  sau shutdown, dependency failure hoặc startup cancellation; `CancelledError` phải truyền ra ngoài.
- Ba ca sau sửa: **3 passed**; full unit/integration: **600 passed, 0 failed, 7 skipped**
  trong **150,72 giây**, so với **597 passed, 3 failed, 7 skipped** ở lượt rà soát trước.
  Bảy Docker opt-in skips và một warning Starlette/HTTPX giữ nguyên; không thêm skip hoặc bỏ assertion.
- Kiểm tra khả năng bắt lỗi bằng fake: bỏ đếm cleanup làm cả ba ca fail; nuốt startup
  cancellation làm ca cancel fail với `DID NOT RAISE`. Test được khôi phục nguyên bytes sau
  mỗi phép thử; lần chạy riêng cuối **3 passed**. Không thay runtime để mô phỏng lỗi.
- Ruff check/format: PASS, **93 files already formatted**; `pip check`: PASS,
  **No broken requirements found**. Không cài dependency/model/dịch vụ, gọi Gemini/API,
  chạy live evaluation, Docker hoặc DB.

Commands từ `ai-service`:

```powershell
.\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests/integration/test_d1_observability.py::test_probe_client_closed_on_shutdown_failure_or_startup_cancel --tb=short --show-capture=no
.\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider tests/unit tests/integration --tb=short --show-capture=no
.\.venv\Scripts\ruff.exe check --no-cache app tests/conftest.py tests/unit tests/integration
.\.venv\Scripts\ruff.exe format --check --no-cache app tests/conftest.py tests/unit tests/integration
.\.venv\Scripts\python.exe -B -m pip check
```

Đối chiếu hash giữ nguyên branch `chore/sync-origin-main-d120`, HEAD `c031267`,
MERGE_HEAD `9d6b581`, Git index/staged diff và 633 file ngoài hai file sửa, gồm `.env`,
Gold/policy/Human Review Packet và artifacts hiện tại. Không stage/commit/push.
Phạm vi kết quả là regression offline; reliability live, catalog và review Gold vẫn còn mở.

## Gold/Packet provenance revision — 2026-11-24

Revision mới: [0.1.3-provenance](../tests/evaluation/policy-gold-2026-11-22-v1/revisions/0.1.3-provenance/README.md).
Phát hành theo yêu cầu đồng bộ checkout hiện tại; revision 0.1.2-draft tại thư mục dataset gốc,
hai revision trong `history/`, packet và mọi report lịch sử giữ nguyên bytes/checksum.
Không dùng kết quả STATIC_PASS ngày 23/11 để đại diện checkout ngày 24/11.

- Toàn bộ 80 Gold records và 20 controls giữ nguyên hoàn toàn, kể cả ID, query, answer, label,
  evidence, split, scopeBasis lịch sử và record hash. Scope hiện hành của tám O records được
  pin riêng trong manifest mới, có file hash, khoảng dòng và quote/checksum; không thay record.
- Validator mới phân biệt production allowlist, demo mặc định `d1_fixture` và pack
  `academic_policies` chứa đúng 10 publication files. Kiểm tra production từ chối demo pack;
  chỉ đọc AST/tables và chạy hàm routing thuần, không import application hoặc ingestion.
- `runtimeBinding` phân biệt việc đã mở allowlist demo với việc chưa bind snapshot/catalog/chunk
  cho revision này; không suy ingestion hay model quality từ source eligibility.
- Gold/Packet validators, report mới và kiểm tra integrity/history nằm cùng revision mới.
  Report cũ không bị ghi đè. Trạng thái kiểm chứng cuối phải đọc từ report mới và chạy lại
  validator; ghi chú tiến độ này không tự cấp PASS hoặc human approval.
- Known regression vẫn exposed, không blind/frozen/scorable; 100 records vẫn NOT_REVIEWED.
  R1/R2/resolver/custodian chưa được chỉ định. Không approval, review decision, API/live,
  ingestion/indexing, Docker/DB hoặc cài dependency/model/dịch vụ mới.
- Lịch sử được kiểm tra theo bytes/checksum và report đã lưu. Bản source baseline cũ còn thiếu
  phải được ghi rõ trong history report; không dựng bytes giả hoặc nhận là tái chạy PASS cũ.

Commands từ gốc repository (chỉ đọc):

```powershell
.\ai-service\.venv\Scripts\python.exe -X utf8 -B ai-service/tests/evaluation/policy-gold-2026-11-22-v1/revisions/0.1.3-provenance/validate.py
.\ai-service\.venv\Scripts\python.exe -X utf8 -B ai-service/tests/evaluation/policy-gold-2026-11-22-v1/revisions/0.1.3-provenance/human-review/validate.py
```

Giữ nguyên branch/HEAD/MERGE_HEAD/Git index và staging. Không commit/push.


## Single Reviewer — Gold Dataset (ghi hồ sơ 2026-11-24T13:59:15+07:00)

- Session: [single-reviewer-v1](../tests/evaluation/policy-gold-2026-11-22-v1/review-sessions/single-reviewer-v1/README.md).
- Người review do user xác nhận: `hieu`; mode `single_reviewer`; quyết định
  `SINGLE_REVIEWER_ACCEPTED`, bao phủ đủ 80 Gold cases và 20 controls. Ghi một bulk
  attestation theo xác nhận thực trong hội thoại; không tạo 100 event PASS theo rubric.
- `reviewedAt=null`: user không cung cấp thời điểm hoàn tất review. `recordedAt=2026-11-24T13:59:15+07:00`
  chỉ là thời điểm Codex ghi hồ sơ; `recordedBy=codex` không phải reviewer thứ hai.
- Independent review `NOT_PERFORMED`; chỉ có một reviewer. Không tạo R2, adjudicator,
  appointmentRef hoặc danh tính giả. Chín trục/rationale từng case và các kết luận F1–F4/CTX
  chưa được cung cấp; không tự ký PASS hoặc đóng gate tương ứng.
- Các ghi chú 0/100 events, NOT_REVIEWED trong packet/revision trước là snapshot lịch sử
  của quy trình R1/R2; session mới ghi nhận xác nhận single reviewer riêng. Không đổi
  Gold, controls, policy, records.md, review-register.json, schema/ledger cũ hoặc report lịch sử.
- Gold vẫn pending_review, approved:false, scorable:false; known regression đã lộ,
  blind:false/frozen:false. Paired/independent review, rubric/focus evidence, release approval,
  independent evaluation, runtime binding và live reliability vẫn mở.
- Provenance mới pin riêng bản PROCESS sau append và lưu nguyên bytes/checksum của
  PROCESS trước sửa trong session. Check release 0.1.3 trước sửa đã PASS; sau append,
  validator 0.1.3 phải báo reference drift. Giữ nguyên manifests/reports lịch sử, không
  re-pin để che drift hoặc coi PASS cũ là kết quả checkout hiện tại.
- Kiểm tra hồ sơ: `validate.py --check-report` và `test_integrity.py` trong session;
  [validation.json](../tests/evaluation/policy-gold-2026-11-22-v1/review-sessions/single-reviewer-v1/validation.json)
  là report mới. Validator chỉ kiểm schema/inventory/hashes/giới hạn, không chấm semantic.
- Không stage/commit/push, đổi branch, gọi live API/DB, ingestion/indexing hoặc cài
  dependency/model/dịch vụ. Phạm vi thay đổi chỉ session mới và append PROCESS này.
- Session checks: validate.py --check-report = SESSION_INTEGRITY_PASS; test_integrity.py = 14 passed; Ruff check/format = PASS. Removing the reviewedAt-null guard was detected by the negative test; validator and manifest were restored byte-for-byte. These are offline integrity checks, not semantic or live acceptance.


## Kiểm chứng hoàn thiện D1 Academic Demo — 2026-11-24 (tối)

Thực hiện trên nhánh `chore/sync-origin-main-d120` (HEAD `c031267`, giữ nguyên `MERGE_HEAD=9d6b581` và toàn bộ 261 staged paths ngoài `ai-service/`, không commit/push). Chỉ bổ sung file test [test_academic_demo_preflight.py](../tests/unit/test_academic_demo_preflight.py) và append mục này vào `PROCESS.md`; không sửa code runtime, `.env`, Gold dataset, snapshot hay manifests lịch sử. Không cài thêm dependency/model/dịch vụ mới (chỉ bật Docker Desktop và container Qdrant `pbl6-rag-index-qdrant-1` có sẵn trong [compose.qdrant.yaml](../compose.qdrant.yaml)).

### 1. Ghi nhận thay đổi working tree chiều 24/11 và kiểm chứng offline/Docker

- **Tài nguyên Academic Demo đã tạo trong working tree**: [academic-demo.contract.json](../academic-demo.contract.json), [academic_demo_contract.py](../app/academic_demo_contract.py), [academic_demo_preflight.py](../app/academic_demo_preflight.py), paired snapshot `academic_policies` (`.local/paired-index/demo_synthetic/academic_policies/427f77fb23aa4e5a84abf2cd9e760f34`, `snapshot_id=fd7d1e18b67bce057b77bfcb4ce57e4fc31c186bc1f8d023fb75ae9773c80981`, `gemini-embedding-001` 768 chiều, 38 chunks), cùng artifacts `.local/grounding/demo_synthetic/academic-policies-2026-11-24-v1/{catalog.json,sources.json}` (28 facts, 19 `questionRules`/132 aliases, 28 templates, 10 sources, 38/38 reviewed chunks).
- **Hai bản sửa runtime chiều 24/11 đã có sẵn trên working tree**: [gemini.py](../app/providers/gemini.py) thêm `_gemini_schema()` chuyển `const` sang `enum` cho `responseJsonSchema`; [hybrid.py](../app/retrieval/hybrid.py) lọc Vietnamese stopwords trong nhánh BM25; [test_academic_policies_and_reliability.py](../tests/unit/test_academic_policies_and_reliability.py) bổ sung hai ca test tương ứng.
- **Unit tests mới cho contract/preflight**: thêm [test_academic_demo_preflight.py](../tests/unit/test_academic_demo_preflight.py) (7 ca: schema contract thực tế, từ chối nested profile thiếu/duplicate JSON keys/oversize/mode production/sai entrypoint-secrets, preflight cục bộ hợp lệ trên workspace tạm, phát hiện thiếu snapshot và file WAL sidecar, từ chối sai SHA-256/path escape/empty authorities, mã thoát CLI `0/1/2`) → **7 passed**.
- **Preflight & Qdrant inventory thực tế**:
  - `python -B -m app.academic_demo_preflight --contract academic-demo.contract.json` → **`LOCAL_ARTIFACTS_VALID`** (7/7 kiểm tra cục bộ PASS; 6 `external_gates` giữ nguyên chưa xác minh).
  - `python -B -m app.ingestion.vector_cli status --mode demo_synthetic --source-pack academic_policies` với `pbl6-rag-index-qdrant-1` đang chạy → **exit 0**, xác nhận đủ **38 chunks/vectors** khớp snapshot `fd7d1e18...` trên collection `pbl6_demo_synthetic_fd7d1e18b67bce05_427f77fb23aa4e5a84abf2cd9e760f34`.
- **Full regression (offline + Docker)**:
  - `PBL6_QDRANT_DOCKER=1 pytest -q -p no:cacheprovider tests/unit tests/integration` → **`616 passed, 0 failed, 0 skipped, 1 warning Starlette/HTTPX`** trong **115,67 giây** (gồm toàn bộ 7 Docker integration tests và 7 unit tests mới).
  - `ruff check` + `ruff format --check` trên 99 file Python (`app`, `tests/conftest.py`, `tests/unit`, `tests/integration`, `run_policy_demo.py`, `evaluate_grounding.py`, `benchmark_hybrid.py`) → **PASS**; `pip check` → **No broken requirements found**; `docker compose -f compose.qdrant.yaml config --quiet` → **PASS**.
  - `python -B -m tests.evaluation.evaluate_grounding` → **27/27 contract pass**, giữ nguyên G20 (`semantic_acceptance: false`).
  - Kiểm tra tĩnh `QuestionBinding`: **0/48 câu Answerable** trong `policy-gold-2026-11-22-v1/gold.json` khớp nguyên văn với 132 aliases của `catalog.json` (xác nhận giới hạn closed full-message aliases khi gặp câu hỏi tự nhiên/kịch bản).
  - Trước khi append mục này, `single-reviewer-v1/validate.py --check-report` trả `SESSION_INTEGRITY_PASS`; việc append mục này làm SHA-256 `PROCESS.md` thay đổi có chủ đích, giữ nguyên manifests/reports lịch sử không re-pin để che drift.

### 2. Live smoke có giới hạn qua `create_app()` (ủy quyền người dùng, 2026-11-24)

Tập 12 câu kiểm tra end-to-end đường Phase 3 (`S01–S08` thuộc aliases `catalog.json` của `POL-01/02/03/04/05/07/09`, `S09` thiếu nguồn, `S10` paraphrase ngoài alias, `S11–S12` ngoài phạm vi D1 giá phòng/booking cá nhân). Không retry ca lỗi; không in secrets. Báo cáo lượt cuối lưu cục bộ tại `.local/assistant-evaluation/academic-demo-live-smoke-2026-11-24.json` (ignored).

- **Phát hiện lệch cấu hình contract vs. `.env`**: [academic-demo.contract.json](../academic-demo.contract.json) pin `GEMINI_MODEL=gemini-3.1-flash-lite` và `AI_DEPENDENCY_LATCH_COOLDOWN_S=0.0`, trong khi `.env` cục bộ hiện đặt `GEMINI_MODEL=gemini-3.5-flash-lite` và `AI_DEPENDENCY_LATCH_COOLDOWN_S=5.0` (phần `AI_GROUNDING` khớp nhau).
- **Hai lượt khởi tạo theo profile contract (`gemini-3.1-flash-lite`)**: cả hai đều dừng ở startup probe (lượt 1: `countTokens` HTTP 200 286,7 ms, `generateContent` `application_deadline` sau 4725,6 ms / tổng 5014,1 ms; lượt 2: `countTokens` HTTP 200 199,6 ms, `generateContent` **HTTP 503** sau 505,7 ms); `/ready` giữ `503 not_ready`, 0 turn được dispatch.
- **Lượt 1 trên active `.env` (`gemini-3.5-flash-lite`, `hybrid`, `cooldown=5.0`)**: startup probe PASS (`1453,1 ms`, `/ready=200`). `S01` gặp **HTTP 503** ở `classify/generateContent` (`wait_headers=1647,6 ms`), kích hoạt latch 5 giây khiến `S02–S12` chạy nối tiếp ngay lập tức đều bị chặn `503 DEPENDENCY_UNAVAILABLE` trong 2,4–7,1 ms (`0/12 matched`).
- **Lượt 2 trên active `.env` (chờ 5,5 giây sau mỗi 503 trước khi chạy ca kế tiếp, mỗi ca chạy đúng 1 lần)**:
  - Readiness: probe PASS (`1241,2 ms`), `/ready=200` trước và sau batch (`ready_after=200`, xác nhận cooldown tự phục hồi).
  - Kết quả tổng: **`3/12 matched`** (`S09 insufficient_evidence`, `S11/S12 capability_unavailable`); **`0/8` ca `answered` hoàn tất được final**; latency `p50=2726,56 ms`, `p95=20063,49 ms`; usage chỉ tính final: `743 input / 210 output tokens`.
  - Chi tiết 9 ca không khớp:
    - **5 lỗi provider `generateContent`**: `S01` (`answer` HTTP 503, 2636 ms), `S02` (`answer` `DEADLINE_EXCEEDED`, 20063 ms, `wait_headers` abort 17284 ms), `S03` (`answer` HTTP 503, 2915 ms sau `classify` 10096 ms), `S07` (`classify` HTTP 503, 938 ms), `S08` (`answer` HTTP 503, 4823 ms). Toàn bộ `countTokens` (77–200 ms) và Hybrid Retrieval + Gemini Query Embedding + Qdrant (513–896 ms) đều thành công 100%; riêng `answer/generateContent` (schema `CandidateDraft v2` dài 8410 ký tự có `$defs`/`oneOf`/`discriminator`/`pattern`) thất bại **4/4 lần** (cần kiểm chứng thêm xem nguyên nhân là overload upstream hay độ phức tạp schema).
    - **3 lỗi phân loại intent (`CLASSIFY`)**: `S04` (đặt cọc bao nhiêu %), `S06` (thời hạn hoàn tiền), `S10` (thời hạn thanh toán cọc) đều bị phân loại `capability_unavailable` thay vì `faq` do [prompt CLASSIFY](../app/prompts/faq.py) liệt kê `"payment ... are unavailable"` chưa tách rõ *hỏi chính sách cọc/thanh toán/hoàn tiền tĩnh* với *thực hiện thanh toán/giao dịch live*.
    - **1 ca Hybrid Retrieval thiếu section đích**: `S05` (*"Chính sách hủy đặt phòng như thế nào?"*) truy xuất top-3 `POL-05-U06, POL-05-U01, POL-03-U05` (thiếu `POL-04-U01`), gate fail-closed trả `insufficient_evidence` (0 hallucination, 0 citation sai).

### 3. Giới hạn và việc cần làm tiếp để đóng hoàn toàn chất lượng D1

- **Reliability & `answer/generateContent` (R1 — vẫn là blocker lớn nhất)**: cần xác định rõ nguyên nhân 4/4 `answer/generateContent` lỗi 503/deadline (thử tối giản/flatten schema gửi trong `_gemini_schema()` mà vẫn giữ nguyên `CandidateDraft` Pydantic validation phía host, hoặc đối chiếu ổn định model/endpoint).
- **Prompt `CLASSIFY`**: cần tinh chỉnh ranh giới giữa câu hỏi chính sách đặt cọc/thanh toán/hoàn tiền (`faq`) với thao tác thanh toán/giá/booking live (`unavailable`), kèm unit/contract tests trước khi chạy live lại.
- **Độ phủ Retrieval & `QuestionBinding`**: xử lý miss top-3 trên `S05` (`POL-04`) và chốt hướng cho khoảng trống `0/48` câu Gold do `QuestionBinding` exact-alias.
- **Đồng bộ contract và `.env`**: quyết định chốt `GEMINI_MODEL` và `AI_DEPENDENCY_LATCH_COOLDOWN_S` giữa [academic-demo.contract.json](../academic-demo.contract.json) và `.env`.
- **Trạng thái D1 giữ nguyên**: `ACCEPTED_WITH_LIMITATIONS` (chưa đóng quality gates live/semantic; chưa mở D2).


### 4. Đợt sửa kỹ thuật D1 (CLASSIFY + `_gemini_schema` + đồng bộ contract) và kiểm chứng lại — 2026-11-24

Thực hiện theo xác nhận của người dùng, giữ nguyên nhánh `chore/sync-origin-main-d120`, HEAD `c031267`, `MERGE_HEAD=9d6b581`, 261 staged paths ngoài `ai-service/` và `.env`. Không cài thêm dependency/model/dịch vụ mới.

- **Tinh chỉnh prompt `CLASSIFY` ([faq.py](../app/prompts/faq.py))**: tách rõ câu hỏi chính sách đặt cọc/thanh toán/nhận-trả phòng/hủy/hoàn tiền/trẻ em/thú cưng/dịch vụ/khiếu nại/quyền riêng tư (`faq`) khỏi thao tác giá/tồn phòng live, tra cứu/sửa booking hoặc hóa đơn cá nhân và thực hiện thanh toán/hoàn tiền (`unavailable`). Giữ `VERSION = "d1-faq-1"`.
- **Tối giản `_gemini_schema()` ([gemini.py](../app/providers/gemini.py))**: inline `$ref`/`$defs`, chuyển `const` → `enum`, `oneOf` → `anyOf`, bỏ `pattern`/`minLength`/`maxLength`/`discriminator`/`format` và `title` ở các nhánh con (giữ lại `title` ở root để tương thích đầy đủ hợp đồng/tests hiện có). Kích thước JSON Schema gửi lên Gemini cho `CandidateDraft` giảm từ **8.410 → ~2.690 ký tự**; host vẫn kiểm tra strict 100% bằng `CandidateDraft.model_validate_json()`.
- **Đồng bộ contract với `.env`**: cập nhật [academic-demo.contract.json](../academic-demo.contract.json) và [academic_demo_contract.py](../app/academic_demo_contract.py) sang `GEMINI_MODEL=gemini-3.5-flash-lite` và `AI_DEPENDENCY_LATCH_COOLDOWN_S=5.0`; cập nhật assertions tương ứng trong [test_academic_policies_and_reliability.py](../tests/unit/test_academic_policies_and_reliability.py) và [test_academic_demo_preflight.py](../tests/unit/test_academic_demo_preflight.py).
- **Kiểm chứng offline & Docker cuối cùng**:
  - Đối chiếu contract vs. `Settings()`: 6/6 trường (`model`, `cooldown`, `grounding`, `corpus_mode`, `source_pack`, `retrieval_mode`) khớp `True`.
  - `python -B -m app.academic_demo_preflight --contract academic-demo.contract.json` → **`LOCAL_ARTIFACTS_VALID`** (7/7 checks PASS).
  - `python -B -m tests.evaluation.evaluate_grounding` → **`27/27` contract pass** (giữ G20 `semantic_acceptance: false`).
  - `PBL6_QDRANT_DOCKER=1 pytest -q -p no:cacheprovider tests/unit tests/integration` → **`616 passed, 0 failed, 0 skipped, 1 warning Starlette/HTTPX`** (404,54s; vòng trung gian trước khi giữ lại root `title` có 18 lỗi `KeyError: 'title'` ở `test_d1_observability.py`/`test_grounded_factory.py`, đã sửa và xác nhận 616/616 pass trên bytes cuối).
  - `ruff check` + `ruff format --check` (96 file) → **PASS**; `pip check` → **No broken requirements found**.
- **Live smoke v2 có giới hạn (12 câu qua `create_app()`, báo cáo ignored `.local/assistant-evaluation/academic-demo-live-smoke-2026-11-24-v2.json`)**:
  - Readiness: startup probe PASS (`1406,0 ms`), `/ready=200` trước và sau batch (`ready_after=200`).
  - **Cột mốc mới — câu `answered` Phase 3 thật đầu tiên có citation đã xác minh**: `S04` (*"Đặt phòng cần đặt cọc bao nhiêu phần trăm?"*) đạt **HTTP 200, `answered`** (`9656,9 ms`, evidence `POL-01-U02, POL-03-U01, POL-01-U06`, citation `pbl6-publication-pol-03 / POL-03-U01 v0.1.1`, canonical renderer đúng 30% + nhãn Academic Demo, `2424 input / 296 output tokens`).
  - **Hiệu quả sửa `CLASSIFY`**: cả **3/3** ca bị phân loại sai trước đó đều định tuyến đúng (`S04` → `answered`; `S06` → đi qua `classify` + hybrid retrieval vào tới `answer`; `S10` → đi qua `classify` + hybrid retrieval `POL-03-U01/U05/U04` rồi gate fail-closed `insufficient_evidence` đúng kỳ vọng), trong khi `S11/S12` (giá phòng live/booking cá nhân) vẫn chặn đúng `capability_unavailable`.
  - **Kết quả tổng v2**: **`4/12 matched`** (`S04 answered`, `S10 insufficient_evidence`, `S11/S12 capability_unavailable`), **7 `DEPENDENCY_UNAVAILABLE` (HTTP 503)** và **1 `DEADLINE_EXCEEDED`** (`S07`, 20171,9 ms); `p50=5896,8 ms`, `p95=20171,9 ms`; usage final-only `2903 input / 385 output tokens`.
  - **Phân rã HTTP timing v2**: `countTokens` **20/20 HTTP 200** (`1 probe + 12 classify + 7 answer`), `classify/generateContent` **10/12 HTTP 200 + 2× HTTP 503**; có **7/8 ca `answered`** vào được tới `answer/countTokens` (chứng minh classify + hybrid retrieval + QuestionBinding + preflight đều vượt qua), nhưng `answer/generateContent` vẫn gặp **5× HTTP 503 + 1× deadline** (chỉ 1/7 thành công là `S04`). Như vậy, dù đã tối giản schema và có bằng chứng end-to-end thành công, **độ ổn định upstream `generateContent` (R1) vẫn là blocker chính của chất lượng live D1**.


### 5. Lát P0 offline: `QuestionBinding` có cấu trúc, chuẩn bị chẩn đoán A/B generation và đồng bộ tái lập — 2026-11-24

Thực hiện theo ưu tiên P0/P1 của người dùng (hoàn toàn **offline**, **không gọi Gemini API**, giữ nguyên nhánh `chore/sync-origin-main-d120`, HEAD `c031267`, `MERGE_HEAD=9d6b581`, 261 staged paths ngoài `ai-service/`, `.env` và pinned `.local/grounding/`). Không cài thêm dependency/model/dịch vụ mới.

- **P0-1 — `QuestionBinding` mẫu câu & tham số miền policy (offline)**:
  - [verification.py](../app/schemas/verification.py): bổ sung `ParamKind`, `ParamSpec` (có kiểm tra cận `minCount/minValue/maxValue`), `QuestionPattern` (`patternId`, `allOf`, `noneOf`, `requiredParams`, `disallowedParams`, `asciiFold`) và trường tùy chọn `QuestionRule.patterns = ()`.
  - [catalog.py](../app/orchestration/verification/catalog.py): bảo toàn byte-identical `review_hash`/`component_hashes` khi `patterns == ()` (không phá hash của catalog hiện có), đồng thời băm đầy đủ `patterns` khi khác rỗng để fail-closed nếu bị sửa lén; kiểm tra `patternId` duy nhất và không rỗng khi biên dịch catalog.
  - [questions.py](../app/orchestration/verification/questions.py): bổ sung `fold_text()` (chuẩn hóa bỏ dấu tiếng Việt quyết định tính), `extract_params()` (trích và xác thực miền cho `time_hhmm`, `date_dmy`, `vnd_amount`, `percent`, `age_years`, `duration`, `count`), hỗ trợ khớp cả `aliases` chính xác lẫn `patterns` có cấu trúc; mọi xung đột giữa 2 rule khác nhau (kể cả alias vs pattern) đều trả `ambiguous` (`question_ambiguous`), không phân giải theo thứ tự rule.
  - [test_verification_questions.py](../tests/unit/test_verification_questions.py): mở rộng từ 10 lên **15 unit tests** (bỏ dấu/paraphrase, `noneOf`, tham số hợp lệ/sai định dạng/ngoài miền, `disallowedParams`, xung đột liên rule → `ambiguous`, đi xuyên `VerificationGate.prepare` + `final_payload`, chống sửa lén hash catalog).
  - [evaluate_question_binding.py](../tests/evaluation/evaluate_question_binding.py): đo **offline chỉ trên split `dev`** (`held_out_touched: false`, báo cáo `.local/assistant-evaluation/question-binding-dev-eval-2026-11-24.json`, không chép câu Gold vào aliases/patterns và không ghi đè `.local/grounding/`):
    - Trên 6 câu `dev-A` đã có fact trong catalog 28 facts hiện tại (`D-A03, D-A18, D-A19, D-A21, D-A22, D-A23`): tăng từ **`0/6 → 6/6` (100%)** khớp đúng `bindingKey` và **`6/6` pass host `VerificationGate.prepare()`** (`needs_candidate=True`).
    - Trên 13 câu `dev-A` còn lại thuộc khoảng trống fact của catalog 28 facts (quy tắc phụ/bài toán tính nhiều bước chưa có atomic fact trong catalog): **`0/13` false-bound** (từ chối sạch thay vì khớp nhầm fact).
    - Tỷ lệ khớp sai trên `dev-U`: **`0/10` (0%)**; trên `dev-O`: **`0/4` (0%)**.
    - Bộ 19 paraphrase tự nhiên (1 câu mới/rule, độc lập Gold): tăng từ **`0/19 → 19/19` (100%)**, `19/19` host gate ready.
    - Bộ 6 ca adversarial (đa chủ đề mơ hồ, phủ định, giờ ngoài miền, ngày `31/02/2008` sai lịch): **`6/6` (100%) fail-closed**, `0` false-bound.
- **P0-2 — Harness chẩn đoán A/B generation có giới hạn (chuẩn bị, chưa chạy live)**:
  - Thêm [diagnose_generation.py](../tests/evaluation/diagnose_generation.py) và 3 unit tests offline tại [test_generation_diagnostic.py](../tests/unit/test_generation_diagnostic.py) (3/3 pass).
  - Cố định 100% `query`, `FIXED_INPUT`, `model` (`gemini-3.5-flash-lite`), `SHARED_DIAGNOSTIC_PROMPT` và `budget` (`20000 ms`, `8000/2000` tokens), chạy xen kẽ `minimal` (`MinimalProposal`, **336 bytes**) và `candidate_v2` (`CandidateDraft`, **2.691 bytes**) theo số lượt chốt trước (`--trials 5` → 10 lượt tổng, tối đa 20/arm, không retry).
  - Ghi đầy đủ metadata tái lập (query, `input_sha256`, `classify_prompt_version/sha256`, `answer_prompt_version/sha256`, `catalog_sha256`, `sources_sha256`, `snapshot_id`, `schema_bytes/sha256` từng arm) và HTTP status + timing từng phase qua `ai_service.http_timing` (`emitter.drain()`), phân loại tự động `success` / `upstream_http_5xx` / `upstream_http_4xx` / `client_deadline_exceeded` / `schema_or_protocol_error` / `transport_error`.
  - Mặc định `--validate-only` (0 network calls); live yêu cầu tường minh `--live --allow-live-api`.
- **P1-4 — Đồng bộ version prompt và phần tóm tắt hiện hành**:
  - Nâng `VERSION` trong [faq.py](../app/prompts/faq.py) lên `"d1-faq-2"` cho khớp với nội dung prompt `CLASSIFY` đã sửa.
  - Cập nhật đoạn tóm tắt hiện hành đầu [README.md](../README.md) và `PROCESS.md`, giữ nguyên toàn bộ các báo cáo lịch sử.
- **Kiểm chứng cuối cùng**:
  - `PBL6_QDRANT_DOCKER=1 pytest -q -p no:cacheprovider tests/unit tests/integration` → **`624 passed, 0 failed, 0 skipped, 1 warning Starlette/HTTPX`** (391,01s).
  - `ruff check` + `ruff format --check` trên toàn bộ 99 file Python (sau khi format lại 1 dòng ở `evaluate_question_binding.py`): **PASS**; `pip check`: **PASS**; `academic_demo_preflight`: **`LOCAL_ARTIFACTS_VALID`**; `diagnose_generation --validate-only --trials 5`: **exit 0**.


### 6. Sửa hai lỗi soundness ở `QuestionBinding` (câu ghép & tham số sai đi kèm đúng) — 2026-11-25

Thực hiện đúng bước 1 trong thứ tự người dùng đề xuất (chỉ offline, chưa phát hành/đổi pin catalog runtime, chưa chạy live API; giữ nguyên nhánh `chore/sync-origin-main-d120`, HEAD `c031267`, `MERGE_HEAD=9d6b581` và 261 staged paths ngoài `ai-service/`). Không cài thêm dependency/model/dịch vụ mới.

- **Sửa lỗi 1 — Chặn câu ghép trả lời thiếu vế ([questions.py](../app/orchestration/verification/questions.py))**: bổ sung `_has_uncovered_compound_clause()` (đối xứng cho cả hai chiều `A và B` / `B và A`, nhiều câu hỏi tách bằng `?`/`;`, cụm nối bổ sung `ngoài ra`/`thêm nữa`/`với lại`/`bên cạnh đó` và lặp vị từ/chủ đề `có X và có Y`, `chính sách X và chính sách Y`). Khi một vế hỏi ngoài phạm vi rule không được phủ, `bind_question()` trả `unknown / compound_question_uncovered` và `VerificationGate` abstain `insufficient_evidence` (0 citations); khi hai rule khác nhau khớp hai vế, `len(set(matches) | compound_matches) > 1` vẫn trả `ambiguous / question_ambiguous`.
- **Sửa lỗi 2 — Không bỏ qua tham số sai khi có tham số đúng ([questions.py](../app/orchestration/verification/questions.py))**: tách `analyze_params()` trả cả `valid` lẫn `invalid` (`InvalidParam` cho giờ/ngày/phần trăm/tuổi sai định dạng như `25:99`, `31/02/2026`, `150%`, `199 tuổi`), tránh hiểu nhầm `24/7` thành ngày `24/07`, và trong `_match_pattern()` fail-closed `unknown / invalid_parameter` nếu câu chứa bất kỳ tham số sai hoặc trộn tham số trong miền với ngoài miền (vd. `18:00 hay 23:00` khi `minValue=22:00`).
- **Regression tests ([test_verification_questions.py](../tests/unit/test_verification_questions.py))**: bổ sung 8 ca mới (tổng **23/23 pass**), bao phủ cả 2 lỗi người dùng tái hiện ở cả tầng `bind_question` lẫn `VerificationGate.prepare/final_payload` (`Wi-Fi ở đâu và hồ bơi mở cửa lúc mấy giờ?`, chiều đảo ngược, `23:00 hay 25:99`, `18:00 hay 23:00`, `10/12/2026 hay 31/02/2026`, `24/7`).
- **Tách bạch báo cáo evaluator ([evaluate_question_binding.py](../tests/evaluation/evaluate_question_binding.py), schema v2)**:
  - Ghi rõ `evaluation_catalog_mode="in_memory_augmented_not_pinned"`, `runtime_catalog_patterns_count=0` (catalog đang pin cho runtime vẫn chưa có patterns) vs. `augmented_catalog_patterns_count=21`.
  - Siết `p-pol07-pets` yêu cầu đủ 2 nhóm khái niệm (thú cưng + quy định/cho phép mang) và mở rộng `ADVERSARIAL_SUITE` lên **12 ca** (thêm câu ghép thú cưng + hồ bơi và tham số vừa đúng vừa sai) → **`12/12` pass, `0` false-bound**.
  - Tách rõ **`oracle_gate_ready`** (chọn sẵn evidence theo fact bindings, không đo recall retrieval) với **`bm25_retrieved_gate_ready`** (chạy trực tiếp `HybridRetriever.bm25()` top-3 offline trên snapshot đang pin):
    - `dev-A` có fact trong catalog (6 ca): `6/6` bound exact, **`6/6` oracle gate ready**, **`5/6` BM25 retrieved gate ready**.
    - 19 paraphrase tự nhiên: `19/19` bound exact, **`19/19` oracle gate ready**, **`13/19` BM25 retrieved gate ready**.
    - `dev-A` thiếu fact catalog (`0/13`), `dev-U` (`0/10`), `dev-O` (`0/4`): **0 false-bound**, `held_out_touched: false`.
- **Kiểm chứng của bước này**: ma trận 8 suite verification + factory + preflight + diagnostic (`test_verification_questions`, `test_verification_catalog`, `test_verification_gate`, `test_verified_faq_adapter`, `test_academic_demo_preflight`, `test_academic_policies_and_reliability`, `test_generation_diagnostic`, `test_grounded_factory`) → **`129 passed, 0 failed, 1 warning Starlette/HTTPX`** (52,19s; đây là tập regression trực tiếp liên quan, chưa chạy lại toàn bộ 632 tests gồm Docker); `ruff check` + `ruff format --check` (99 file): **PASS**; `pip check`: **PASS**; `academic_demo_preflight`: **`LOCAL_ARTIFACTS_VALID`**.


### 7. Phát hành catalog `academic-policies-2026-11-25-v2`, cập nhật pin runtime & nâng cấp BM25 bigrams — 2026-11-25

Thực hiện theo xác nhận của người dùng (bước 2 & bước 3: phát hành v2 có patterns + bổ sung atomic facts cho 13 ca `dev-A` và cải thiện/đo retrieval thực offline; **không gọi Gemini API** trong lượt này; giữ nguyên nhánh `chore/sync-origin-main-d120`, HEAD `c031267`, `MERGE_HEAD=9d6b581`, 261 staged paths ngoài `ai-service/` và release bất biến `academic-policies-2026-11-24-v1`). Không cài thêm dependency, model hay dịch vụ mới.

- **Phát hành bất biến `academic-policies-2026-11-25-v2` ([build_academic_catalog_v2.py](../tests/evaluation/build_academic_catalog_v2.py))**:
  - Giữ nguyên release `v1` (`.local/grounding/demo_synthetic/academic-policies-2026-11-24-v1/catalog.json`, `sha256=5a868855...`).
  - Bổ sung 13 atomic facts mới (đối chiếu exact character spans từ snapshot `fd7d1e18...`), 13 templates mới, 12 `questionRules` mới (lấp khoảng trống 13 ca `dev-A`: `D-A01/A02/A08/A09/A10/A11/A12/A13/A14/A15/A16/A20/H-A24`) và gắn 33 reviewed `QuestionPattern`s cho toàn bộ 31 `questionRules` (tổng **41 facts / 31 `questionRules` / 33 patterns / 41 templates**, gắn đủ `supportBindingIds` vào qualifier `academic-demo-only`, xác thực strict qua `CatalogData` + `VerifiedCatalog`).
  - Artifact mới (ignored): `.local/grounding/demo_synthetic/academic-policies-2026-11-25-v2/{catalog.json,sources.json}` (`catalog_sha256=cb05570dfd75bbc5d7abf78969140876dba185ceacfe2defb345319abc9a9f03`, `sources_sha256=53dc01c5cc0c086f27f2e910a7f9ff82913855648f0868c7eb3f1ca660a8b6f3`).
- **Cập nhật pin runtime & preflight**:
  - Cập nhật `AI_GROUNDING` trong [academic-demo.contract.json](../academic-demo.contract.json) và `.env` sang `academic-policies-2026-11-25-v2`; xác nhận `Settings().grounding == read_contract(...).environment.AI_GROUNDING`.
  - `python -B -m app.academic_demo_preflight --contract academic-demo.contract.json` → **`LOCAL_ARTIFACTS_VALID`** (`fact_count: 41`, `verified_chunk_hash_count: 38`, `complete_review_declaration_count: 38`, `catalog_sha256: cb05570d...`).
- **Tinh chỉnh `QuestionBinding` cho câu hỏi đơn có vế đồng quy thuộc cùng 1 rule ([questions.py](../app/orchestration/verification/questions.py))**:
  - Sửa `_SENTENCE_SPLIT_RE` (`\.(?!\d)\s+`) để tách đúng ranh giới câu sau số (`10h15. ...?`, `255.000. ...?`), và thêm `_clause_owned_by_pattern()` cho phép câu hỏi đơn liệt kê nhiều khía cạnh thuộc chính `pattern.allOf` (vd. *"Cọc khả dụng và cần bổ sung là bao nhiêu?"*) đồng thời vẫn fail-closed `compound_question_uncovered` nếu vế phối hợp chứa token chủ đề ngoài pattern (vd. *"Wi-Fi và chính sách hồ bơi là gì?"*). Bổ sung regression test tại [test_verification_questions.py](../tests/unit/test_verification_questions.py) (**24/24 pass**).
- **Nâng cấp BM25 bằng FTS5 adjacent bigrams ([hybrid.py](../app/retrieval/hybrid.py))**:
  - Tách `_bm25_expression(query)` kết hợp unigrams đã lọc stopwords với adjacent bigrams (`"t1 t2"`, tối đa 64 unigrams + 48 bigrams) mà không cần rebuild index SQLite/Qdrant; thêm test tại [test_academic_policies_and_reliability.py](../tests/unit/test_academic_policies_and_reliability.py).
  - Ghi nhận giới hạn lexical trung thực: trên `S05` (*"Chính sách hủy phòng trước check-in như thế nào?"*), nhánh BM25 thuần vẫn không đưa `POL-04-U01` vào top-5 do nguồn dùng cụm *"hủy trước nhận phòng"* thay vì *"hủy phòng trước check-in"* — xác nhận vai trò bắt buộc của nhánh vector trong hybrid retrieval.
- **Đánh giá offline trên `dev` với catalog runtime đang pin ([evaluate_question_binding.py](../tests/evaluation/evaluate_question_binding.py), schema v3, báo cáo `.local/assistant-evaluation/question-binding-dev-eval-v2-2026-11-25.json`)**:
  - `evaluation_catalog_mode="pinned_runtime_catalog"`, `runtime_catalog_version="academic-policies-2026-11-25-v2"`, `runtime_catalog_patterns_count=33` (so với v1 baseline `0`), `held_out_touched: false`:
  - **`dev-A` (19 ca)**: v1 baseline `0/19` → v2 pinned **`19/19` bound exact**, **`19/19` oracle gate ready**, **`19/19` BM25 `complete-evidence-set@3`** (tăng từ `16/19` trước bigrams), **`19/19` BM25 retrieved gate ready** (`VerificationGate.prepare` trả `needs_candidate=True` trên evidence thật top-3 từ `HybridRetriever.bm25()`).
  - **`dev-U` (10 ca)**: **`0/10` false-bound**; **`dev-O` (4 ca)**: **`0/4` false-bound**.
  - **`PARAPHRASE_SUITE` (19 ca)**: **`19/19` bound exact**, `19/19` oracle gate ready, **`14/19` BM25 retrieved gate ready** (tăng từ `13/19`; 5 ca còn lại lệch từ vựng, phụ thuộc nhánh vector hybrid).
  - **`ADVERSARIAL_SUITE` (12 ca)**: **`12/12` matched**, **`0/12` false-bound**.
- **Kiểm chứng tổng thể cuối cùng (offline + Docker)**:
  - `ruff check` + `ruff format --check` (100 file): **PASS**; `pip check`: **PASS**; `evaluate_grounding`: **`27/27` contract pass** (giữ G20 `semantic_acceptance: false`); `diagnose_generation --validate-only --trials 5`: **exit 0** (tự nhận `catalog_sha256` v2 `cb05570d...`).
  - `PBL6_QDRANT_DOCKER=1 pytest -q -p no:cacheprovider tests/unit tests/integration`: **`632 passed, 1 failed, 0 skipped, 1 warning`** (758,48s; ca lỗi duy nhất là timeout lịch 1 giây `asyncio.wait_for(backend.entered.wait(), 1)` ở `tests/integration/test_d1_collector_integration.py::test_user_cancellation_exports_failure_and_reraises_after_cleanup` khi CPU tải nặng); chạy lại riêng `tests/integration/test_d1_collector_integration.py` → **`30 passed, 0 failed`** (58,68s).
- **Bước tiếp theo (chờ xác nhận)**: chạy bước 4 — chẩn đoán A/B generation có giới hạn (10 lượt tổng = 5× `MinimalProposal` 336B xen kẽ 5× `CandidateDraft` 2.691B) bằng `python -X utf8 -B -m tests.evaluation.diagnose_generation --live --allow-live-api --trials 5 --output .local/assistant-evaluation/generation-ab-diagnostic-2026-11-25.json` để khoanh vùng nguyên nhân 503/deadline.


### 8. Chẩn đoán A/B generation live có giới hạn (`MinimalProposal` vs. `CandidateDraft`) — 2026-11-25

Thực hiện đúng Bước 4 theo xác nhận của người dùng (`--live --allow-live-api --trials 5`, tổng đúng **10 lượt** xen kẽ, giãn cách `2,0s`, **0 retry**, cố định 100% `query`, `FIXED_INPUT` 549 input tokens, `model=gemini-3.5-flash-lite`, `SHARED_DIAGNOSTIC_PROMPT`, budget `20000 ms`, pin catalog v2 `cb05570d...`). Báo cáo đầy đủ (ignored): `.local/assistant-evaluation/generation-ab-diagnostic-2026-11-25.json`. Không đổi code/config/model/retry và không cài thêm dependency/dịch vụ.

| Nhánh (arm) | Wire schema | Thành công (HTTP 200) | Upstream HTTP 503 | Client deadline | Lỗi schema/protocol | `elapsed` p50 / p95 | `wait_headers` p50 / p95 | Output tokens (HTTP 200) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `minimal` | `MinimalProposal` (336 B) | **4/5** (80%) | **1/5** (Trial 9: 939,4 ms) | **0/5** | **0/5** | **1.307,7 / 1.858,7 ms** | **1.072,1 / 1.677,6 ms** | 25–32 tokens |
| `candidate_v2` | `CandidateDraft` (2.691 B) | **2/5** (40%) | **3/5** (Trial 4: 15.408,7 ms; Trial 6: 18.196,8 ms; Trial 10: 1.710,7 ms) | **0/5** | **0/5** | **2.348,6 / 18.300,0 ms** | **2.253,7 / 18.196,8 ms** | 268–269 tokens |

- **Bằng chứng từng tầng HTTP (`http_timing`)**:
  - `countTokens`: **10/10 HTTP 200** (`wait_headers` 76,7–131,6 ms); TCP (`34,0–110,4 ms`), TLS (`43,0–80,2 ms`), `write_headers`/`write_body` (`< 2 ms`) hoàn toàn ổn định.
  - **0/10 lỗi schema/protocol** (`HTTP 400` hoặc lỗi validate Pydantic) và **0/10 client deadline** (mọi lỗi đều là upstream HTTP 503 ở `wait_headers`).
- **Kết luận khoanh vùng nguyên nhân**:
  1. **Nguyên nhân gốc là sự bất ổn HTTP 503 phía upstream `gemini-3.5-flash-lite`**, không phải lỗi cú pháp schema hay client network: ngay cả `MinimalProposal` siêu gọn **336 bytes** cũng gặp HTTP 503 (Trial 9), trong khi `CandidateDraft` trả JSON hợp lệ hoàn chỉnh ở Trial 2 (`2.308,8 ms`) và Trial 8 (`2.348,6 ms`).
  2. **Độ lớn schema + output tokens khuếch đại độ trễ đuôi và xác suất dính 503/deadline**: trên ca thành công, `candidate_v2` tốn ~2,2s `wait_headers` (268–269 output tokens) so với ~1,1s của `minimal` (25–32 output tokens); trên ca lỗi, 2/3 ca 503 của `candidate_v2` bị upstream treo `wait_headers` tới **15,41s** và **18,20s** trước khi trả 503 — sát ngưỡng budget 20s (giải thích trực tiếp hiện tượng vừa có 503 vừa có `DEADLINE_EXCEEDED` ở smoke v1/v2). Lưu ý cỡ mẫu nhỏ (`n=5`/nhánh), mang tính định hướng rõ chứ không quy đổi thành xác suất cố định.
- **Hướng xử lý đề xuất (chờ người dùng quyết định, chưa tự sửa runtime)**:
  - (A) Thử đối chiếu cùng phép đo A/B 10 lượt trên một model Gemini ổn định hơn (nếu người dùng duyệt đổi/thử model);
  - (B) Tối giản wire payload trả từ model (chỉ yêu cầu `decision` + danh sách `factIds`/`abstainReason` thay vì lặp cấu trúc provenance ~269 tokens mà host đã nắm trong `VerifiedCatalog`);
  - (C) Đánh giá chính sách retry có giới hạn cho 503 nhanh trong phạm vi budget 20s hiện có (không tăng deadline).
- **Đối chiếu model bước 1 (`gemini-2.5-flash-lite`, 10 lượt cùng harness, 2026-11-25)**:
  - Báo cáo (ignored): `.local/assistant-evaluation/generation-ab-diagnostic-2026-11-25-gemini-2.5-flash-lite.json`. Không đổi runtime/contract/`.env`.
  - Kết quả: **`0/5` `minimal`, `0/5` `candidate_v2` — toàn bộ `10/10` trả `HTTP 404`** ngay tại `POST /v1beta/models/gemini-2.5-flash-lite:countTokens` (`elapsed` p50 `171,5 ms` / `166,7 ms`, `wait_headers` `81,8–91,0 ms`; không lượt nào chạm tới `generateContent`).
  - Đối chiếu tài liệu Gemini API hiện hành: dòng 2.5 bị giới hạn truy cập API cho existing users (`gemini-2.5-flash` deprecated), còn các model Flash/Flash-Lite ổn định hiện hành gồm `gemini-3.5-flash-lite`, `gemini-3.6-flash` và `gemini-3.8-flash`. Chưa tự chạy model khác khi chưa có xác nhận.
- **Đối chiếu `models.list` + `countTokens` + A/B 10 lượt trên `gemini-3.6-flash` (2026-11-25)**:
  - Kiểm tra trước khi chạy batch: `GET /v1beta/models?pageSize=100` trả **HTTP 200** (65 models); cả `models/gemini-3.6-flash` lẫn `models/gemini-2.5-flash-lite` đều liệt kê `["generateContent","countTokens","createCachedContent","batchGenerateContent"]` (xác nhận lỗi 404 ở `2.5-flash-lite` xảy ra ở tầng thực thi endpoint dù tên vẫn có trong danh sách). Một probe `POST models/gemini-3.6-flash:countTokens` trả **HTTP 200** (`totalTokens: 2`).
  - Batch A/B 10 lượt trên `gemini-3.6-flash` (cùng input 549 tokens, prompt, hai schema, budget 20s, giãn cách 2s, 0 retry; không đổi runtime/contract/`.env`; báo cáo ignored `.local/assistant-evaluation/generation-ab-diagnostic-2026-11-25-gemini-3.6-flash.json`):
    - `countTokens`: **10/10 HTTP 200**. **Upstream HTTP 503: `0/10`** (`0/5` `minimal`, `0/5` `candidate_v2`); **lỗi schema/protocol: `0/10`**.
    - **`minimal` (336 B)**: **`3/5` HTTP 200**, **`2/5` `client_deadline_exceeded` (20s)** (Trial 1, 3), `elapsed` p50/p95 **`14.839,7 / 20.014,6 ms`**, `wait_headers` p50/p95 `14.655,5 / 19.912,3 ms`, `output_tokens` **238–324 tokens**.
    - **`candidate_v2` (2.691 B)**: **`4/5` HTTP 200**, **`1/5` `client_deadline_exceeded` (20s)** (Trial 4), `elapsed` p50/p95 **`12.414,4 / 20.010,6 ms`**, `wait_headers` p50/p95 `12.297,1 / 19.842,7 ms`, `output_tokens` **721–838 tokens**.
  - **Kết luận thận trọng từ hai batch đối chiếu (`n=10`/model)**:
    1. Trong batch 10 lượt này, `gemini-3.6-flash` ghi nhận **`0/10` HTTP 503** (so với `4/10` ở `3.5-flash-lite`) và `0/10` lỗi cú pháp schema; đây là bằng chứng quan sát của riêng batch này (chưa đủ cỡ mẫu để khẳng định dứt khoát nguyên nhân chỉ nằm ở riêng model/pool hay thời điểm).
    2. `gemini-3.6-flash` có mặc định thinking effort `medium` (sinh 238–324 output tokens ở `minimal` và 721–838 output tokens ở `candidate_v2`, kèm `3/10` deadline 20s). Mặc định thinking *có thể góp phần* làm tăng latency, nhưng khi chưa có phép đối chiếu trước/sau cấu hình `thinkingConfig` trên cùng model thì chưa quy toàn bộ deadline cho nó.
    3. Rút gọn schema đơn lẻ không bảo đảm hết 503 (`3.5-flash-lite` vẫn 1/5 503 trên `minimal`) và không tự triệt tiêu deadline ở `3.6-flash` mặc định (`2/5` deadline); giá trị chính của proposal gọn là giảm lượng output phải sinh và làm rõ trách nhiệm kiểm chứng phía host.


### 9. Bước 2 (3 lát offline): Wire proposal gọn, coverage `D-A13` (catalog v3) và máy tính giả định `D-A14` — 2026-11-25

Thực hiện tuần tự 3 lát riêng hoàn toàn offline (**không gọi Gemini API**, **không thêm `thinkingConfig`**, giữ nguyên nhánh `chore/sync-origin-main-d120`, HEAD `c031267`, `MERGE_HEAD=9d6b581`, 261 staged paths ngoài `ai-service/` và các release bất biến `v1`/`v2`). Không cài thêm dependency, model hay dịch vụ mới.

- **Lát 1 — Wire proposal gọn `FactSelectionProposal` (`d1-fact-selection-1`)**:
  - [verification.py](../app/schemas/verification.py): thêm `FactSelectionProposal` gồm `schemaVersion`, `decision`, `factIds` (tối đa 6, không trùng), `abstainReason` (phải `null` khi `propose_answer`), chặn duplicate JSON key ở `model_validate_json`. Kích thước wire schema qua `_gemini_schema()` dưới 600 bytes (so với 2.691 bytes của `CandidateDraft`).
  - [verified_faq.py](../app/prompts/verified_faq.py): giữ nguyên `VERSION="d1-verified-faq-1"` / `ANSWER` cho đường `claim_draft`; bổ sung `FACT_SELECTION_VERSION="d1-fact-selection-1"` / `ANSWER_FACT_SELECTION`.
  - [settings.py](../app/orchestration/verification/settings.py) & [runtime.py](../app/orchestration/verification/runtime.py): thêm `GroundingConfig.proposal_mode: Literal["claim_draft", "fact_selection"] = "claim_draft"` (bật tường minh `"proposal_mode": "fact_selection"` trong [academic-demo.contract.json](../academic-demo.contract.json) và `.env`), gửi `FactSelectionProposal` + `offeredFacts` gọn (không lặp `supportRefs`).
  - [gate.py](../app/orchestration/verification/gate.py): thêm `VerificationTurn._expand_selection()` kiểm tra chặt trước khi dựng `CandidateDraft` nội bộ: từ chối ID lạ/trùng/ngoài `offeredFacts` của đúng turn (`AI_PROTOCOL_ERROR`), từ chối fact ngoài `permittedFactKeys`, từ chối khi thiếu bất kỳ `requirement` nào (`missing_claim_coverage`, **không tự điền facts model bỏ thiếu**), kiểm lại approval/validity/evidence thực truy xuất/qualifiers/unit/timeScope rồi mới dựng claims và cho đi qua `verify()` + `render()`.
  - Regression riêng Lát 1 ([test_fact_selection_proposal.py](../tests/unit/test_fact_selection_proposal.py) + 6 suite gate/adapter/candidate/preflight/factory/runtime): **`97 passed, 0 failed`** (10,26s), bao gồm end-to-end `create_app()` + `HybridFaqIndex` + `MockTransport`.
- **Lát 2 — Coverage `D-A13` (phát hành catalog bất biến `academic-policies-2026-11-25-v3`)**:
  - [build_academic_catalog_v3.py](../tests/evaluation/build_academic_catalog_v3.py): kế thừa `v2` (giữ nguyên `v1` `5a868855...` và `v2` `cb05570d...` bất biến), thêm atomic fact `pol03-modify-increase-deadline-conditions-v1` (`unit=minute`, `value=15`, exact character span trong `POL-03-U04`) bao phủ hạn **15 phút (UTC+07:00)**, chấp nhận đúng phiên bản báo giá, trước hạn nghiêm ngặt và **không tạo giao dịch 0**; cập nhật rule `q-pol03-modify-increase-deposit` yêu cầu đủ cả 2 facts (`pol03.modify_increase_topup_rule` + `pol03.modify_increase_deadline_conditions`).
  - Artifact mới (ignored): `.local/grounding/demo_synthetic/academic-policies-2026-11-25-v3/{catalog.json,sources.json}` (**42 facts / 31 rules / 33 patterns / 42 templates**, `catalog_sha256=d4bc52d294cc34f5125f26374ece7fa2f2e766e6b0849d3e367bc701eb323499`). Pin cập nhật trong `academic-demo.contract.json` & `.env`.
  - Regression riêng Lát 2 ([test_d_a13_catalog_v3.py](../tests/unit/test_d_a13_catalog_v3.py) + `test_academic_demo_preflight.py`): **`8 passed, 0 failed`** (3,17s) — xác nhận bỏ thiếu fact 15 phút bị host abstain `missing_claim_coverage`, chọn đủ 2 facts phát đủ `15 phút`, `UTC+07:00`, `không tạo giao dịch 0`, citation `POL-03-U04` trên BM25 top-3 thật.
- **Lát 3 — Máy tính giả định quyết định phía host cho `D-A14`**:
  - [calculator.py](../app/orchestration/verification/calculator.py) & [gate.py](../app/orchestration/verification/gate.py): tính toán động bằng `Decimal` + `ROUND_HALF_UP` theo `POL-03-U02` (`A_bill = A_room + A_other`, `Cọc = HALF_UP[30% × max(G − A_room, 0)]`); kiểm tra đủ inputs, chặn số âm/thập phân/mâu thuẫn `A_bill` hoặc giảm giá chưa được chấp nhận → abstain fail-closed ở preflight trước khi gọi model; câu hỏi chính sách chung không có số giả định giữ nguyên đường trả lời policy thuần; **không chép cứng `492.000`** trong bất kỳ template tĩnh nào.
  - Regression riêng Lát 3 ([test_d_a14_host_calculator.py](../tests/unit/test_d_a14_host_calculator.py)): **`3 passed, 0 failed`** (1,01s) — xác nhận `492.000 VND` tính động cho `D-A14`, `555.000 VND` cho bộ số mới khác Gold, đúng `ROUND_HALF_UP` ở biên `.5`, clamp về `0 VND`, và abstain khi thiếu `A_room`/mâu thuẫn/chưa duyệt.
- **Kiểm chứng tổng thể sau cả 3 lát (offline + Docker)**:
  - `ruff check` + `ruff format --check` (**105 file**): **PASS**; `pip check`: **PASS**.
  - `academic_demo_preflight --contract academic-demo.contract.json` → **`LOCAL_ARTIFACTS_VALID`** (`fact_count: 42`, `catalog_sha256: d4bc52d2...`).
  - `evaluate_grounding`: **`27/27` contract pass** (giữ G20 `semantic_acceptance: false`).
  - `evaluate_question_binding` trên catalog runtime v3 đang pin (`.local/assistant-evaluation/question-binding-dev-eval-v3-2026-11-25.json`, `held_out_touched: false`): **`19/19` `dev-A` bound exact**, **`19/19` oracle gate ready**, **`19/19` BM25 `complete-evidence-set@3`**, **`19/19` BM25 retrieved gate ready**, `0/10` `dev-U`, `0/4` `dev-O`, `19/19` paraphrase (`14/19` BM25), `12/12` adversarial (`0` false-bound).
  - `PBL6_QDRANT_DOCKER=1 pytest -q -p no:cacheprovider tests/unit tests/integration`: **`642 passed, 0 failed, 0 skipped, 1 warning`** (97,45s).
- **Bước tiếp theo (chờ xác nhận)**: chạy live smoke 12 câu (kèm `D-A13` và `D-A14`) trên cấu hình runtime đã chốt (`gemini-3.5-flash-lite`, `proposal_mode="fact_selection"`, catalog v3 `d4bc52d2...`) để đo toàn luồng thực tế.


### 10. Live smoke v3 có giới hạn (12 câu qua `create_app()`, `FactSelectionProposal` + catalog v3) — 2026-11-25

Thực hiện đúng Bước 3 theo xác nhận của người dùng trên cấu hình runtime đã chốt (`gemini-3.5-flash-lite`, `proposal_mode="fact_selection"`, wire schema `FactSelectionProposal` **416 bytes**, prompt `CLASSIFY d1-faq-2` + `ANSWER_FACT_SELECTION d1-fact-selection-1`, catalog v3 `d4bc52d2...`, 42 facts, giãn cách 5,5s sau mỗi 503, **0 retry/ca**). Báo cáo đầy đủ (ignored): `.local/assistant-evaluation/academic-demo-live-smoke-2026-11-25-v3.json`. Không sửa code/config và không cài thêm dependency/dịch vụ.

- **Startup probe**:
  - Lần khởi tạo 1 dừng ở startup probe 5s (`countTokens` HTTP 200 `88,0 ms`, `generateContent` abort tại `wait_headers=4.792,1 ms`; 0/12 lượt được dispatch).
  - Lần khởi tạo 2: startup probe PASS (`1.098,2 ms`), `/ready=200` trước và sau batch (`ready_after_status=200`).
- **Kết quả tổng 12 câu (so với v1 `3/12` và v2 `4/12`)**:
  - **`matched = 6/12`**: **`3` `answered` đã xác minh**, **`2` `insufficient_evidence`**, **`1` `capability_unavailable`** (khớp kỳ vọng); `0/12` `DEADLINE_EXCEEDED`, `0/12` lỗi schema/protocol.
  - Latency: **`p50 = 1.573,97 ms`**, **`p95 = 17.684,78 ms`**; usage tính trên các ca trả final: `7.660 input / 426 output tokens`.
  - **Cải thiện đo được ở nhánh `answer/generateContent` với `FactSelectionProposal` (416 B)**:
    - Trong **4 ca vào tới `answer/generateContent`**, có **`3/4` thành công HTTP 200** với câu trả lời canonical + citation đã xác minh (so với `0/4` ở v1 và `1/7` ở v2):
      - `S01` (`POL-01-U02`, giữ chỗ 15 phút): **`answered`** trong **`4.221,1 ms`** (`answer/wait_headers=1.246,3 ms`, tổng 90 output tokens, citation `POL-01-U02`).
      - `S02` (`POL-02-U01`, giờ nhận/trả phòng): **`answered`** trong **`4.375,8 ms`** (`answer/wait_headers=1.514,4 ms`, tổng 84 output tokens, citation `POL-02-U01`).
      - `S05` (`POL-07-U01`, thú cưng): **`answered`** trong **`3.276,5 ms`** (`answer/wait_headers=1.086,9 ms`, tổng 93 output tokens, citation `POL-07-U01`).
      - Ca duy nhất lỗi ở `answer`: `S03` (`POL-03-U01`) gặp upstream HTTP 503 (`wait_headers=1.081,1 ms`).
    - So với ca `answered` duy nhất ở smoke v2 (`S04`: `9.656,9 ms`, `296 output tokens`), các ca `answered` v3 giảm còn **`3,28–4,38 giây` và `84–93 output tokens`**.
  - **Fail-closed live đạt 100% trên nhóm từ chối**: `S09` (thiếu nguồn → `insufficient_evidence`, `0` citations), `S10` (câu ghép thú cưng + hồ bơi → `insufficient_evidence` ở preflight trong `1.574,0 ms`, không gọi `answer`), `S11` (giá phòng live → `capability_unavailable` trong `1.112,6 ms`).
- **Ba giới hạn thực tế lộ ra ở live smoke v3**:
  1. **Lỗi upstream vẫn tập trung ở `classify/generateContent` (`3× HTTP 503` + `1× HTTP 429`) + 1× HTTP 503 ở `answer`**: `S04` (`503`), `S07` (`D-A14`, `503`), `S08` (`D-A20`, **`HTTP 429`** tại `252,1 ms`), `S12` (`503`) đều dừng ở `classify`, nên **`D-A14` và `D-A20` chưa chạm được tới retrieval/gate/calculator trong lượt live này**.
  2. **Định tuyến `CLASSIFY` (`d1-faq-2`) nhận nhầm `S06` (`D-A13`) thành `capability_unavailable`** (`1.135,1 ms`, `0` tool calls): câu hỏi có ví dụ số giả định (*"Theo ví dụ báo giá được duyệt R=2.550.000 VND, cọc khả dụng 510.000: cần nộp lại cả 765.000 không?"*) bị phân loại nhầm là tra cứu báo giá/đơn thật thay vì `faq` hỏi quy tắc chính sách giả định — cần bổ sung ranh giới ví dụ giả định trong `CLASSIFY` (`d1-faq-3`).
  3. **Độ trễ đuôi upstream ở `classify`**: `S09` tốn `16.706,5 ms` chỉ cho `classify/generateContent` (33 output tokens), đẩy `p95` toàn batch lên `17.684,8 ms`.
- **Trạng thái D1 giữ nguyên**: `ACCEPTED_WITH_LIMITATIONS` (chưa đóng R1 live reliability; chưa mở D2).


### 11. Tinh chỉnh `CLASSIFY` (`d1-faq-3`) & kiểm tra live tập trung 4 ca (`D-A13`, `D-A14`, `D-A20`, `S11`) — 2026-11-25

Thực hiện lựa chọn 1 theo xác nhận của người dùng (giữ nguyên nhánh `chore/sync-origin-main-d120`, HEAD `c031267`, `MERGE_HEAD=9d6b581`, 261 staged paths ngoài `ai-service/`, không đổi model/retry/thinkingConfig, không cài thêm dependency/dịch vụ).

- **Sửa prompt `CLASSIFY` ([faq.py](../app/prompts/faq.py), nâng `VERSION = "d1-faq-3"`)**: tách tường minh các câu hỏi ví dụ/giả định chính sách có số minh họa (`"giả sử"`, `"theo ví dụ"`, `"ví dụ báo giá"`, `"giá minh họa"`, `R/G/A_room/A_other/D_held`) thuộc `intent=faq`, đồng thời giữ chặt giá/tồn phòng live cho ngày thật, tra cứu/sửa booking hoặc hóa đơn cá nhân thật và thực hiện thanh toán/hoàn tiền thật là `intent=unavailable`.
- **Kiểm chứng offline trước khi chạy live**:
  - Thêm test hợp đồng prompt trong [test_academic_policies_and_reliability.py](../tests/unit/test_academic_policies_and_reliability.py) và cập nhật version mong đợi trong [test_generation_diagnostic.py](../tests/unit/test_generation_diagnostic.py).
  - `ruff check` + `ruff format --check` (3 file sửa): **PASS**; 8 suite regression trực tiếp liên quan (`test_academic_policies_and_reliability`, `test_generation_diagnostic`, `test_fact_selection_proposal`, `test_d_a13_catalog_v3`, `test_d_a14_host_calculator`, `test_academic_demo_preflight`, `test_faq_runtime`, `test_grounded_factory`): **`66 passed, 0 failed`** (11,11s).
- **Kiểm tra live tập trung 4 ca qua `create_app()`** (`gemini-3.5-flash-lite`, `proposal_mode="fact_selection"`, catalog v3 `d4bc52d2...`, `CLASSIFY d1-faq-3`, giãn cách `2,5s` giữa các ca và `5,5s` sau 503, **0 retry/ca**; báo cáo ignored `.local/assistant-evaluation/academic-demo-live-focused-2026-11-25.json`):
  - Startup probe: PASS (`1.070,9 ms`), `/ready=200` trước và sau batch (`ready_after_status=200`).
  - **`classify/generateContent`: `4/4` HTTP 200** (`836,7–936,7 ms`, **0 lỗi 429**), định tuyến đúng cả 4/4 ca (gồm `S11-CTRL` giá phòng live vẫn trả `capability_unavailable` trong `1.025,2 ms`).
  - **Kết quả tổng: `3/4 matched`**, **`0` deadline**, **`0` lỗi schema/protocol**:
    - **`D-A13` (multi-fact 15 phút + không giao dịch 0)**: **`answered`** trong **`3.347,4 ms`** (`answer/wait_headers=1.047,3 ms`, `148 output tokens`, citation `POL-03-U04`) — Gemini live chọn đúng đủ cả **2 `factIds`**, phát đầy đủ quy tắc cọc bổ sung + hạn **15 phút (`UTC+07:00`)** + **không tạo giao dịch 0**.
    - **`D-A20` (multi-fact Express Laundry 3kg)**: **`answered`** trong **`3.488,8 ms`** (`answer/wait_headers=1.228,4 ms`, `129 output tokens`, citation `POL-08-U03`) — Gemini live chọn đúng đủ cả **2 `factIds`** (tính theo package + giá minh họa 120.000 VND/package).
    - **`S11-CTRL` (đối chứng giá phòng live)**: **`capability_unavailable`** trong **`1.025,2 ms`** (`30 output tokens`, `0` tool calls).
    - **`D-A14` (host calculator 492.000 VND)**: vượt qua `classify` (`faq`, HTTP 200 `868,5 ms`), hybrid retrieval, `QuestionBinding`, preflight `calculator` và `answer/countTokens` (HTTP 200 `99,1 ms`), nhưng dừng ở `answer/generateContent` do upstream **HTTP 503** (`wait_headers=835,9 ms`) — nên đầu ra `492.000 VND` của `D-A14` mới có bằng chứng offline pass (`test_d_a14_host_calculator.py`), chưa hoàn tất end-to-end live trong lượt 0-retry này.


### 12. Đo đối chứng trước/sau `thinkingConfig` trên `gemini-3.6-flash` — 2026-11-25

Thực hiện theo xác nhận của người dùng (giữ nguyên runtime pin hiện tại `gemini-3.5-flash-lite` trong `academic-demo.contract.json` và `.env`, giữ nguyên nhánh `chore/sync-origin-main-d120`, HEAD `c031267`, `MERGE_HEAD=9d6b581`, 261 staged paths ngoài `ai-service/`, không cài thêm dependency/dịch vụ).

- **Cập nhật opt-in `thinking_level` ([gemini.py](../app/providers/gemini.py) & [diagnose_generation.py](../tests/evaluation/diagnose_generation.py))**:
  - Thêm tham số tùy chọn `thinking_level: str | None = None` vào `Gemini.__init__()` (chấp nhận `MINIMAL|LOW|MEDIUM|HIGH`, mặc định `None` không gửi `thinkingConfig` để bảo toàn 100% hành vi cũ; giá trị sai fail-closed `AI_NOT_CONFIGURED`). Khi bật, gửi `generationConfig.thinkingConfig = {"thinkingLevel": self.thinking_level}`.
  - Thêm cờ `--thinking-level` vào `diagnose_generation.py` và unit test tại [test_academic_policies_and_reliability.py](../tests/unit/test_academic_policies_and_reliability.py).
  - Kiểm chứng offline: `ruff check` + `ruff format --check` (3 file): **PASS**; 3 suite (`test_academic_policies_and_reliability`, `test_generation_diagnostic`, `test_http_timing_provider`): **`32 passed, 0 failed`** (4,61s); `diagnose_generation --validate-only --model gemini-3.6-flash --thinking-level minimal`: **exit 0**.
- **Probe đơn + Batch 10 lượt `gemini-3.6-flash` với `thinkingLevel="MINIMAL"`** (cùng input 549 tokens, cùng prompt, cùng hai schema `minimal` 336B / `candidate_v2` 2.691B, budget 20s, giãn cách 2s, 0 retry; báo cáo ignored `.local/assistant-evaluation/generation-ab-diagnostic-2026-11-25-gemini-3.6-flash-thinking-minimal.json`):
  - Probe đơn `Intent`: HTTP 200 trong **`1.406,9 ms`** (`countTokens` `98,3 ms` + `generateContent` `1.141,7 ms`, `65 output tokens`).
  - Đối chiếu trực tiếp trước/sau trên cùng model `gemini-3.6-flash`:

| Chỉ số | `gemini-3.6-flash` mặc định (`medium`) | `gemini-3.6-flash` + `thinkingLevel="MINIMAL"` |
| --- | --- | --- |
| Thành công (HTTP 200) | `7/10` (`3/5` minimal, `4/5` candidate_v2) | **`9/10`** (`4/5` minimal, **`5/5` candidate_v2**) |
| Upstream HTTP 503 | **`0/10`** | **`0/10`** (`0/20` tổng hai batch) |
| Client deadline (20s) | `3/10` (`2/5` minimal, `1/5` candidate_v2) | **`0/10`** (`0/5`, `0/5`) |
| Upstream HTTP 429 | `0/10` | **`1/10`** (Trial 7 minimal, `265,1 ms`) |
| Lỗi schema/protocol | `0/10` | **`0/10`** |
| `minimal` `elapsed` p50 / p95 | `14.839,7 / 20.014,6 ms` | **`1.178,9 / 1.378,5 ms`** |
| `minimal` output tokens (200) | `238–324 tokens` | **`22–32 tokens`** |
| `candidate_v2` `elapsed` p50 / p95 | `12.414,4 / 20.010,6 ms` | **`3.115,2 / 15.212,1 ms`** |
| `candidate_v2` output tokens (200) | `721–838 tokens` | **`269–278 tokens`** |

- **Kết luận đo được (kèm giới hạn)**:
  - Trên cùng model `gemini-3.6-flash` và cùng workload, đặt `thinkingLevel="MINIMAL"` cắt giảm rõ rệt output tokens (`238–324 → 22–32` ở `minimal`; `721–838 → 269–278` ở `candidate_v2`), kéo latency `minimal` từ **`p50 14,84s / p95 20,01s` → `p50 1,18s / p95 1,38s`**, và xóa `3/10` client deadline xuống **`0/10`** trong batch 10 lượt này.
  - Tổng hai batch trên `3.6-flash` ghi nhận **`0/20` HTTP 503**, nhưng batch mới xuất hiện **`1/10` HTTP 429** ở Trial 7 (giãn cách 2s) và `3.6-flash` có đơn giá cao hơn `3.5-flash-lite` — cần cân nhắc cả rate limit lẫn chi phí nếu chuyển cấu hình runtime. Chưa thay pin runtime cho đến khi người dùng quyết định.


### 13. Chuyển cấu hình Academic Demo sang `gemini-3.6-flash` + `GEMINI_THINKING_LEVEL=MINIMAL` & Live smoke v4 — 2026-11-25

Thực hiện theo xác nhận của người dùng (giữ nguyên nhánh `chore/sync-origin-main-d120`, HEAD `c031267`, `MERGE_HEAD=9d6b581`, 261 staged paths ngoài `ai-service/`, không cài thêm dependency/dịch vụ).

- **Cấu hình runtime & contract**:
  - [settings.py](../app/settings.py), [main.py](../app/main.py), [academic_demo_contract.py](../app/academic_demo_contract.py), [academic-demo.contract.json](../academic-demo.contract.json), [settings.example.env](../settings.example.env) và `.env`: thêm `GEMINI_THINKING_LEVEL` (chuẩn hóa `MINIMAL|LOW|MEDIUM|HIGH`, mặc định `None` giữ nguyên tương thích toàn bộ test cũ), chuyển profile Academic Demo sang **`GEMINI_MODEL=gemini-3.6-flash`** + **`GEMINI_THINKING_LEVEL=MINIMAL`** (đối chiếu 7/7 trường contract vs `Settings()` khớp `True`).
  - Kiểm chứng offline + Docker cuối cùng: `academic_demo_preflight` → **`LOCAL_ARTIFACTS_VALID`** (`fact_count: 42`, `catalog_sha256: d4bc52d2...`); `ruff check` + `ruff format --check` (**105 file**) **PASS**; `pip check` **PASS**; **`PBL6_QDRANT_DOCKER=1 pytest -q -p no:cacheprovider tests/unit tests/integration`** → **`644 passed, 0 failed, 0 skipped, 1 warning`** (94,14s).
- **Live smoke v4 (12 câu qua `create_app()`, giãn cách 3s, 0 retry/ca; báo cáo ignored `.local/assistant-evaluation/academic-demo-live-smoke-2026-11-25-v4.json`)**:
  - Startup probe: PASS (`908,5 ms`), `/ready=200`.
  - **Không có HTTP 503 (`0/12`) và không có deadline (`0/12`)**; xác minh thành công end-to-end lần đầu tiên trên **`S04` (`POL-04-U01` chính sách hủy phòng)**: **`answered`** trong **`3.454,6 ms`** (`classify` 200 `830,7 ms` → hybrid retrieval tìm đúng `POL-04-U01` → `answer` 200 `1.337,0 ms`, `125 output tokens`, citation `POL-04-U01`, đủ 3 bậc hủy).
  - **Giới hạn quota `HTTP 429` lộ rõ trên gói key hiện tại**: **`11/12` ca dừng vì `HTTP 429`** (`10` ca ở `classify`, `1` ca `S05` ở `answer` sau khi `S04` + `S05 classify` vừa dùng 3 calls liên tiếp), ngay sau batch chẩn đoán 10 lượt trên `gemini-3.6-flash` chạy trước đó 5 phút (phù hợp giới hạn RPM/RPD free-tier nghiêm ngặt của `gemini-3.6-flash`). Kết quả tổng v4: **`1/12 matched`**, `p50=444,7 ms`, `p95=3.454,6 ms`, `ready_after=503` (do latch 5s sau 429 ở `S12`).
- **Đánh đổi vận hành đã định lượng giữa hai model trên API key hiện tại**:
  - **`gemini-3.6-flash` + `MINIMAL`**: **`0/36` HTTP 503**, **`0` deadline**, tốc độ tốt (`1,18s` minimal / `3,45s` full turn kể cả `S04` `POL-04-U01`), **nhưng bị chặn chặt bởi `HTTP 429` RPM/RPD trên free-tier** nếu gọi nhiều lượt gần nhau.
  - **`gemini-3.5-flash-lite`**: hạn mức free-tier rộng hơn rõ rệt (chỉ 1× `429` trong toàn bộ các batch trước) và đạt `3,28–4,38s` khi dùng `FactSelectionProposal`, **nhưng có tỷ lệ `HTTP 503` upstream ngắt quãng**.
- **Trạng thái D1 giữ nguyên**: `ACCEPTED_WITH_LIMITATIONS` (chờ người dùng quyết định giữ `3.6-flash + MINIMAL` cho gói paid/giãn cách dài hay quay về `3.5-flash-lite` cho free-tier, trước khi rà soát commit hoặc sang D2).


### 14. Triển khai D2 — Read-only Business Tools (`search_rooms`, `list_services`) qua Spring Broker — 2026-11-25

Thực hiện trên nhánh mới `feat/ai-d2-business-tools` (tách từ `feat/ai-d1-academic-demo@90a17e2`, giữ nguyên 7 file ngoài phạm vi chưa commit; không cài thêm dependency/dịch vụ mới).

- **Quyết định thiết kế đã được người dùng phê duyệt**:
  - Phạm vi tool D2 giữ đúng 2 công cụ công khai chỉ đọc theo [API.md](API.md): `search_rooms` và `list_services`; câu hỏi tìm phòng/giá thiếu ngày nhận/trả hoặc số khách trả `needs_clarification` kèm `missingFields` (chưa mở `list_room_types`, giữ khóa D3 booking cá nhân).
  - Phase `resume` phía Python sử dụng **deterministic renderer** từ kết quả tool của Spring (0% nguy cơ model bịa giá/số đêm và tiết kiệm 1 lượt gọi Gemini/turn).
  - Đồng bộ cấu hình tỷ lệ cọc trong [RoomCatalogServiceImpl.java](../../BE/src/main/java/com/example/pbl6/service/RoomCatalogServiceImpl.java) sang `@Value("${hotel.bank.deposit-percentage:${hotel.deposit-percentage:30}}")` để khớp [BankConfig.java](../../BE/src/main/java/com/example/pbl6/config/BankConfig.java).
  - Action `open_services` chỉ được Spring phát cho principal có quyền `CUSTOMER` (FE map tới `/guest/services`), tránh dẫn khách ẩn danh vào `/services` vốn khóa cho `STAFF_ROLES` trong [App.jsx](../../FE/src/App.jsx).
- **Thành phần triển khai theo 4 lát cắt**:
  - **D2.1 (BE Broker)**: [AssistantToolBroker.java](../../BE/src/main/java/com/example/pbl6/service/assistant/AssistantToolBroker.java) & [AssistantToolBrokerTest.java](../../BE/src/test/java/com/example/pbl6/service/assistant/AssistantToolBrokerTest.java) — gọi trực tiếp `RoomCatalogService` / `CustomerBillingService` in-process, validate chặt schema/ngày/giá, chặn ép `null` → `0` (`DATA_UNAVAILABLE`), loại `roomNumber`/`floor`/`note`/`status`, sort xác định + `limit`/`hasMore` + `retrievedAt`.
  - **D2.2 (Python Runtime)**: [schemas.py](../app/tools/schemas.py), [tools.py](../app/prompts/tools.py), [continuations.py](../app/orchestration/continuations.py), [tools.py](../app/orchestration/tools.py), [faq.py](../app/orchestration/faq.py), [main.py](../app/main.py) & tests [test_d2_business_tools.py](../tests/unit/test_d2_business_tools.py), [test_d2_tools_runtime.py](../tests/integration/test_d2_tools_runtime.py) — giữ nguyên đường D1 `Intent` + Verification Gate khi chỉ có `search_knowledge`; thêm `TurnPlan`, `ContinuationStore` atomic single-use (`409 CONTINUATION_NOT_FOUND` khi replay/sai lệch/hết TTL), deterministic `render_resume` không làm bẩn `/ready` khi lỗi `DATA_UNAVAILABLE`/`DEPENDENCY_UNAVAILABLE` phía nghiệp vụ.
  - **D2.3 (BE Orchestrator & Client)**: [AssistantConfig.java](../../BE/src/main/java/com/example/pbl6/service/assistant/AssistantConfig.java), [AssistantClient.java](../../BE/src/main/java/com/example/pbl6/service/assistant/AssistantClient.java), [AssistantOrchestrator.java](../../BE/src/main/java/com/example/pbl6/service/assistant/AssistantOrchestrator.java), [AssistantController.java](../../BE/src/main/java/com/example/pbl6/controller/assistant/AssistantController.java), [application.properties](../../BE/src/main/resources/application.properties) & [AssistantOrchestratorTest.java](../../BE/src/test/java/com/example/pbl6/service/assistant/AssistantOrchestratorTest.java) — vòng lặp tối đa 2 broker batches / 4 tool calls / deadline 20s, trừ dần budget, lắp ráp `cards` độc quyền từ Turn Ledger, chặn model nhồi `cards`/action/tool lạ (`502 AI_PROTOCOL_ERROR`).
  - **D2.4 (FE Widget)**: [AssistantWidget.jsx](../../FE/src/components/assistant/AssistantWidget.jsx), [AssistantWidget.css](../../FE/src/components/assistant/AssistantWidget.css) & [AssistantWidget.test.jsx](../../FE/src/components/assistant/AssistantWidget.test.jsx) — render thẻ phòng/dịch vụ kèm disclaimer *"Giá phòng dự kiến · Chưa gồm VAT & dịch vụ"*, `retrievedAt`, link `/booking?roomId=...&checkIn=...&checkOut=...`, action allowlist, trạng thái `needs_clarification`/`no_results`, gợi ý nhanh cho `Phòng`/`Giá phòng`/`Dịch vụ`.
- **Bằng chứng kiểm chứng tự động (offline/mock, 2026-11-25)**:
  - **BE (Maven Surefire)**: `.\mvnw.cmd test "-Dtest=Assistant*Test"` → **`21 passed, 0 failed, 0 skipped`** (`AssistantControllerTest` 3, `AssistantClientTest` 2, `AssistantOrchestratorTest` 5, `AssistantSessionsTest` 3, `AssistantToolBrokerTest` 8).
  - **AI Service (Python)**: `ruff check app tests/unit tests/integration` + `ruff format --check app tests/unit tests/integration` (106 file) → **PASS**; `pytest -q -p no:cacheprovider tests/unit tests/integration` → **`648 passed, 0 failed, 7 skipped`** (7 test Qdrant Docker opt-in chưa bật cờ).
  - **FE (Vitest + Vite)**: `npm test` → **`10 passed, 0 failed`** (`AssistantWidget.test.jsx` 8, `api.test.js` 2); `npm run build` → **PASS**.
- **Giới hạn hiện tại của D2**:
  - Các đợt smoke E2E live đã xác minh xuyên suốt **React + Spring + MySQL thật (`hotel_management`) + FastAPI hybrid/Qdrant + Gemini thật** ở chế độ `demo_synthetic` (`academic-policies-2026-11-25-v3`); ghi nhận độ trễ upstream Gemini đôi lúc vượt ngân sách 20s (`2` ca `504 DEADLINE_EXCEEDED` ở lượt đầu của batch MySQL trước khi thử lại thành công); chưa ký nghiệm thu chính thức và chưa chạy batch tải/ổn định lớn.
  - Tool booking cá nhân (`list_my_bookings`, `get_my_booking`) vẫn đóng hoàn toàn, chờ audit ownership D3.
- **Bằng chứng smoke E2E live trên `local-h2` (React `:3000` → Spring `:9090` `local-h2` → FastAPI `:8006` hybrid + Qdrant → Gemini `gemini-3.6-flash` `MINIMAL`, 2026-11-25)**:
  - Phát hiện và vá ngay 1 lỗi thực tế khi chạy live: regex che số điện thoại trong `public_text()` ([faq.py](../app/orchestration/faq.py)) từng ẩn nhầm ngày ISO `YYYY-MM-DD` (ví dụ `2026-12-01`) thành `[contact]` trước khi gửi model; đã bổ sung negative lookahead bảo vệ `YYYY-MM-DD`/`DD-MM-YYYY` và unit test hồi quy tại [test_d2_business_tools.py](../tests/unit/test_d2_business_tools.py) (`26 passed`, `ruff check` + `ruff format --check` PASS).
  - Kết quả 4 kịch bản thực tế trên widget góc dưới bên phải tại `http://localhost:3000/` (không lỗi UI, 0 HTTP 503/429, hiện nhãn `Dữ liệu giả lập — chỉ dùng demo`):
    1. **Tìm phòng thiếu ngày** (`"Tôi muốn tìm phòng cho 2 khách, giá thế nào?"`): **PASS** — HTTP 200, `status="needs_clarification"`, `missingFields=["checkInDate","checkOutDate"]`, 0 cards, hiện action `Mở trang tìm & đặt phòng` → `/booking`.
    2. **Tìm phòng đủ ngày** (`"Tìm giúp tôi phòng trống cho 2 khách từ 2026-12-01 đến 2026-12-03"`): **PASS** — HTTP 200 (`start` `1.710 ms`, deterministic `resume` `0,123 ms`), `status="answered"`, trả **2 thẻ phòng từ Turn Ledger của Spring** (`Local Deluxe` 850.000 VND/đêm · dự kiến 1.700.000 VND · cọc 30% 510.000 VND; `Local Family Suite` 1.500.000 VND/đêm · dự kiến 3.000.000 VND · cọc 30% 900.000 VND), nhãn *"Giá phòng dự kiến · Chưa gồm VAT & dịch vụ"*, `Cập nhật: 2026-11-25 20:41:11 (GMT+7)`, link `Chọn phòng` → `/booking?roomId=1002&checkIn=2026-12-01&checkOut=2026-12-03` & `roomId=1003`, không lộ `LOCAL-101`/`roomNumber`/`floor`/`note`.
    3. **Tra cứu dịch vụ** (`"Khách sạn hiện có những dịch vụ nào và giá bao nhiêu?"`): **PASS** — HTTP 200, `status="answered"`, trả **3 thẻ dịch vụ đang hoạt động** (`Nước khoáng Lavie 500ml` 15.000 VND/Chai, `Bữa sáng Buffet` 120.000 VND/Suất, `Giặt ủi quần áo nhanh` 50.000 VND/Kg, có `Cập nhật`), không phát action `open_services` cho khách ẩn danh.
    4. **FAQ D1 không hồi quy** (`"Chính sách hủy đặt phòng hoàn cọc thế nào?"`): **PASS** — HTTP 200 (`5.182 ms`: classify `1.640 ms` + hybrid retrieval `738 ms` + answer `1.742 ms`), `status="answered"`, đủ 3 bậc hoàn cọc (`≥3 ngày 100%`, `1–2 ngày 50%`, `d≤0 0%`) và citation `Hủy đặt phòng — Academic Demo · POL-04-U01 · v0.1.1`. (Lưu ý bổ sung: câu gộp hai chủ đề `"Giờ nhận phòng và trả phòng..."` bị D1 verification gate từ chối fail-closed `insufficient_evidence` đúng theo thiết kế chống câu ghép.)
- **Bằng chứng smoke E2E live trên MySQL thật (`mysql-db` `26.7` `:3306`, schema `hotel_management`: 3 hạng phòng / 4 phòng / 3 dịch vụ hoạt động; Spring MySQL Connector/J `:9090` → FastAPI `:8006` → Gemini `gemini-3.6-flash` `MINIMAL`, 2026-11-25)**:
  - **Độ tin cậy upstream quan sát được**: 2 lượt gửi đầu gặp **`HTTP 504 DEADLINE_EXCEEDED`** do `classify/generateContent` `wait_headers` phía Gemini treo tới ngưỡng 20s (`19.440 ms` và `19.788 ms`); deadline không bật latch `/ready`, nên 4 lượt tiếp theo (gồm gửi lại Turn 1 & Turn 2) đều thành công **HTTP 200** với 0 HTTP 503/429.
  - **Kết quả 4 kịch bản + điều hướng `/booking` trên MySQL thật**:
    1. **Tìm phòng đủ ngày trên MySQL** (`"Tìm giúp tôi phòng trống cho 2 khách từ 2026-12-10 đến 2026-12-12"`): **PASS (ở lần gửi lại)** — `start 1.984 ms` + deterministic `resume 0,137 ms`, `status="answered"`, trả đúng thẻ MySQL `Phòng Deluxe Hướng Biển` (`850.000 VND/đêm`, dự kiến `1.700.000 VND`, cọc 30% `510.000 VND`, `Cập nhật: 2026-11-25 20:51:10 (GMT+7)`), link `Chọn phòng` → `/booking?roomId=3&checkIn=2026-12-10&checkOut=2026-12-12`, không lộ số phòng vật lý (`Phòng 201`) hay `note`.
    2. **Hết phòng / không khớp bộ lọc trên MySQL** (`"Tìm phòng trống cho 10 khách từ 2026-12-10 đến 2026-12-12"`): **PASS (ở lần gửi lại)** — `start 2.023 ms` + `resume 0,138 ms`, `status="no_results"`, `0` cards, thông báo trung thực không tự nới `guestCount`, kèm nút `/booking`.
    3. **Tra cứu dịch vụ trên MySQL** (`"Khách sạn có những dịch vụ nào và giá bao nhiêu?"`): **PASS** — `start 5.215 ms` + `resume 0,393 ms`, `status="answered"`, trả đúng **3 thẻ dịch vụ** từ bảng `service` (`Nước khoáng Lavie 500ml` 15.000 VND/Chai, `Bữa sáng Buffet` 120.000 VND/Suất, `Giặt ủi quần áo nhanh` 50.000 VND/Kg), không phát `/services` cho khách ẩn danh.
    4. **FAQ D1 + bấm nút `Chọn phòng` chuyển sang `/booking`**: **PASS** — FAQ hủy phòng `4.754 ms` trả đủ 3 bậc + citation `POL-04-U01 · v0.1.1`; bấm `Chọn phòng` điều hướng đúng tới `/booking?roomId=3&checkIn=2026-12-10&checkOut=2026-12-12`, form đặt phòng tự điền khớp 100% (`10/12/2026` – `12/12/2026`, `2 khách`, `Phòng 201 · Phòng Deluxe Hướng Biển`, `850.000 đ/đêm`, `2 đêm`, tổng phòng `1.700.000 đ`, cọc 30% `510.000 đ`).


### 15. Kiểm toán ownership (`R4`) và triển khai D3 — Personal Booking Tools (`list_my_bookings`, `get_my_booking`) — 2026-11-25

Thực hiện trên nhánh mới `feat/ai-d3-personal-bookings` (tách từ `feat/ai-d2-business-tools@8317d6d`, giữ nguyên 7 file ngoài phạm vi chưa commit; không cài thêm dependency/dịch vụ mới).

- **Các lỗ hổng ownership phát hiện & đã vá triệt để (D3.1)**:
  - [CustomerHistoryServiceImpl.java](../../BE/src/main/java/com/example/pbl6/service/CustomerHistoryServiceImpl.java): xóa bỏ fallback `return account.getAccountId()` (IDOR nghiêm trọng) và fallback `email`/`phone` chưa xác minh; ownership gắn duy nhất FK `Customer.account.accountId == account.accountId`; thống nhất ném `ResourceNotFoundException` cho cả đơn không tồn tại lẫn đơn của người khác (xóa existence oracle).
  - [CustomerBookingController.java](../../BE/src/main/java/com/example/pbl6/controller/CustomerBookingController.java): khóa `@PreAuthorize("hasRole('CUSTOMER')")`.
  - [AuthServiceImpl.java](../../BE/src/main/java/com/example/pbl6/service/AuthServiceImpl.java): khóa tự đăng ký công khai ở `ROLE_CUSTOMER` và luôn tạo bản ghi `Customer` mới gắn riêng với `Account` vừa đăng ký (chặn chiếm hồ sơ khách cũ qua email chưa xác minh).
  - [CustomerBookingServiceImpl.java](../../BE/src/main/java/com/example/pbl6/service/CustomerBookingServiceImpl.java) & [DataInitializer.java](../../BE/src/main/java/com/example/pbl6/config/DataInitializer.java): khi khách `ROLE_CUSTOMER` đặt phòng, gắn booking vào `Customer` theo FK `account_id`; bổ sung `ensureCustomerAccountLinks()` idempotent liên kết tài khoản demo `customer1` (`accountId=6 → customerId=1`).
- **Triển khai D3.2 – D3.4**:
  - **BE**: [AssistantConfig.java](../../BE/src/main/java/com/example/pbl6/service/assistant/AssistantConfig.java), [AssistantClient.java](../../BE/src/main/java/com/example/pbl6/service/assistant/AssistantClient.java) (thêm status `requires_login`), [AssistantToolBroker.java](../../BE/src/main/java/com/example/pbl6/service/assistant/AssistantToolBroker.java) (`list_my_bookings`, `get_my_booking` với `includeFinancials`, loại sạch PII/số phòng/QR/note, trả `NOT_FOUND` đồng nhất), [AssistantOrchestrator.java](../../BE/src/main/java/com/example/pbl6/service/assistant/AssistantOrchestrator.java) (chỉ cấp booking tools cho principal `ROLE_CUSTOMER`), [AssistantController.java](../../BE/src/main/java/com/example/pbl6/controller/assistant/AssistantController.java) & [AssistantD3BookingBrokerTest.java](../../BE/src/test/java/com/example/pbl6/service/assistant/AssistantD3BookingBrokerTest.java).
  - **AI Service**: [schemas.py](../app/tools/schemas.py), [tools.py (prompt)](../app/prompts/tools.py) (`d3-plan-1`), [tools.py (orchestration)](../app/orchestration/tools.py), [faq.py](../app/orchestration/faq.py) & [test_d3_booking_tools.py](../tests/integration/test_d3_booking_tools.py) — trả `requires_login` + `open_login` khi guest hỏi booking cá nhân (không xin SĐT/email), deterministic renderer cho `BookingList`/`BookingDetail` (0 lượt LLM thêm).
  - **FE**: [AssistantWidget.jsx](../../FE/src/components/assistant/AssistantWidget.jsx), [AssistantWidget.css](../../FE/src/components/assistant/AssistantWidget.css) & [AssistantWidget.test.jsx](../../FE/src/components/assistant/AssistantWidget.test.jsx) — bật gợi ý `Booking của tôi`, xử lý `requires_login`, render thẻ `booking` kèm nhãn trạng thái và nhóm tiền (khi có), không lưu vào `localStorage`/`sessionStorage`, xóa trắng khi đăng nhập/đăng xuất/đổi tài khoản.
- **Bằng chứng kiểm chứng tự động (offline/mock, 2026-11-25)**:
  - **BE (Maven Surefire)**: `.\mvnw.cmd test` → **`32 passed, 0 failed, 0 skipped`** (`CustomerHistoryServiceTest` 6, `AssistantD3BookingBrokerTest` 5, `AssistantToolBrokerTest` 8, `AssistantOrchestratorTest` 5, `AssistantControllerTest` 3, `AssistantSessionsTest` 3, `AssistantClientTest` 2).
  - **AI Service (Python)**: `ruff check app tests/unit tests/integration` & `ruff format --check app tests/unit tests/integration` (**107 file**) → **PASS**; targeted D1/D2/D3 suite → **`55 passed, 0 failed`**.
  - **FE (Vitest + oxlint)**: `oxlint` **0 warnings, 0 errors**; `npm test` → **`11 passed, 0 failed`** (`AssistantWidget.test.jsx` 9, `api.test.js` 2).
- **Bằng chứng smoke E2E live trên MySQL thật (`hotel_management`, Spring `:9090` → FastAPI `:8006` override phiên bằng `gemini-2.5-flash` do `gemini-3.6-flash` hết RPD Free Tier trong ngày → React `:3000`, 2026-11-25)**:
  - **Scenario 1 (Guest ẩn danh bấm `Booking của tôi`)**: **PASS** — HTTP 200 (`1.911 ms`), `status="requires_login"`, 0 cards, hiện nút `Đăng nhập tài khoản` → `/login`, không yêu cầu nhập SĐT/email.
  - **Scenario 2 (`customer1` / `123456`, FK `accountId=6 → customerId=1`)**:
    - Sau đăng nhập, lịch sử khách cũ được xóa sạch (`0` tin cũ).
    - `list_my_bookings` (`"Xem danh sách đơn đặt phòng của tôi"`): **PASS** — HTTP 200 (`start 1.722 ms` + `resume 0,055 ms`), `status="answered"`, trả đúng **1 thẻ booking** `BK-CUSTOMER1-DEMO` (`Đang lưu trú`, `Phòng Standard`, `2026-11-10 → 2026-11-13 · 3 đêm · 2 khách`, `Cập nhật: 2026-11-25 21:13:16 (GMT+7)`), không lộ `roomNumber`/SĐT/email/note.
    - `get_my_booking` kèm tài chính (`"Đơn BK-CUSTOMER1-DEMO tổng tiền và còn phải trả bao nhiêu?"`): **PASS** — HTTP 200 (`start 1.912 ms` + `resume 0,113 ms`), `status="answered"`, trả thẻ booking kèm `Tổng: 1.650.000 VND · Đã cọc: 0 VND · Còn lại: 1.650.000 VND`, không lộ PII/số phòng.
    - Mã lạ/không thuộc tài khoản (`"Kiểm tra giúp tôi đơn BK-KHONG-TON-TAI-999"`): **PASS** — HTTP 200 (`start 1.867 ms` + `resume 0,035 ms`), `status="no_results"`, `0` cards.
  - **Scenario 3 (Đăng xuất)**: **PASS** — Bấm `Đăng xuất` → toast `"Bạn đã đăng xuất."`, mở lại widget thấy `0` tin nhắn riêng (xóa sạch `BK-CUSTOMER1-DEMO`), kiểm tra tĩnh `AssistantWidget.jsx` xác nhận không dùng `localStorage`/`sessionStorage`.


### 16. Triển khai D4 — Câu hỏi kết hợp Booking + Policy, bộ đánh giá 80 ca và Runbook vận hành — 2026-11-25

Thực hiện trên nhánh mới `feat/ai-d4-combined-and-eval` (tách từ `main@16e6a68`, giữ nguyên 7 file ngoài phạm vi chưa commit; không cài thêm dependency/dịch vụ mới).

- **Orchestration kết hợp Booking + Policy (`abcef05`)**:
  - [schemas.py](../app/tools/schemas.py) & [tools.py (prompt)](../app/prompts/tools.py) (`d4-plan-1`): bổ sung `intent="booking_with_policy"`, trường `policyQuery` và hàm `validate_booking_with_policy_plan` chọn `get_my_booking` (khi có mã đơn hợp lệ) hoặc `list_my_bookings` (khi hỏi chung về *"đơn của tôi"*).
  - [continuations.py](../app/orchestration/continuations.py): thêm `CombinedPolicyContext` bất biến gắn phía host vào `ContinuationEntry` (`original_message`, `policy_query`, `today`, `allowed_tools`), tiêu thụ nguyên tử một lần (replay trả `409 CONTINUATION_NOT_FOUND`).
  - [tools.py (orchestration)](../app/orchestration/tools.py) & [faq.py](../app/orchestration/faq.py):
    - Khách ẩn danh/không có quyền `CUSTOMER` bị chặn ngay tại `start` (`requires_login` + `open_login`, 0 lượt retrieval).
    - Yêu cầu đủ budget tối thiểu `min_tool_calls=2` (1 booking tool + 1 `search_knowledge`).
    - Tại `resume`, nếu booking trả lỗi (`NOT_FOUND`, `AUTH_REQUIRED`...) hoặc `BookingList` rỗng thì dừng ngay (`no_results`, 0 lượt retrieval/LLM — chống existence oracle).
    - Khi booking hợp lệ từ Spring, chạy `search_knowledge` + Phase 3 `verified_faq_answer` trên `public_text(original_message)` theo ngày tin cậy `today` từ Spring; ghép tất định thông tin booking + chính sách đã duyệt + cảnh báo *"không tự tính khoản hoàn tiền hoặc phí phát sinh cuối cùng"*, kiểm tra giới hạn 4000 UTF-16 code units, và từ chối fail-closed sang `insufficient_evidence` nếu phần chính sách không qua gate.
  - [test_d4_combined_booking_policy.py](../tests/integration/test_d4_combined_booking_policy.py) & [AssistantOrchestratorTest.java](../../BE/src/test/java/com/example/pbl6/service/assistant/AssistantOrchestratorTest.java): bổ sung kiểm thử tích hợp end-to-end trên cả Python lẫn Spring (Turn Ledger `booking` card + verified `citations`/`evidence`, chặn citation giả `502 AI_PROTOCOL_ERROR`, guest `requires_login`, đơn lạ `no_results`, policy ngoài corpus `insufficient_evidence`, replay `409`, vượt budget `503`).
- **Bộ đánh giá D1–D4 80 ca và runner (`4a58fa4`)**:
  - [d4_suite.json](../tests/evaluation/d4_suite.json): **80 ca synthetic** theo đúng cấu trúc [EVALUATION.md](EVALUATION.md) — 6 nhóm lõi × 10 = **60 ca** (`faq`, `rooms`, `pricing`, `services`, `personal_bookings`, `policies`) + **20 ca bổ sung** (`combined_booking_policy` 8, `unanswerable_and_out_of_scope` 6, `security_and_faults` 6), tách `dev` (47) / `held_out` (33) theo `paraphraseGroup` với `0` rò rỉ paraphrase.
  - [run_d4_eval.py](../tests/evaluation/run_d4_eval.py) & [test_d4_evaluation_suite.py](../tests/unit/test_d4_evaluation_suite.py): chạy đủ 80 ca xuyên FastAPI `/internal/assistant/turn` + `Faq` + `VerificationGate` + `ContinuationStore` (harness offline synthetic provider, lưu báo cáo cục bộ ignored tại `.local/assistant-evaluation/d4-offline-eval-2026-11-25.json`):
    - **Kết quả offline**: **`80/80 passed`** (`dev=47/47`, `held_out=33/33`; 9/9 nhóm đạt 100%; `p50=11,08 ms`, `p95=21,14 ms` — đo trên harness offline, không đại diện độ trễ mạng Gemini thật).
- **Toàn bộ regression tự động sau D4 (2026-11-25)**:
  - **AI Service (Python + Docker Qdrant)**: `ruff check` + `ruff format --check` (**111 file**) → **PASS**; `PBL6_QDRANT_DOCKER=1 pytest -q -p no:cacheprovider tests/unit tests/integration` → **`668 passed, 0 failed, 0 skipped, 1 warning`** (166,95s).
  - **BE (Maven Surefire)**: `.\mvnw.cmd test` → **`35 passed, 0 failed, 0 skipped` (`BUILD SUCCESS`)**.
  - **FE (Vitest + oxlint)**: `npx oxlint` (**0 warnings, 0 errors**); `npm test` → **`12 passed, 0 failed`**.
- **Bằng chứng smoke E2E live D4 trên MySQL thật (`hotel_management`, Spring `:9090` → FastAPI `:8006` + Qdrant Docker `:6333` + Gemini `gemini-2.5-flash` override phiên do `3.6-flash` hết RPD trong ngày, 2026-11-25)**:
  - **D4-LIVE-1 (Guest hỏi kết hợp hủy đơn `BK-CUSTOMER1-DEMO` + hoàn cọc)**: **PASS** — HTTP 200 (`2.970,8 ms`), `status="requires_login"`, `actions=["open_login"]`, `cards=[]`, `citations=[]`.
  - **D4-LIVE-2C (`customer1` hỏi kết hợp `list_my_bookings` + thú cưng: *"Đơn đặt phòng của tôi có được mang thú cưng không?"*)**: **PASS** — HTTP 200 (`6.282,2 ms`), `status="answered"`, trả **1 thẻ booking MySQL** (`BK-CUSTOMER1-DEMO`) + **1 citation đã duyệt** (`POL-07-U01 · v0.1.0`) + cảnh báo không tự tính hoàn tiền/phí.
  - **D4-LIVE-2D (`customer1` hỏi kết hợp `get_my_booking` + hủy phòng: *"Đơn BK-CUSTOMER1-DEMO của tôi áp dụng chính sách hủy đặt phòng như thế nào?"*)**: **PASS** — HTTP 200 (`8.224,1 ms`), `status="answered"`, trả **1 thẻ booking MySQL** (`BK-CUSTOMER1-DEMO`, tổng `1.650.000 VND`, còn lại `1.650.000 VND`) + **1 citation đã duyệt** (`POL-04-U01 · v0.1.1`, đủ bậc hoàn cọc) + cảnh báo không tự tính hoàn tiền; 0 lộ mã nội bộ (`room_charge_estimate`, `CHECKED_IN`).
  - **D4-LIVE-3 (`customer1` hỏi kết hợp đơn lạ `BK-FOREIGN-999`)**: **PASS** — HTTP 200 (`2.386,6 ms`), `status="no_results"`, `cards=[]`, `citations=[]`, `resume` chạy `0,14 ms` (không gọi retrieval/LLM cho đơn ngoài sở hữu).
  - **D4-LIVE-4 (`customer1` hỏi kết hợp chính sách ngoài corpus — vé máy bay khứ hồi)**: **PASS** — HTTP 200 (`4.171,3 ms`), `status="insufficient_evidence"`, trả thẻ booking đã xác thực (`BK-CUSTOMER1-DEMO`), `citations=[]`, từ chối fail-closed rõ ràng phần chính sách chưa có nguồn.
  - **Giới hạn & lỗi quan sát được trong batch live**:
    - `D4-LIVE-2` (diễn đạt *"nếu hủy phòng áp dụng chính sách hoàn cọc thế nào?"*): retrieval/preflight từ chối fail-closed `insufficient_evidence` (do tập top-3 hoặc điều kiện phủ của rule chưa đủ trên diễn đạt này — hành vi an toàn fail-closed, không bịa chính sách).
    - `D4-LIVE-2B` (*"trả phòng muộn lúc 15h"* trên `gemini-2.5-flash` bật thinking mặc định): `answer/generateContent` dùng hết `12,77s` và bị cắt JSON → `502 AI_PROTOCOL_ERROR` (`error_category="response_schema"`), không phát nội dung chưa kiểm chứng và không làm bẩn `/ready`. Ghi nhận khuyến nghị dùng model có cấu hình `GEMINI_THINKING_LEVEL=MINIMAL` (hoặc paid tier) khi chạy ổn định dài hạn.
- **Cập nhật Runbook**: bổ sung mục vận hành D1–D4 (cờ bật/tắt, thứ tự khởi chạy, lệnh kiểm chứng và xử lý sự cố) trong [README.md](../README.md).


### 17. Ưu tiên 2 — Giảm false-abstention ở `QuestionBinding` (catalog `v5`) & Bounded Transient Retry opt-in cho Gemini — 2026-11-26

Thực hiện trên nhánh riêng `feat/ai-priority2-binding-and-resilience` (tách từ `docs/sync-d1-d4-and-cleanup`, không cài thêm dependency/model/dịch vụ mới, giữ nguyên các thay đổi chưa commit ngoài phạm vi và giữ bất biến các catalog `v1`–`v4`).

- **1. Sửa false-abstention từ khung câu hỏi trong `QuestionBinding` ([questions.py](../app/orchestration/verification/questions.py))**:
  - Mở rộng `_QUESTION_FRAME_STOP` bằng đúng các từ khung câu hỏi/quy chiếu khách sạn tiếng Việt an toàn (`khach`, `san`, `azure`, `bay`, `ben`, `minh`, `toi`, `tieu`, `chuan`...; tuyệt đối không thêm danh từ chủ đề ngoài miền như `wifi`/`ho`/`boi`/`bai`/`xe`/`thu`/`cung`).
  - Khắc phục lỗi câu hỏi phối hợp cùng chủ đề (ví dụ *"Giờ nhận phòng và trả phòng của khách sạn là mấy giờ?"*) bị từ chối nhầm `compound_question_uncovered`, trong khi mọi câu ghép 2 chủ đề khác nhau vẫn fail-closed 100%.
- **2. Phát hành catalog bất biến `academic-policies-2026-11-26-v5` ([build_academic_catalog_v5.py](../tests/evaluation/build_academic_catalog_v5.py))**:
  - Kế thừa đủ **42 facts / 31 `questionRules` / 33 `QuestionPattern`s / 42 templates** từ `v4`, mở rộng cụm diễn đạt tự nhiên cho 5 rule tần suất cao (`p-pol02-standard-hours`, `p-pol02-early-checkin`, `p-pol02-late-checkout`, `p-pol03-deposit-rate`, `p-pol04-cancellation`) và giữ chặt `noneOf`.
  - Artifact mới (ignored): `.local/grounding/demo_synthetic/academic-policies-2026-11-26-v5/{catalog.json,sources.json}` (`catalog_sha256=3eaf05ef...`, `sources_sha256=7c96a715...`), đã pin trong [academic-demo.contract.json](../academic-demo.contract.json).
- **3. Cơ chế Bounded Transient Retry opt-in cho Gemini ([gemini.py](../app/providers/gemini.py), [settings.py](../app/settings.py), [main.py](../app/main.py), [academic_demo_contract.py](../app/academic_demo_contract.py))**:
  - Thêm `GEMINI_TRANSIENT_RETRIES` (mặc định `0` giữ nguyên 100% hành vi no-retry cũ; hợp lệ `0..2`, bật `1` trong profile Academic Demo) và `GEMINI_RETRY_BACKOFF_MS` (mặc định `400`, hợp lệ `0..5000`).
  - Chỉ retry có giới hạn cho `HTTP 503` và `HTTP 429` (tôn trọng header `Retry-After` trong giới hạn backoff tối đa 5s và yêu cầu còn tối thiểu `1.0s` sau khi ngủ trong `TurnBudget` 20s; fail-fast nếu không đủ budget).
  - Tuyệt đối không retry `400/401/403/404`, `AI_PROTOCOL_ERROR`, `BUDGET_EXCEEDED`, `DEADLINE_EXCEEDED`, hoặc `CancelledError`; retry thành công không kích hoạt `/ready` dependency latch.
- **Bằng chứng kiểm chứng offline (2026-11-26)**:
  - `ruff check` & `ruff format --check`: **PASS** (0 lỗi).
  - `academic_demo_preflight --contract academic-demo.contract.json` → **`LOCAL_ARTIFACTS_VALID`** (`42` facts, `38/38` chunk hashes & review declarations).
  - `evaluate_question_binding.py` trên catalog `v5` (`held_out_touched: false`): **`19/19` `dev-A` exact + BM25 gate ready**, **`0/10` `dev-U`**, **`0/4` `dev-O`**, **`19/19` paraphrase**, **`12/12` adversarial (`0` false-bound)**.
  - `evaluate_grounding.py`: **`27/27` contract pass** (giữ G20 `semantic_acceptance: false`).
  - `run_d4_eval.py`: **`80/80` passed** (`dev=47/47`, `held_out=33/33`, 9/9 nhóm 100%).
  - Regression suite 11 file (`test_priority2_binding_and_resilience.py` + 10 suite liên quan): **`114 passed, 0 failed, 1 warning`**.
- **Giới hạn**: Chưa chạy lại live Gemini trong lượt này; cơ chế retry giảm rủi ro 503/429 nhất thời nhưng không thay thế quota paid-tier khi gọi batch dài hạn hoặc corpus production thật (R1/R3 vẫn mở).
