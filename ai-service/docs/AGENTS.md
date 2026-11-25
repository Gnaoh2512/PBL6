# Tài liệu AI service

- Kế thừa `ai-service/AGENTS.md`.
- `architecture.md` là nguồn thiết kế tổng thể; `UI.md`, `EVALUATION.md` lần lượt mô tả giao diện và đánh giá cùng một trợ lý.
- `PROCESS.md` là nơi duy nhất cập nhật checklist, trạng thái, bằng chứng kiểm chứng, giới hạn và việc tiếp theo. Gộp nội dung trùng; không giữ bộ tài liệu ranker riêng đã được thay thế.
- Phân biệt quyết định người dùng đã chốt, đề xuất của người thiết kế và việc chưa kiểm chứng.
- Ghi nguồn Microsoft trực tiếp ở chỗ giải thích pattern. Cấu trúc thư mục là cách áp dụng của dự án, không phải cây thư mục Microsoft bắt buộc.
- Đường dẫn code, API, command phải đối chiếu repository. Không bịa endpoint giá/booking hoặc lệnh chạy FastAPI chưa có.
- Khi cập nhật một contract, đồng bộ tài liệu tích hợp và đánh giá liên quan.
- Đã chốt widget góc dưới bên phải và sáu nhóm chức năng. D1 đã chọn Gemini REST và SQLite FTS5/BM25; lựa chọn thay thế hoặc chi phí chưa đo phải ghi rõ, không coi thiết kế D2–D4 là runtime hiện hành.
- Chỉ thêm tài liệu khi có nội dung riêng cần được duy trì; không tạo bộ tài liệu assistant/ranker trùng lặp.
