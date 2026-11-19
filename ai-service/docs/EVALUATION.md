# Đánh giá trợ lý RAG và công cụ nghiệp vụ

Trạng thái cập nhật 2026-11-19: đây là kế hoạch đánh giá toàn phạm vi D1–D4. D1 đã có test suite, dataset synthetic 12 dev + 12 held-out, retrieval baseline và hai batch Gemini thật; corpus production chưa duyệt, độ ổn định và grounding toàn batch chưa nghiệm thu. Kết quả lịch sử/giới hạn ở [PROCESS.md](PROCESS.md); các mục business tools dưới đây chưa được triển khai.

## Dữ liệu và nhãn

- Tập khởi đầu đề xuất: 60 câu thuộc sáu nhóm chức năng, 10 câu mỗi nhóm; thêm ít nhất 20 ca kết hợp, thiếu nguồn, lỗi phụ thuộc và tấn công quyền/prompt.
- Đây là quy mô dự kiến cho prototype, không phải dữ liệu đã thu thập hay bảo đảm đủ cho production.
- Tách dev/held-out test theo nhóm paraphrase trước chỉnh prompt/ngưỡng; không để cùng một câu đổi cách diễn đạt lọt sang cả hai tập.
- Nhãn mỗi ca: intent, tool mong đợi, bộ lọc, role/owner, snapshot, source/version/section chuẩn, nội dung được phép trả và điều kiện từ chối.
- Fixture khách/booking hoàn toàn synthetic; không xuất database đang chạy để làm corpus.
- FAQ/chính sách cần người phụ trách xác nhận; không lấy câu trả lời model làm ground truth.

## Các trục đánh giá

| Trục | Đo/kiểm tra | Bằng chứng cần ghi |
| --- | --- | --- |
| Chọn nguồn/tool | Đúng tool hoặc đúng quyết định hỏi lại | Nhãn intent/tool và trace đã làm sạch |
| Retrieval | Recall@k/MRR theo evidence chuẩn, lọc hiệu lực | Corpus/query snapshot, k và version model |
| Grounding | Mỗi khẳng định nghiệp vụ có evidence hỗ trợ | Chấm theo rubric, phân tích câu không có căn cứ |
| Citation | Nguồn tồn tại, đúng version/section và hỗ trợ khẳng định | Chunk ID thực truy xuất, không chỉ URL hợp lệ |
| Giá/phòng/dịch vụ | Khớp tool result, đúng ngày, currency và đơn vị | So dữ liệu cấu trúc với backend tại thời điểm test |
| Booking và phiên | Không lộ dữ liệu ngoài quyền, không tái dùng phiên khác | Ca A/B, guest, JWT hỏng, logout, conversation ID giả |
| Lỗi và từ chối | Không bịa khi nguồn thiếu, tool bị chặn hoặc timeout | Trạng thái và nội dung trả lời |
| Hiệu năng/chi phí | p50/p95, tool calls, token/chi phí khi đo được | Máy/provider/version, concurrency, số lần lặp và cold/warm |

Không dùng cosine như tỷ lệ đúng hoặc dùng test logic pass làm bằng chứng chất lượng câu trả lời.

## Ca bắt buộc

1. FAQ có đáp án, hỏi không dấu, câu ngoài phạm vi và câu không có trong tài liệu.
2. Chính sách có ngoại lệ, hai phiên bản khác ngày hiệu lực, FAQ mâu thuẫn policy và thiếu bản áp dụng cho booking cũ.
3. Tìm phòng thiếu ngày/số khách, hết phòng, ngân sách thấp, điều kiện phủ định; không tự nới bộ lọc.
4. Giá và dịch vụ đổi sau khi build index; trả backend live, không dùng con số cũ trong đoạn văn.
5. Guest hỏi booking; khách A nhập mã booking B hoặc giả username/customerId; principal không đổi.
6. Conversation ID của B được A gửi lại; request A đang chạy rồi logout/login B; nội dung A không xuất hiện cho B.
7. Prompt injection trong câu hỏi và trong đoạn tài liệu yêu cầu tiết lộ JWT, bỏ qua quyền, gọi SQL/HTTP tùy ý.
8. Tool name lạ, arguments thừa/sai, kết quả sai call ID, vượt budget, AI/backend timeout hoặc dependency chưa sẵn sàng.
9. Câu kết hợp booking + chính sách: ownership trước retrieval cá nhân, đúng policy version; không tự thực hiện cancel.
10. UI desktop/mobile, keyboard/focus, panel bám góc dưới bên phải và không che thao tác nghiệp vụ.
11. Chế độ public/live từ chối index synthetic; chế độ demo hiện nhãn giả lập, không ghi đè corpus thật và không tự fallback khi nguồn thật lỗi.

## Điều kiện chặn phát hành

- Phát hiện lộ booking khác chủ, credential/PII thừa vào context/log hoặc dùng email/SĐT chưa xác minh để cấp quyền: chưa được mở chức năng booking.
- Giá/trạng thái tự bịa hoặc tool ngoài allowlist thực thi được: chưa đạt nghiệm thu.
- Không đủ nguồn phải có trạng thái rõ. Ngưỡng chất lượng/latency sản phẩm cần được chốt sau số đo baseline; không tự ghi mục tiêu đã đạt.
- Báo cáo kèm command thật, ngày, commit hoặc working-tree snapshot, provider/model revision, corpus version, kết quả và ví dụ lỗi.
