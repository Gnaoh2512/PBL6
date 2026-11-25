# Hướng dẫn dịch vụ

- Kế thừa `ai-service/knowledge/AGENTS.md`.
- Chứa mô tả cách dùng/đặt dịch vụ, điều kiện sử dụng và hướng dẫn được duyệt; liên kết service ID khi có.
- Danh sách đang hoạt động, giá, giờ phục vụ hoặc khả dụng có thể thay đổi phải lấy từ nguồn backend tương ứng.
- Nếu backend chưa có giờ phục vụ/availability, chỉ dùng tài liệu hiệu lực đã xác minh hoặc nói chưa có dữ liệu; không suy ra từ tên dịch vụ.
- Không ghi booking đang sử dụng dịch vụ, thông tin khách hoặc hóa đơn vào kho này.
- Tài liệu dịch vụ dừng hoạt động cần bị rút/lọc khỏi kết quả live; không để bản index cũ khẳng định còn đặt được.
