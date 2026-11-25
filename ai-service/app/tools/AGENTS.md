# Tool definitions — truy xuất nghiệp vụ có giới hạn

- Kế thừa `ai-service/app/AGENTS.md`. Chứa mô tả, schema và lựa chọn tool; Spring là nơi thực thi nghiệp vụ và giữ quyền khách.
- Tool dự kiến: search_rooms, get_room_quote, list_services, list_my_bookings, get_my_booking. Tên/schema cuối cùng cần thống nhất trước khi triển khai.
- `get_room_quote` phải dùng phép tính giá backend thật; nếu backend chưa có khả năng cần thiết thì báo thiếu, không giả lập báo giá AI.
- Tool description nêu rõ khi dùng, tham số bắt buộc, đơn vị giá và cấu trúc kết quả; schema chặn trường thừa và tool ngoài allowlist.
- Booking tool không nhận username/customerId do model chọn. bookingCode chỉ là bộ lọc sau khi Spring kiểm tra ownership.
- Không khai báo tool SQL, HTTP tùy ý, đọc file tùy ý, booking creation, cancel, payment hoặc sửa hồ sơ.
- Call ID/result gắn với request đang chờ; không cho browser cung cấp tool result hoặc model tự xác nhận thành công.
- Kiểm tra chọn nhầm tool, thiếu tham số, đầu vào độc hại và vượt budget.
