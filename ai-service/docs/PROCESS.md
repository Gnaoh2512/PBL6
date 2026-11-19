# Process và tiến độ trợ lý khách sạn

Cập nhật: **2026-11-19**, Asia/Ho_Chi_Minh. Đối chiếu code tại baseline `e1ec7c8`, tài liệu và artifact local có sẵn; lượt này chỉ chỉnh tài liệu, không chạy lại runtime hoặc Gemini.

Đây là nơi duy nhất cập nhật checklist, trạng thái và bước tiếp theo, thay cho hai file lộ trình/trạng thái trước đây. Thiết kế và luồng chạy nằm ở [architecture.md](architecture.md); hợp đồng ở [API.md](API.md).

## Cách đọc checklist

- `[x]`: có implementation/bằng chứng phù hợp với đúng nội dung của mục.
- `[ ]`: chưa triển khai hoặc chưa đủ bằng chứng nghiệm thu. Có code không đồng nghĩa đã nghiệm thu chất lượng model.
- Số test dưới đây là **kết quả lịch sử ngày 13–14/11/2026**, không phải kết quả chạy mới ngày cập nhật tài liệu.

## Kết luận hiện tại

**D0 xong; implementation FAQ D1 đã có; nghiệm thu D1 còn mở; D2–D4 chưa triển khai.** Kiến trúc hiện tại là RAG có luồng cố định: React → Spring → FastAPI → Gemini + SQLite FTS5/BM25. Chưa có embedding, vector database, business tool broker hoặc agent loop.

FAQ có nguồn đã chạy xuyên browser/Spring/Python bằng Gemini thật. Batch live gần nhất hoàn tất đúng trạng thái **18/24 ca**, còn **6 deadline**, nên chưa chứng minh độ ổn định. Corpus production vẫn là bản nháp chưa được duyệt. Các gợi ý phòng/giá/dịch vụ/booking trên widget chưa tương ứng với tool đã hoạt động.

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
- [x] FAQ orchestration: classify → một retrieval → answer khi có evidence; trả `insufficient_evidence`/`capability_unavailable` rõ ràng, kiểm tra citation ID thuộc evidence: [faq.py](../app/orchestration/faq.py).
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

Nguồn lịch sử: foundation/provider/ingestion/FAQ/widget và kiểm chứng đã được ghi trong các commit trước baseline; kết quả D1.10.1 tại `e1ec7c8`, merge tại `d836c90`, điều tra test tại `7f333f2`. Hai báo cáo test đã được gộp vào file này; bản đầy đủ vẫn có trong Git của các commit đó.

Chi tiết D1.9 và bảng từng ca: [D1.9_LIVE_DIAGNOSTIC.md](D1.9_LIVE_DIAGNOSTIC.md). Artifact ignored đã đọc trực tiếp: `ai-service/.local/assistant-evaluation/d1.9/20261114T121542_50bf6c59/summary.json`, xác nhận 24 attempted, 18 final/matched, 6 `DEADLINE_EXCEEDED`, 37 countTokens + 37 generateContent. Artifact này không lưu câu trả lời để chấm grounding.

Trong batch D1.9, 5 timeout ở classify/generateContent, 1 ở answer/generateContent; diagnostics ghi application deadline, không ghi HTTPX timeout. Chưa tách được thời gian network/provider. p50/p95 nearest-rank của **toàn bộ 24 ca**: 7205,71/20015,33 ms; riêng 18 final: 4317,47/19412,23 ms. Usage 12562 input/1635 output chỉ của final; tổng chi phí chưa đo.

### Điều kiện còn thiếu để đóng D1

- [x] Chứng minh một FAQ có nguồn chạy end-to-end bằng Gemini thật.
- [x] Có kiểm thử offline cho schema/auth, thiếu nguồn, lỗi dependency, cancellation và cô lập phiên.
- [ ] Khắc phục/đánh giá độ ổn định live; 25% deadline ở batch mới nhất vẫn là blocker.
- [ ] Có bằng chứng chấm claim grounding, citation identity/support/coverage và abstention cho từng final của batch.
- [ ] Chốt tiêu chí chất lượng/latency nghiệm thu; không tự coi HTTP 200 hoặc status đúng là nội dung đúng.
- [ ] Corpus thật được người phụ trách duyệt, có version/hiệu lực, trước khi phục vụ production. Đây là điều kiện phát hành production riêng với demo synthetic.

[Audit grounding có sẵn](D1.11_GROUNDING_CITATION_AUDIT.md) chỉ đối chiếu được nội dung hai câu FAQ baseline với fixture; thiếu provenance của evidence từng lượt. D1.9 không lưu answer/citation/evidence/query nên **18 final chưa đủ dữ liệu chấm nội dung**, sáu ca lỗi không có final. Không có bằng chứng mới để tick nghiệm thu grounding. File audit đang có lỗi ký tự tiếng Việt trong bản nháp; giữ nguyên vì chứa rubric/gap ledger riêng.

### Giới hạn vận hành

- Assistant mặc định disabled/opt-in; demo synthetic chỉ được Spring chấp nhận ở profile local, UI hiện nhãn; production không nhận snapshot demo và không tự fallback sang fake.
- Startup cần token nội bộ, key, index hợp lệ và probe thật tối đa 5 giây. Dependency failure loại `DEPENDENCY_UNAVAILABLE` trong turn giữ service not-ready đến restart; deadline đơn thuần không bật latch này.
- Phiên Spring in-memory, chưa hỗ trợ nhiều instance/Redis; reset chat không thu hồi JWT toàn hệ thống.
- Lexical retrieval hạn chế paraphrase. Citation ID hợp lệ chưa chứng minh từng claim được nguồn hỗ trợ.
- Validate index đầu turn ở trước budget; I/O SQLite/checksum còn đồng bộ. Chưa có bằng chứng đây là nguyên nhân timeout Gemini.
- Chưa kiểm tra bàn phím mềm trên thiết bị mobile thật, tổng chi phí hoặc benchmark production.

## D2 — Phòng, giá và dịch vụ: chưa triển khai

- [ ] Nối `search_rooms`/`list_services` với service thật của Spring; hỏi đủ ngày/số khách/bộ lọc trước query.
- [ ] Trả giá/currency/đơn vị từ backend, kiểm tra khả năng báo giá trước khi thêm `get_room_quote`.
- [ ] Hiển thị thẻ từ DTO cấu trúc và link nghiệp vụ hợp lệ.
- [ ] Kiểm tra ngày sai, hết phòng, giá đổi, dịch vụ dừng, tool ngoài allowlist và backend timeout.
- [ ] Nếu cần, đánh giá ranker ưu tiên mềm sau lọc điều kiện cứng; đây là tùy chọn, không là điều kiện để FAQ chạy.

## D3 — Booking cá nhân: chưa triển khai

- [ ] Rà/sửa quan hệ account/customer và fallback email/SĐT trong `CustomerHistoryServiceImpl` trước mở tool.
- [ ] Spring kiểm tra principal/ownership trước khi tạo DTO tối thiểu; không gửi JWT/PII thừa vào Python/model.
- [ ] Ràng buộc tool call/result/continuation với phiên/account, TTL và cancellation.
- [ ] Kiểm tra A không đọc booking B dù biết mã; guest/JWT hỏng bị chặn; logout/đổi account không tái dùng dữ liệu cũ.
- [ ] Xác định trường dữ liệu và chính sách lưu giữ trước khi dùng booking thật; không index hoặc cache dùng chung dữ liệu cá nhân.

## D4 — Câu hỏi kết hợp và nghiệm thu mở rộng: chưa triển khai

- [ ] Ghép booking đã cấp quyền với policy đúng phiên bản/hiệu lực; không tự tính hoàn tiền.
- [ ] Hiện thực tool broker/continuation với allowlist, call ID, số vòng, deadline và budget có giới hạn.
- [ ] Mở rộng dataset theo [EVALUATION.md](EVALUATION.md); kế hoạch 60 câu sáu nhóm và ít nhất 20 ca bổ sung chưa phải dataset đã có.
- [ ] Đánh giá retrieval/grounding/tool/quyền/hiệu năng/chi phí và hoàn thiện runbook theo implementation.

## Quy trình cho bước tiếp theo

1. Đọc file này và kiến trúc; kiểm tra Git và AGENTS theo phạm vi. Chỉ triển khai lát được giao, giữ thay đổi ngoài nhiệm vụ.
2. Ưu tiên đóng khoảng trống D1: xác định mục tiêu điều tra live bằng timing mới và thiết kế artifact synthetic đủ provenance để chấm nội dung. Lượt rà tài liệu này không chạy thêm batch hoặc đổi model/prompt/deadline/retry.
3. Kiểm chứng đúng tầng: offline cho logic/boundary, live cho provider, review evidence cho grounding. Ghi command, ngày, commit, dataset/snapshot và hạn chế.
4. Cập nhật checklist/bằng chứng trong file này; sửa API/kiến trúc/UI khi hành vi thay đổi. Tạo nhánh/commit đúng phạm vi, không tự push/deploy.

## Sắp xếp tài liệu trong lượt này

- [x] Gộp lộ trình và trạng thái vào `PROCESS.md`; bỏ các khẳng định cũ mâu thuẫn với runtime D1.
- [x] Gộp hai báo cáo điều tra/ổn định test vào phần bằng chứng ở trên. Nguyên nhân test: nạp CA/SSL context đồng bộ vượt cửa sổ event 1 giây và sink tự nhả sau 2 giây; sửa test ở D1.10.1, không coi đây là root cause timeout live.
- [x] Giữ API, kiến trúc, UI, kế hoạch đánh giá, báo cáo live/timing và audit có nội dung riêng. Giữ hướng dẫn AGENTS và knowledge; không phục hồi các file cũ đang bị người dùng xóa.

Bản README gốc repository đang là thay đổi nháp có sẵn, còn mô tả AI chỉ có thiết kế; lượt này giữ nguyên bản nháp ngoài phạm vi commit. Dùng README của ai-service và kiến trúc này làm nguồn hiện hành cho assistant.

Kiểm tra của lượt này: script Python stdlib kiểm tra đường dẫn liên kết/code fence trong Markdown hiện có, đọc và đối chiếu JSON summary D1.9; `git diff --check` qua. Hash snapshot xác nhận không đổi runtime hoặc nội dung ngoài phạm vi; staging ban đầu được đối chiếu riêng khi commit. Không chạy lại Python/Spring/FE/E2E; không cài dependency, model hoặc dịch vụ mới. Số file/liên kết kiểm tra cuối được ghi trong thông báo bàn giao.
