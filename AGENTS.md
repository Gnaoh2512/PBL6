# Hướng dẫn repository — Hotel Management PBL6

## Đọc theo phạm vi
- Kiểm tra `git status` trước khi làm việc; giữ nguyên thay đổi chưa commit của người dùng.
- Đọc `AGENTS.md` ở thư mục con liên quan. Hướng dẫn con bổ sung ranh giới cho phần đó; yêu cầu trực tiếp của người dùng có ưu tiên cao nhất.
- Phạm vi trợ lý mới: `ai-service/docs/architecture.md`; lộ trình và đánh giá nằm cùng thư mục.
- Trợ lý có khung FastAPI/auth/schema/health/readiness; provider/index/RAG/widget chưa triển khai. Chỉ coi phần có bằng chứng kiểm thử là đã chạy.

## Kiến trúc và dữ liệu
- React/Vite ở `FE/`; Spring Boot/MySQL ở `BE/`; Python/FastAPI là hướng triển khai AI đã đề xuất.
- Spring sở hữu xác thực, quyền truy cập, dữ liệu nghiệp vụ, giá, tồn phòng và booking.
- FAQ/chính sách lấy từ tài liệu được khách sạn duyệt; dữ liệu thay đổi lấy từ service nghiệp vụ.
- Trợ lý phục vụ khách ở góc dưới bên phải. Phạm vi đầu chỉ đọc; các thao tác đặt/hủy/thanh toán đi qua màn hình nghiệp vụ hiện có.
- Không gửi JWT người dùng, khóa nội bộ, dữ liệu khách khác vào model, kho vector hoặc log.

## Làm việc và kiểm chứng
- Tái sử dụng code và convention; không tạo lại các file đang bị người dùng xóa trong working tree.
- Khi xong mỗi bước được giao, tạo nhánh riêng và commit đúng phạm vi theo yêu cầu người dùng; giữ staging ngoài nhiệm vụ. Không tự push/deploy. Không đưa `.env`, secrets, index hoặc dữ liệu booking thật vào Git.
- FE: dùng `npm ci`, `npm run dev`; BE: xem `BE/README.local.md`. Chỉ cài dependency khi nhiệm vụ triển khai thực sự cần.
- Khi thay đổi runtime, kiểm tra luồng bị tác động và phân quyền. Khi chỉ sửa tài liệu, kiểm tra liên kết, cây thư mục và tính nhất quán; không báo test runtime đã pass.
- Báo rõ đã đổi gì, đã kiểm tra gì, giới hạn và phần mềm/dịch vụ mới cài.
