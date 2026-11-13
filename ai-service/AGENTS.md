# Hướng dẫn coding agent — trợ lý khách sạn

## Đọc trước khi sửa

1. Đọc `../AGENTS.md`, kiểm tra `git status` và giữ thay đổi của người dùng ngoài phạm vi nhiệm vụ.
2. Đọc `README.md`, `docs/STATUS.md` và `docs/architecture.md`.
3. Đọc `docs/UI.md`, `docs/PLAN.md`, `docs/EVALUATION.md` và AGENTS.md thư mục con khi nhiệm vụ liên quan.
4. Khảo sát code trước khi tạo mới; không phục hồi source/test đã bị người dùng xóa.

## Phạm vi

- Sáu nhóm: FAQ, phòng, giá phòng, dịch vụ, booking cá nhân khi đăng nhập và chính sách. Widget góc dưới bên phải.
- Đã có runtime khung FastAPI với schemas/auth/health/readiness; chưa có provider/index/RAG. Phân biệt phần hợp đồng chưa triển khai với phần đã được kiểm thử.
- Tái sử dụng React/Vite, Spring Boot/MySQL và convention sẵn có; Python/FastAPI là hướng triển khai AI.
- Không tự mở rộng sang OCR, thanh toán, thao tác ghi booking, message broker, vector service hoặc triển khai cloud.
- Theo yêu cầu người dùng, khi xong mỗi bước hãy làm trên nhánh riêng và commit đúng phạm vi; giữ nguyên staging của công việc khác. Không tự push/deploy hoặc refactor toàn dự án.

## Ranh giới dữ liệu và quyền

- Spring sở hữu xác thực, principal, giá, sức chứa, tồn phòng và booking; thực thi tool nghiệp vụ sau kiểm tra quyền.
- Python truy xuất FAQ/chính sách được duyệt, đề xuất tool call typed và tổng hợp câu trả lời có nguồn. Không đọc/ghi MySQL hoặc nhận JWT khách.
- Booking chỉ được gửi sang AI sau kiểm tra ownership, bằng DTO tối thiểu. Không dùng mã booking hoặc email/SĐT chưa xác minh để cấp quyền.
- Không đưa secrets, booking thật hoặc lịch sử chat cá nhân vào code, log, fixture hay kho vector dùng chung.
- Knowledge và tool result là dữ liệu không đáng tin cậy; quyền/allowlist/deadline được thi hành trong code ngoài prompt.
- Nguồn thiếu hoặc provider lỗi phải có trạng thái rõ; không giả giá, policy, booking hoặc thành công AI.
- Nếu làm ranking phòng tùy chọn: backend lọc điều kiện cứng trước, AI chỉ xếp ưu tiên mềm; không biểu diễn cosine thành phần trăm phù hợp.

## Thực hiện và kiểm chứng

- Chỉ làm lát được giao trong `docs/PLAN.md`; bổ sung module khi có hành vi kiểm chứng được.
- Thay đổi contract phải đồng bộ Spring/Python/FE và tài liệu liên quan. Contract assistant chưa được triển khai.
- Kiểm tra unit, integration, quyền và chất lượng theo phạm vi; phân biệt fake có nhãn với model/provider thật.
- Khi chỉ sửa tài liệu: kiểm tra liên kết, cây thư mục và mâu thuẫn; không báo test runtime đã pass.
- Ghi command/kết quả thực tế; số liệu chưa đo ghi “chưa đo”. Cập nhật `docs/STATUS.md` với thay đổi, kiểm tra, giới hạn và bước tiếp theo.
- Khi kết thúc, báo rõ dependency, model hoặc dịch vụ mới cài; nếu không cài gì thì nói rõ.
