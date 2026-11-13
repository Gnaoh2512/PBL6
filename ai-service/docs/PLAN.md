# Lộ trình triển khai trợ lý

Trạng thái hiện tại: đã có tổ chức tài liệu, hợp đồng API và khung FastAPI/auth/schemas/health/readiness được kiểm thử. D1 chưa hoàn thành vì chưa có provider/index/retrieval, Spring chat và widget chạy xuyên hệ thống. Xem STATUS.md.

## D0 — Thiết kế và hướng dẫn

- Ghi sáu nhóm chức năng, vị trí góc dưới bên phải, luồng RAG/tool broker và ranh giới dữ liệu.
- Tạo thư mục/AGENTS theo trách nhiệm FE, BE, Python, knowledge và tests.
- Giữ nguyên thay đổi đang có của người dùng, không phục hồi source/test AI đã bị xóa.
- Hoàn thành khi đường dẫn, liên kết, phạm vi mỗi AGENTS và trạng thái chưa triển khai được kiểm tra.

## D1 — Một câu FAQ có nguồn chạy xuyên hệ thống

- Đặc tả contract chat và giao tiếp Spring↔Python; guest/member behavior; giới hạn request/deadline.
- Chọn provider/model và index tối thiểu có lý do; thống nhất nơi lưu output ngoài corpus và ignore trước khi sinh index.
- Chuẩn bị một corpus FAQ/chính sách được duyệt hoặc bộ synthetic gắn nhãn rõ cho môi trường thử. Nhánh synthetic dùng fixture/index/manifest riêng trong chế độ test/demo tường minh; không được cấu hình vào public/live hoặc tự fallback từ corpus thật.
- Làm ingestion, retrieval có metadata, câu trả lời dẫn nguồn và xử lý không đủ evidence.
- Tạo widget góc dưới bên phải theo UI.md và facade Spring mới; chưa gắn tool booking.
- Nghiệm thu: câu hỏi có nguồn, câu ngoài nguồn bị từ chối hợp lý, dependency lỗi có trạng thái rõ; không gọi trực tiếp provider từ browser.

## D2 — Phòng, giá và dịch vụ

- Nối tool search_rooms/list_services vào service thật; hỏi đủ bộ lọc trước truy vấn.
- Rà soát năng lực báo giá backend; chỉ thêm get_room_quote khi có phép tính nghiệp vụ đúng, có unit/currency/khoản bao gồm.
- Render thẻ từ dữ liệu cấu trúc; không lấy giá hoặc tồn phòng từ index.
- Nghiệm thu: ngày không hợp lệ, hết phòng, giá thay đổi, dịch vụ dừng, tool ngoài allowlist và backend timeout.
- Ranker ngữ nghĩa là tùy chọn cho ưu tiên mềm, sau khi backend loại điều kiện cứng; không phải điều kiện bắt buộc để FAQ chạy.

## D3 — Booking cá nhân và ràng buộc phiên

- Rà account/customer ownership, đặc biệt fallback email/SĐT trong CustomerHistoryServiceImpl. Nhánh chưa chứng minh định danh phải được chặn/sửa trước khi mở tool.
- Thực thi tool ở Spring bằng principal; DTO tối thiểu, không gửi JWT/PII thừa cho Python hoặc LLM ngoài.
- Ràng buộc conversation và tool call/result theo account/phiên; có TTL, cancellation và xử lý kết quả muộn.
- Nghiệm thu: khách A không đọc được booking B dù biết mã; anonymous/JWT hỏng không đọc được; logout/đổi account không tái sử dụng nội dung cũ.
- Dữ liệu cá nhân không được index, cache dùng chung hoặc ghi raw log. Cần xác định trường được gửi và chính sách lưu giữ trước dùng dữ liệu thật.

## D4 — Câu hỏi kết hợp và đánh giá

- Ghép nguồn có kiểm soát, ví dụ booking hiện tại + chính sách đúng phiên bản; không tự tính khoản hoàn khi backend chưa có tool chỉ đọc phù hợp.
- Giới hạn tool calls, vòng điều phối và chi phí; không tạo agent loop không giới hạn.
- Chạy bộ đánh giá trong EVALUATION.md, ghi số liệu thật và hạn chế.
- Hoàn thiện tài liệu/lệnh chạy dựa trên implementation thực tế; báo rõ provider/dependency/dịch vụ đã cài.

## Quy tắc thực hiện

- Mỗi nhiệm vụ sau chỉ làm lát được giao, cập nhật `STATUS.md` và bằng chứng kiểm tra.
- Không tạo hàng loạt class/module giả chỉ để lấp cây thư mục.
- Không tự triển khai cloud, thêm vector database hoặc bật thao tác ghi booking/thanh toán khi chưa thuộc nhiệm vụ.
