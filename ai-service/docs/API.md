# Hợp đồng API trợ lý khách sạn — v1 đề xuất

Ngày khảo sát: 2026-11-13; đồng bộ trạng thái **2026-11-26**. Hợp đồng tổng thể v1 đã triển khai đầy đủ D1–D4: FAQ có nguồn qua Verification Gate (D1, chấp nhận `ACCEPTED_WITH_LIMITATIONS` cho Academic Demo), business tools `search_rooms`/`list_services` (D2), booking cá nhân `list_my_bookings`/`get_my_booking` sau kiểm toán ownership `R4` (D3), và câu hỏi kết hợp `booking_with_policy` + `ContinuationStore` single-use (D4). Facade Recommendation cũ đã gỡ trong `c300a5b`. Xem [PROCESS.md](PROCESS.md) cho bằng chứng offline, smoke live MySQL/Gemini và các giới hạn/gate production còn mở. Các giới hạn dưới đây không phải cam kết hiệu năng.

Đọc cùng [kiến trúc](architecture.md), [process và tiến độ](PROCESS.md), [đánh giá](EVALUATION.md) và [UI](UI.md).

## 1. API và service đã có trong code

Các liên kết dưới đây là source đã khảo sát, không phải bằng chứng kiểm thử runtime trong lượt này. Tất cả đường dẫn source tính tương đối từ tài liệu này.

| API hiện có | Controller/service | Tái sử dụng và giới hạn |
| --- | --- | --- |
| GET /api/public/rooms/room-types | [PublicRoomController](../../BE/src/main/java/com/example/pbl6/controller/PublicRoomController.java), RoomCatalogService.getAllRoomTypes | Danh mục hạng phòng: ID, tên, sức chứa, mô tả, tiện nghi, basePrice |
| GET /api/public/rooms/room-types/{id} | Cùng controller, getRoomTypeById | Chi tiết hạng; không chứng minh còn phòng theo ngày |
| GET hoặc POST /api/public/rooms/available | Cùng controller, RoomCatalogService.findAvailableRooms | Ngày ở, số khách, hạng phòng, giá cơ sở min/max; có báo giá dự kiến |
| GET /api/public/services?categoryId=... | [PublicBillingController](../../BE/src/main/java/com/example/pbl6/controller/PublicBillingController.java), CustomerBillingService.getActiveServices | Dịch vụ đang hoạt động, tên, nhóm, đơn vị, đơn giá |
| GET /api/customer/bookings/my-bookings | [CustomerBookingController](../../BE/src/main/java/com/example/pbl6/controller/CustomerBookingController.java), CustomerBookingService.getMyBookings | Có code; cần sửa/kiểm chứng ownership trước khi dùng cho tool |
| GET /api/customer/bookings/history?status=... | Cùng controller, CustomerHistoryService.getMemberHistory | Danh sách tóm tắt theo principal; vẫn cần kiểm chứng account/customer |
| GET /api/customer/bookings/history/{bookingCode} | Cùng controller, CustomerHistoryService.getMemberBookingDetail | Chi tiết; có fallback khớp email/SĐT phải rà trước tích hợp |
| Recommendation cũ | Đã gỡ khỏi Spring source | Không phục hồi trong D1 |

### Báo giá đã có

[AvailableRoomResponse](../../BE/src/main/java/com/example/pbl6/dto/room/AvailableRoomResponse.java) có checkInDate, checkOutDate, nights, pricePerNight, totalRoomCharge, depositPercentage, estimatedDeposit. [RoomCatalogServiceImpl](../../BE/src/main/java/com/example/pbl6/service/RoomCatalogServiceImpl.java) tính tiền phòng từ giá cơ sở và số đêm; dùng cấu hình `hotel.deposit-percentage` cho cọc dự kiến.

Adapter assistant dùng những số backend trả về, không mặc định số cọc hoặc đọc thay bằng cấu hình `hotel.bank.deposit-percentage`. Cần đối chiếu hai cấu hình khi triển khai, không tự sửa ở bước tài liệu.

Chưa tạo get_room_quote/API báo giá mới. Kết quả này là **tiền phòng và cọc dự kiến**, chưa cam kết tổng thanh toán có thuế, dịch vụ, ưu đãi hoặc phụ thu. Các khoản chưa có căn cứ để null/unknown, không tự điền 0. Việc giữ/đặt phòng phải kiểm tra lại giá và tồn phòng trong nghiệp vụ đặt phòng.

### Điều kiện trước khi mở booking tools

- [CustomerBookingServiceImpl.getMyBookings](../../BE/src/main/java/com/example/pbl6/service/CustomerBookingServiceImpl.java) hiện tìm khách qua email và có nhánh dùng accountId làm customerId. Hai ID này không được coi là tương đương.
- [CustomerHistoryServiceImpl](../../BE/src/main/java/com/example/pbl6/service/CustomerHistoryServiceImpl.java) có logic resolveCustomerId và kiểm tra chi tiết qua email/SĐT. Thông tin chưa xác minh không phải bằng chứng sở hữu.
- Broker chỉ được dùng quan hệ account→customer được xác thực, kiểm tra ownership trước khi map DTO. Không gọi getBookingByCode đơn thuần hoặc public lookup bằng SĐT để thay bước này.
- Chưa hoàn tất kiểm tra khách A/B thì không đăng ký hai tool cá nhân; người hỏi nhận capability_unavailable, không lấy dữ liệu rồi yêu cầu model che đi.

## 2. Quy ước chung đề xuất

- JSON UTF-8; camelCase; reject trường thừa ở request/tool arguments. Schema được validate lại ở mỗi ranh giới, kể cả output AI.
- ID nội bộ là UUID không chứa danh tính. Ngày ở: YYYY-MM-DD theo Asia/Ho_Chi_Minh; timestamp mới: RFC3339 có offset. Không đổi timestamp của ApiResponse hiện có.
- Tiền dùng chuỗi decimal không dấu phân cách, ví dụ `"0.00"`; số đêm/số lượng là integer. Currency do Spring cấu hình rõ, đề xuất VND cho bản đầu; DTO nguồn chưa có currency nên đây là trường bổ sung ở adapter, không phải dữ liệu đọc được sẵn. Không đoán currency trong Python.
- X-Request-ID: tùy chọn từ browser, regex `^[A-Za-z0-9._-]{1,64}$`; Spring tạo UUID nếu thiếu. Header sai trả 422 với request ID mới. Cùng request ID ở response/header và mọi lượt gọi Python; request ID chỉ để trace, không dùng cấp quyền hoặc chống trùng.
- Giới hạn ban đầu: body công khai 16 KiB, message trim 1–2000 ký tự, lịch sử tối đa 8 tin do server chọn; mỗi tool trả tối đa 10 items, snippet tối đa 2000 ký tự. Payload nội bộ tối đa 128 KiB, response nội bộ tối đa 256 KiB. Vượt giới hạn không âm thầm cắt câu hỏi hoặc nhận response một phần.
- Budget toàn lượt: tối đa 4 tool calls gồm retrieval và nghiệp vụ, tối đa 2 batch nghiệp vụ, deadline 20 giây, tối đa 8000 input tokens tích lũy và 2000 output tokens tích lũy. Cấu hình được và đo lại khi triển khai; client/model không được nâng budget. HTTP retry phải nằm trong budget, không tự replay vòng tool.
- Mọi ví dụ là minh họa hợp đồng, không phải chính sách/booking thật hoặc lệnh gọi endpoint đã triển khai.

## 3. React → Spring: POST /api/assistant/chat (mới)

### Xác thực và phiên

FAQ/phòng/dịch vụ cho guest. Nếu gửi Authorization: Bearer USER_JWT thì Spring xác thực; token hỏng/hết hạn trả 401, không hạ thành guest. Tool cá nhân chỉ dành cho principal khách hàng được cấp quyền; tài khoản staff/admin không tự được xem booking khách qua trợ lý khách hàng.

Guest dùng cookie phiên opaque do Spring cấp, HttpOnly/SameSite=Lax, Secure trên HTTPS; cấu hình local HTTP tách rõ. Browser dùng credentials cùng origin. Không đưa JWT/session cookie vào Python. Khi triển khai phải đánh giá Origin/CSRF cho route có cookie, không mở CORS tùy ý hoặc thay auth của toàn ứng dụng.

conversationId do Spring phát, buộc vào phiên guest hoặc account và phiên đăng nhập. Không nhận accountId/username/role/owner từ browser. Conversation TTL đề xuất 30 phút không hoạt động, chỉ trong bộ nhớ ở bản đầu. ID không tồn tại/hết hạn/sai chủ trả cùng 404 CONVERSATION_NOT_FOUND, không lộ sự tồn tại của phiên khác. Logout/đổi account hủy phiên chat và dữ liệu riêng; guest→member bắt đầu phiên mới, không tự phát lại câu hỏi cũ. Tính đúng của vô hiệu hóa phiên phải được đặc tả thêm trong implementation auth hiện có vốn dùng JWT stateless.

### Request

```json
{
  "conversationId": null,
  "clientMessageId": "00000000-0000-4000-8000-000000000001",
  "message": "Tôi muốn tìm phòng cho 2 người"
}
```

| Trường | Kiểu/quy tắc |
| --- | --- |
| conversationId | UUID hoặc null; null mở phiên mới |
| clientMessageId | UUID bắt buộc, do browser tạo cho mỗi lần người dùng gửi; retry giữ nguyên |
| message | String, trim 1–2000 ký tự; lịch sử, tool result và server context không được browser gửi |

Spring cấp turnId UUID, giữ principal cố định trong lượt. Chỉ cho một lượt đang chạy/conversation; lượt khác trả 409 CONVERSATION_BUSY. Chống trùng theo owner-session + clientMessageId trong TTL phiên: cùng nội dung trả response đã lưu, khác nội dung trả 409 MESSAGE_ID_CONFLICT; đang xử lý trả 409 TURN_IN_PROGRESS. Quy tắc áp dụng cả request conversationId=null, để retry không mở nhiều phiên. Không lưu raw prompt vào log phục vụ chống trùng.

### Response 200

Dùng wrapper [ApiResponse](../../BE/src/main/java/com/example/pbl6/common/ApiResponse.java) hiện có: success/message/data/timestamp. Không thêm field vào wrapper dùng chung. timestamp vẫn theo serializer LocalDateTime hiện có; chỉ các field timestamp mới trong data dùng RFC3339.

```json
{
  "success": true,
  "message": "Cần bổ sung thông tin tìm phòng",
  "timestamp": "2026-11-13T10:00:00",
  "data": {
    "requestId": "demo-search-1",
    "conversationId": "00000000-0000-4000-8000-000000000002",
    "turnId": "00000000-0000-4000-8000-000000000003",
    "clientMessageId": "00000000-0000-4000-8000-000000000001",
    "status": "needs_clarification",
    "answer": "Bạn muốn nhận phòng và trả phòng ngày nào?",
    "missingFields": ["checkInDate", "checkOutDate"],
    "citations": [],
    "cards": [],
    "actions": [],
    "corpusMode": "production"
  }
}
```

timestamp trong ví dụ minh họa LocalDateTime của wrapper, không phải timestamp có offset của retrievedAt. Giữ serializer hiện có khi triển khai.

### Trạng thái nghiệp vụ (HTTP 200, success=true)

| status | Ý nghĩa và field bổ sung |
| --- | --- |
| answered | Có căn cứ trả lời; answer bắt buộc; cards/citations có thể rỗng tùy loại nguồn |
| needs_clarification | Thiếu ngày/số khách/booking rõ ràng; missingFields từ allowlist, không tự điền điều kiện |
| requires_login | Guest hỏi dữ liệu cá nhân; không chạy tool riêng, actions có open_login |
| no_results | Tool thành công nhưng không có phòng/booking/dịch vụ phù hợp; arrays rỗng, không phải timeout |
| insufficient_evidence | Retrieval hoạt động nhưng không có nguồn hợp lệ/đủ căn cứ, không phải provider lỗi |
| capability_unavailable | Ý định yêu cầu tool chưa bật; không giả có kết quả hoặc đòi login nếu đăng nhập cũng chưa giải quyết được |

corpusMode là production hoặc demo_synthetic, do server cấu hình, không nhận từ client. Demo phải được UI gắn nhãn. Knowledge hiện approved=false không vào corpus production. Không có index bắt buộc khiến service chưa ready (503), khác với index hợp lệ nhưng tìm không ra bằng chứng (200 insufficient_evidence).

### Final payload dùng chung giữa Python và Spring

| Trường bắt buộc | Kiểu/giới hạn |
| --- | --- |
| status | Một trong sáu trạng thái nghiệp vụ ở trên; lỗi transport không nằm trong enum này |
| answer | String 1–4000 ký tự, tiếng Việt; không có HTML thô |
| missingFields | Array string duy nhất thuộc checkInDate, checkOutDate, guestCount, roomTypeId, bookingCode, priceBudgetUnit; chỉ có phần tử khi needs_clarification |
| citations | Array Citation tối đa 5, không trùng citationId; [] khi không dùng nguồn tài liệu |
| cards | Array Card tối đa 10; [] nếu không có dữ liệu nghiệp vụ phù hợp |
| actions | Array Action tối đa 3 từ allowlist mục 5; [] nếu không cần |
| corpusMode | production hoặc demo_synthetic, khớp mode server |

Không dùng null thay cho arrays rỗng. Các ID công khai là UUID/string đúng quy ước mục 2 và luôn có trong response 200 sau khi Spring ghép; chúng không nằm trong object final do model đề xuất. Reject trường thừa, kể cả username/role/debug/rawPrompt. Claim về giá/booking chỉ được xuất khi có tool result hợp lệ của lượt hiện tại; lịch sử không thay việc tra dữ liệu live.

## 4. Spring → Python: POST /internal/assistant/turn (mới)

Endpoint nội bộ, không mở cho browser. Authorization: Bearer SERVICE_TOKEN từ AI_SERVICE_AUTH_TOKEN theo convention hiện có; thiếu cấu hình thì readiness lỗi, thiếu/sai token gọi endpoint trả 401. USER_JWT không được dùng thay SERVICE_TOKEN. TLS khi qua host/mạng không tin cậy; không ghi secret vào log.

Một endpoint có discriminated union `phase`: start hoặc resume. Python xử lý retrieval tại chỗ; trả tool_calls cho Spring khi cần nghiệp vụ. Spring gọi service trực tiếp, không HTTP vòng vào assistant. Python không có quyền gọi MySQL/URL tùy ý.

### Start

```json
{
  "phase": "start",
  "requestId": "demo-search-1",
  "conversationId": "00000000-0000-4000-8000-000000000002",
  "turnId": "00000000-0000-4000-8000-000000000003",
  "message": "Tôi muốn tìm phòng cho 2 người",
  "history": [],
  "allowedTools": ["search_knowledge", "search_rooms", "list_services"],
  "context": {"locale": "vi-VN", "timeZone": "Asia/Ho_Chi_Minh", "today": "2026-11-13", "currency": "VND"},
  "budget": {"remainingToolCalls": 4, "remainingBrokerBatches": 2, "remainingMs": 20000, "remainingInputTokens": 8000, "remainingOutputTokens": 2000}
}
```

requestId phải khớp header. history là tối đa 8 `{role: user|assistant, content: string}` do Spring chọn theo đúng chủ phiên; giới hạn token chung ưu tiên câu hỏi hiện tại và evidence, không cắt âm thầm dữ liệu tài chính. Lịch sử không phải bằng chứng dữ liệu live hoặc quyền. Python không nhận tên tài khoản/role/PII nhận diện; allowedTools chỉ là quyền đề xuất, Spring vẫn kiểm tra mỗi lần thực thi.

### Response nội bộ: tool_calls hoặc final

```json
{
  "requestId": "demo-search-1",
  "conversationId": "00000000-0000-4000-8000-000000000002",
  "turnId": "00000000-0000-4000-8000-000000000003",
  "kind": "tool_calls",
  "continuationId": "00000000-0000-4000-8000-000000000004",
  "toolCalls": [{"callId": "00000000-0000-4000-8000-000000000005", "name": "list_services", "arguments": {"limit": 5}}],
  "usage": {"toolCallsUsed": 0, "brokerBatchesUsed": 0, "inputTokensUsed": 100, "outputTokensUsed": 40},
  "evidence": []
}
```

Các token usage trong ví dụ là giả lập cấu trúc, không phải benchmark. toolCallsUsed chỉ đếm đã thực thi, không đếm call đang chờ; Spring tính thêm các tool nghiệp vụ mình chạy. usage Python mỗi response là số tăng thêm của riêng lần gọi đó (không cộng dồn lại lần trước). Các metric không được âm; vượt budget thì dừng. Broker giữ ledger tổng, giảm budget khi gửi resume; Python không được reset giới hạn qua continuation.

kind=tool_calls có 1–4 calls, chỉ chứa tool nghiệp vụ được phép và số lượng không vượt budget còn lại; không chứa final. Mỗi callId duy nhất trong turn. Các ID sai/batch sai/tool lạ là lỗi protocol 502 ở public, không được thực thi. kind=final có `final` theo data nghiệp vụ mục 3 (status/answer/missingFields/citations/cards/actions/corpusMode), `toolCalls: []`, `continuationId: null`, `usage` và `evidence`; Spring tự điền các ID công khai từ ledger, không tin model tạo.

### Resume

```json
{
  "phase": "resume",
  "requestId": "demo-search-1",
  "conversationId": "00000000-0000-4000-8000-000000000002",
  "turnId": "00000000-0000-4000-8000-000000000003",
  "continuationId": "00000000-0000-4000-8000-000000000004",
  "toolResults": [{"callId": "00000000-0000-4000-8000-000000000005", "name": "list_services", "status": "ok", "data": {"items": [], "hasMore": false}, "error": null}],
  "budget": {"remainingToolCalls": 3, "remainingBrokerBatches": 1, "remainingMs": 15000, "remainingInputTokens": 7900, "remainingOutputTokens": 1960}
}
```

Resume không nhận message/history mới. continuationId opaque do Python cấp, gắn service caller + request/conversation/turn + batch đang chờ; TTL tối đa 2 phút và không vượt deadline lượt. Nhận đúng một result cho mỗi call đang chờ, không thừa/thiếu/trùng. Tiêu thụ continuation nguyên tử một lần; replay/conflict trả 409, không chạy lại tool. Bản đầu không tự retry resume; mất response thì báo lỗi lượt, người dùng có thể gửi câu hỏi mới.

Tool result status=ok có data, error=null. Status=error có data=null và error `{code,message}` đã làm sạch; không có stack trace/raw upstream body. Empty items là ok. Các mã lỗi tool cho phép: AUTH_REQUIRED, FORBIDDEN, NOT_FOUND, VALIDATION_ERROR, CAPABILITY_UNAVAILABLE, DEPENDENCY_UNAVAILABLE, DATA_UNAVAILABLE, TIMEOUT. Không lộ mã booking tồn tại của chủ khác: dùng NOT_FOUND.

Nếu tất cả nguồn cần thiết thất bại do dependency/timeout, trả lỗi transport, không final answered/insufficient_evidence. Nếu một nguồn bắt buộc thất bại, không tự ghép câu trả lời như đã đầy đủ; v1 báo lỗi toàn lượt. Tool bị cấm vì thiếu login chuyển requires_login; dữ liệu riêng sai chủ trả NOT_FOUND và không truyền bản ghi sang model.

## 5. Citation, evidence, card và action

### Evidence và citation

Evidence chỉ ở nội bộ: `{citationId, documentId, version, chunkId, sectionId, title, sourceRef, excerpt, corpusMode}`; mọi trường string không rỗng, excerpt tối đa 2000 ký tự. citationId duy nhất/turn, gắn chunk thực lấy từ index. Python runtime tạo evidence registry từ retrieval trước khi gọi LLM; model không tự ghi registry. Spring tích lũy evidence theo turn và chỉ nhận citation thuộc registry đó, cùng corpusMode đang cấu hình.

Citation công khai: `{citationId, documentId, version, chunkId, sectionId, title, sourceRef}`. Model chỉ chọn citationId, runtime ghép metadata từ registry. sourceRef là mã nguồn đã duyệt, không tự biến thành URL; không expose đường dẫn máy chủ. UI có thể hiện title/section/version, chưa cần API xem source riêng. Muốn link ngoài phải có allowlist được server cấu hình.

Các field bảng/ID nội bộ và schema dùng cho quản lý knowledge phải được duyệt về tính phù hợp trước khi đưa vào nguồn trả khách. Citation tồn tại chưa chứng minh khẳng định đúng: vẫn đánh giá grounding theo EVALUATION.md. Giá/booking trích từ tool không được dựng thành citation tài liệu.

### Card

Card là union `{type, data, retrievedAt}`; type=room|service|booking. retrievedAt do runtime thực thi tool ghi RFC3339. data chỉ chứa DTO tool được định nghĩa bên dưới. Spring ghép card từ ledger tool result, không cho model tự sửa số tiền/ID, chèn room.note hoặc tạo HTML/URL. V1 mỗi câu trả lời tối đa 10 cards; nếu kết quả vượt giới hạn phải thông báo hasMore và bộ lọc để khách thu hẹp, không giả kết quả đã đầy đủ.

### Action

Action công khai `{type,label,targetId}`. Allowlist v1: open_login (targetId=null), open_room_search (targetId=null), open_services (targetId=null). FE ánh xạ sang route sẵn có; model không cung cấp href. Action xem booking cụ thể chưa mở v1 vì chưa xác minh route chi tiết phù hợp; card hiển thị dữ liệu đủ dùng. Không có action đặt/hủy/thanh toán qua chat.

## 6. Hợp đồng năm tool

Tool name cố định; arguments là object, reject unknown fields. ID nguyên dương; limit mặc định 5, trong 1–10. List trả `{items,hasMore}`, rỗng hợp lệ. hasMore tính từ tập đủ điều kiện, không tuyên bố không còn kết quả sau khi cắt trang. Thứ tự ổn định và giới hạn do adapter mới, không khẳng định service cũ đã phân trang/sắp theo quy tắc này.

### search_knowledge — thực thi tại Python

- Dùng cho FAQ/chính sách/hướng dẫn hoặc mô tả không cần số liệu live; không truy xuất booking/giá/tồn phòng.
- Arguments: `query` string trim 1–2000; `category` tùy chọn thuộc faq|policy|room_catalog|service_guide; `topK` integer 1–5, mặc định 3.
- Runtime lọc approved=true và đúng hiệu lực theo ngày tin cậy từ Spring; loại tài liệu quản lý. Không để model truyền approved/corpusMode/path/URL hoặc gỡ bộ lọc.
- Output nội bộ: `{items: Evidence[], hasMore: boolean, snapshotId: string}`. Giới hạn excerpt như mục 5. Không có passage phù hợp trả items=[]; index/provider lỗi phải báo dependency, không giả rỗng.
- Demo chỉ dùng index synthetic tách riêng và được gắn nhãn. Bộ knowledge hiện chưa được duyệt, không tự nạp vì có file.
- Không có chính sách được duyệt trong corpus hiện tại: khi index hợp lệ nhưng thiếu policy, trả insufficient_evidence; không tạo chính sách dựa trên schema/hằng số code.

### search_rooms — thực thi ở Spring

- Arguments bắt buộc: `checkInDate`, `checkOutDate` YYYY-MM-DD; `guestCount` integer >0. Thiếu thông tin thì hỏi lại trước khi gọi tool.
- Tùy chọn: `roomTypeId` integer >0; `minPrice`, `maxPrice` là chuỗi decimal >=0, min<=max; `sortBy` PRICE_ASC|PRICE_DESC mặc định PRICE_ASC; `limit` như trên.
- Ngày nhận >= today tin cậy của server; ngày trả > ngày nhận. Adapter validate rõ trước gọi service, không dựa riêng annotation controller khi gọi service trực tiếp.
- Mapping: RoomSearchRequest → RoomCatalogService.findAvailableRooms. Giá lọc là giá cơ sở mỗi đêm của hạng phòng, không phải ngân sách cả kỳ; ưu tiên mềm chưa hỗ trợ không được giả thành điều kiện cứng. Không tự nới bộ lọc.
- Mỗi item: `{roomId, roomTypeId, typeName, capacity, amenities, description, checkInDate, checkOutDate, nights, pricePerNight, totalRoomCharge, depositPercentage, estimatedDeposit, currency, priceScope}`. priceScope luôn room_charge_estimate, không phải total_invoice. Tiền là chuỗi decimal từ BigDecimal; thiếu giá nguồn trả lỗi DATA_UNAVAILABLE ở broker/public 503 (không nhận giá 0 do fallback nguồn null làm báo giá thật).
- Không gửi note, floor hoặc số phòng vật lý sang LLM. Giữ roomId để ghép card; kết quả theo phòng vật lý như service hiện có, chưa tự gộp thành offer/hạng phòng.
- Sắp theo giá đúng chiều, hòa theo roomId tăng dần, rồi limit và hasMore. Trả retrievedAt từ broker cho card; số tiền và cọc không tính lại trong Python.

### list_services — thực thi ở Spring

- Arguments: `categoryId` integer >0 tùy chọn; `limit` như trên. Không hỗ trợ tự chọn inactive hoặc tự tạo category theo câu hỏi.
- Mapping: CustomerBillingService.getActiveServices(categoryId).
- Item: `{serviceId, categoryName, serviceName, unitPrice, unit, isActive, currency}`; chỉ isActive=true, tiền decimal string. Sắp serviceId tăng dần, limit/hasMore. Thiếu đơn giá không được gán 0 giả; báo DATA_UNAVAILABLE.
- Không suy giờ phục vụ, miễn phí, điều kiện hủy hoặc tồn dịch vụ chỉ từ tên/active flag. Snapshot knowledge không thay live tool.

### list_my_bookings — thực thi ở Spring, mặc định chưa bật

- Arguments: `status` tùy chọn trong PENDING_DEPOSIT|CONFIRMED|CHECKED_IN|CHECKED_OUT|CANCELED|EXPIRED; `limit` như trên. Không có username/customerId/email/phone.
- Mapping đề xuất: CustomerHistoryService.getMemberHistory(principal.name,status), sau khi kiểm chứng/sửa ownership như mục 1. Không dùng my-bookings hiện có nguyên trạng chỉ vì có endpoint.
- Item tối thiểu: `{bookingCode, bookingStatus, roomTypeName, checkInDate, checkOutDate, nights, guestCount}`. Sắp createdAt giảm dần, hòa bookingCode tăng dần trước giới hạn; không gửi createdAt hoặc roomNumber cho model nếu không cần.
- Chỉ khách đăng nhập đúng chủ; không có booking trả items=[] với hasMore=false, không lấy booking khách khác để thay.

### get_my_booking — thực thi ở Spring, mặc định chưa bật

- Arguments: `bookingCode` string trim 1–50, regex `^[A-Za-z0-9-]+$`. Đây là giới hạn đề xuất cho adapter, cần xác nhận dữ liệu mã thực tế khi triển khai; không sửa/xóa mã không khớp để làm nó hợp lệ.
- Mapping: CustomerHistoryService.getMemberBookingDetail(principal.name,bookingCode) sau khi kiểm chứng ownership. Sai chủ hoặc không tồn tại cùng NOT_FOUND, không lộ thông tin trước lọc quyền.
- Data: `{bookingCode, bookingStatus, roomTypeName, checkInDate, checkOutDate, nights, guestCount, depositRequired, depositPaid, totalAmount, remainingBalance, currency}`. Chỉ thêm nhóm tiền khi câu hỏi yêu cầu; tối thiểu mặc định chỉ nhóm thông tin lưu trú như list_my_bookings. Các field tiền lấy trực tiếp từ response history, không cộng/trừ trong AI.
- Cấm chuyển nguyên BookingDetailResponse/CustomerBookingHistoryDetailResponse: loại customerName/Phone/Email, idNumber, customerId, note, số phòng, QR, giao dịch chi tiết và thông tin người thực hiện. Không log raw result.
- Câu hỏi hủy/hoàn không cấp quyền gọi cancel; nếu thiếu policy đã duyệt thì thông báo chưa đủ căn cứ, không suy quy định từ số tiền của booking.

DATA_UNAVAILABLE dùng cho dữ liệu nguồn thiếu/không thể dùng. Các field nullable phải được schema tool cuối cùng giữ rõ, không cho model biến null thành giá trị khẳng định.

## 7. HTTP và lỗi transport

Lỗi công khai vẫn dùng ApiResponse, success=false; data chứa `{requestId, code, retryable}` và turnId/conversationId nếu đã xác nhận đúng chủ. message tiếng Việt an toàn, không lộ raw upstream. Thiếu tiền/dữ liệu nguồn không đồng nghĩa không có kết quả.

```json
{
  "success": false,
  "message": "Dịch vụ hỗ trợ đang tạm thời chưa sẵn sàng.",
  "timestamp": "2026-11-13T10:00:00",
  "data": {"requestId": "demo-error-1", "code": "DEPENDENCY_UNAVAILABLE", "retryable": true}
}
```

| HTTP | Mã/ý nghĩa công khai |
| --- | --- |
| 400 | INVALID_JSON |
| 401 | UNAUTHORIZED: JWT được gửi nhưng sai/hết hạn |
| 403 | FORBIDDEN: principal không được dùng chức năng cá nhân |
| 404 | CONVERSATION_NOT_FOUND hoặc RESOURCE_NOT_FOUND đã làm sạch |
| 409 | CONVERSATION_BUSY, TURN_IN_PROGRESS, MESSAGE_ID_CONFLICT; nội bộ thêm CONTINUATION_NOT_FOUND cho resume không có trạng thái hợp lệ |
| 413 | PAYLOAD_TOO_LARGE |
| 422 | VALIDATION_ERROR: trường thừa, ngày/ID/tham số sai |
| 429 | RATE_LIMITED nếu có limiter; Retry-After từ server, không giả đã cấu hình limiter |
| 502 | AI_PROTOCOL_ERROR, AI_AUTH_FAILED hoặc AI_UNREACHABLE |
| 503 | DEPENDENCY_UNAVAILABLE, AI_NOT_CONFIGURED, DATA_UNAVAILABLE, BUDGET_EXCEEDED |
| 504 | DEADLINE_EXCEEDED |
| 500 | INTERNAL_ERROR không có stack trace |

Endpoint nội bộ lỗi có JSON `{requestId, error:{code,message,retryable}}`, không bọc ApiResponse của Java. Nội bộ dùng 400/401/409/413/422/503/504/500 theo nguyên nhân; Spring map internal 401 thành 502 AI_AUTH_FAILED, không trả 401 làm khách tưởng JWT hỏng. Sai schema/ID/response quá giới hạn trả public 502. Tool/resource errors như AUTH_REQUIRED không phải service credential 401.

## 8. GET /health và GET /ready (mới, Python)

Hai route chỉ trên mạng/host nội bộ, không gọi từ widget, không yêu cầu service token để probe cục bộ; không công bố cấu hình/secret/đường dẫn. Policy mạng phải giới hạn bên truy cập. GET /health 200 `{status:"alive"}` khi tiến trình đáp ứng; không kiểm tra model/DB.

GET /ready 200 `{status:"ready", profile:"faq", corpusMode:"production", checks:{configuration:true,llm:true,retrieval:true}}` khi dependency bắt buộc profile sẵn sàng. Nếu một check false trả 503 với status=not_ready và các check tương ứng; không lộ chi tiết credential/provider exception.

Profile v1 là faq: cấu hình service auth hợp lệ, LLM sẵn sàng và index phù hợp mode. production yêu cầu snapshot nguồn đã duyệt còn hiệu lực; demo_synthetic yêu cầu index synthetic tách riêng. Hiện chưa có nguồn duyệt, nên production chưa thể ready. Không tự chuyển mode vì dependency lỗi. Health/ready không kiểm tra trực tiếp MySQL: Spring chịu trách nhiệm dependency nghiệp vụ và broker trả lỗi khi backend không sẵn sàng.

## 9. Các kiểm tra contract bắt buộc khi triển khai

1. Guest hỏi booking → requires_login, không có tool riêng; JWT sai → HTTP 401.
2. Client giả principal/toolResults/history, replay continuation hoặc sai call/turn ID → từ chối trước thực thi.
3. A không đọc được booking B; không dùng accountId trùng customerId hoặc email/SĐT chưa xác minh để mở quyền.
4. Logout/đổi account trong lúc xử lý → không trả dữ liệu cũ cho chủ phiên mới; conversation ID biết được không đủ để truy cập.
5. Bộ knowledge approved=false bị loại khỏi production; demo có nhãn và không tự fallback.
6. Cần ngày/số khách → hỏi lại; phòng hết → no_results; index hợp lệ không có nguồn → insufficient_evidence; provider lỗi → 503/504.
7. Giá/cọc/cards khớp DTO ledger; không coi totalRoomCharge là tổng hóa đơn; currency có cấu hình tin cậy.
8. Dịch vụ bị ngừng sau snapshot → tool live không trả; giờ/điều kiện thiếu không bị AI bịa.
9. Deadline/token/call budget bao trùm retrieval và resume; không reset hoặc double-count; trả lỗi khi vượt.
10. JSON examples/schema Java/Python/FE và mã lỗi phải được kiểm thử contract; ví dụ trong file này chỉ kiểm tra cú pháp, chưa chứng minh runtime đáp ứng.

## 10. Giới hạn của bước tài liệu

Bước 1 là đặc tả; Bước 2 là foundation. D1 hiện có Spring chat/reset, Gemini adapter, FTS5 và final FAQ; có cả kiểm thử mock có nhãn và E2E Gemini thật. Xem [README](../README.md) và [PROCESS](PROCESS.md) cho kết quả còn lỗi của batch live. Resume vẫn 409 vì D1 không cấp continuation; production readiness 503 khi thiếu LLM/index hoặc nguồn được duyệt. Tool nghiệp vụ và D2–D4 chưa triển khai.

## D1 — quyết định triển khai

Spring D1 hiện thực POST /api/assistant/chat và DELETE /api/assistant/session (không body, 204, xóa cookie/phiên và chặn kết quả đến muộn). Hai route yêu cầu Origin nằm trong assistant.origins; chỉ chat nhận application/json. Cookie assistant_session HttpOnly/SameSite=Lax, Secure ngoài local. Session TTL 30 phút, tối đa 1000 phiên/128 message IDs mỗi phiên, history tối đa 8 tin. Session đầy trả 503 CAPACITY_UNAVAILABLE. Retry cùng message ID trả cùng kết quả hoặc lỗi đã ghi nhận, không gọi provider lại. Request lỗi có thể thử mới bằng clientMessageId mới do người dùng chủ động gửi.

assistant.enabled mặc định false. demo_synthetic chỉ được bật trong Spring profile local; mode response Python phải khớp cấu hình Spring. Browser không chọn mode. Spring không forward Authorization/cookie/principal cho Python, chỉ server service token. Toàn lượt deadline 20 giây và response nội bộ cap 256 KiB. Đây là reset phiên chat, không phải thu hồi JWT toàn hệ thống.

D1 chỉ nhận `search_knowledge` cho luồng FAQ; các request foundation vẫn được validate theo schema tổng thể nhưng không thực thi tool nghiệp vụ. Khi đủ provider/index, start trả `kind=final` với evidence registry và usage; `toolCalls=[]`, `continuationId=null`, `cards=[]`. Resume vẫn 409. FAQ answered phải có citation trong registry; output model sai trả 502 AI_PROTOCOL_ERROR. Booking, dữ liệu live và thao tác ghi trả capability_unavailable cho cả guest/member trong D1, không mời đăng nhập như thể có thể mở chức năng chưa triển khai.

Gemini REST gemini-3.1-flash-lite, JSON schema; SQLite FTS5/BM25 local, không embedding. Nghiệm thu bằng demo_synthetic; production không nạp knowledge pending_review. Chỉ search_knowledge, tối đa hai generation calls, không retry; budget tích lũy như mục 2. Provider adapter đã có; các bước còn lại xem PROCESS.
