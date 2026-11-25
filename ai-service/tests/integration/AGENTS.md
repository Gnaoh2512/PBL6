# Integration tests — ranh giới hệ thống

- Kế thừa `ai-service/tests/AGENTS.md`.
- Kiểm tra contract Spring↔Python, xác thực service, call/result ID, timeouts, schema drift và lỗi upstream.
- Kiểm tra frontend↔Spring riêng: public FAQ, member booking, JWT hỏng và ownership trước khi dữ liệu đến model.
- Đo/ghi đúng payload tối thiểu; assert không có JWT, email/SĐT/giấy tờ hoặc booking khách khác trong context AI.
- Không dùng database khách thật. Các test cần MySQL/backend/model thật phải có cấu hình riêng, không tự chạy cloud tính phí.
- Phân biệt contract test có fake provider với integration thực có model; báo đúng giới hạn bằng chứng.
