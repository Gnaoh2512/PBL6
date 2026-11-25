# Fixtures — dữ liệu giả lập có kiểm soát

- Kế thừa `ai-service/tests/AGENTS.md`.
- Chỉ synthetic; dùng hai khách A/B và booking khác nhau để kiểm tra ownership, không lấy dump database đang chạy.
- Fixture thể hiện ngày, tiền tệ, đơn vị giá, trạng thái và policy version rõ; dữ liệu demo không phải chính sách thật.
- Tình huống tối thiểu: hết phòng, giá đổi, dịch vụ dừng, policy hết hiệu lực, nguồn thiếu, tool timeout, JWT lỗi và request giả mạo ID.
- Không chứa credential, token thật, tên/email/SĐT hoặc giấy tờ khách thật.
- Fixture không được ingestion index vào kho tri thức khách sạn. Chế độ test/demo tường minh được build index synthetic riêng theo `app/ingestion/AGENTS.md` tính từ ai-service; public/live không được chọn index này.
