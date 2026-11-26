# Backend — Spring Boot/MySQL

- Tuân thủ `AGENTS.md` gốc. Giữ cấu trúc hiện có `controller/`, `service/`, `dto/`; các thư mục `assistant/` bên dưới dành cho tính năng mới.
- Spring là nơi xác thực JWT, kiểm tra quyền sở hữu booking, điều phối thực thi tool và ghép dữ liệu trả frontend.
- Tái sử dụng `ApiResponse`, security và service nghiệp vụ. Không nhân bản logic giá, tồn phòng, tiền cọc hoặc hoàn tiền sang AI.
- AI chỉ đề xuất tool call có schema; Spring kiểm tra allowlist, tham số và principal rồi mới thực thi.
- Không cho AI quyền SQL, HTTP tùy ý hoặc thao tác ghi. Không gọi endpoint public tra cứu bằng SĐT để thay quyền của khách đã đăng nhập.
- Luồng gợi ý phòng cũ đã được gỡ. Tích hợp Concierge mới theo hợp đồng riêng, tái sử dụng service nghiệp vụ và kiểm tra quyền ở Spring; không tạo lại proxy cũ.
- Đã triển khai `/api/assistant/chat` và `/api/assistant/reset` (`AssistantController`, `AssistantOrchestrator`, `AssistantToolBroker`, `AssistantSessions`, `AssistantClient`) cho D1–D4. Security matcher giữ phạm vi hẹp; JWT gửi lên nhưng không hợp lệ phải bị từ chối (401), không hạ xuống anonymous.
- Quyền sở hữu booking D3 đã được kiểm toán và khóa theo `ROLE_CUSTOMER` + FK `Customer.account.accountId == account.accountId` (xóa fallback `accountId`/email/SĐT chưa xác minh). Mọi thay đổi trên booking/history/auth vẫn phải giữ bất biến này và kiểm thử A không đọc được booking B.
- Mật khẩu/khóa ở môi trường; không ghi JWT hoặc toàn bộ tool payload vào log. Ghi request ID, tool name, kết quả phân quyền, thời gian và mã lỗi đã làm sạch.
