# API nội bộ FastAPI

- Kế thừa `ai-service/app/AGENTS.md`. Chỉ chuyển đổi HTTP ↔ schema/use case; không chứa logic prompt, giá hay ownership.
- Contract plan/tool-result/final ở docs/API.md. Hiện chỉ có lớp biên/schema turn và health/readiness, chưa có chat hoặc tool execution thành công.
- Chỉ nhận request nội bộ từ backend đã xác thực; kiểm tra service credential theo cấu hình server. Không mở trực tiếp cho browser.
- Không nhận JWT khách; không coi `userId` hoặc `authenticated=true` trong JSON là quyền truy xuất.
- Áp dụng giới hạn payload, deadline, call/request ID và lỗi có mã an toàn; không lộ stack trace, credential hoặc prompt.
- Tách liveness khỏi readiness; readiness không được thành công khi dependency bắt buộc chưa sẵn sàng.
- Kiểm tra thiếu/sai service credential, schema lỗi, quá kích thước, timeout và replay/mismatch tool result.
