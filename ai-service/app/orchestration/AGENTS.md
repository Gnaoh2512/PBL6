# Điều phối hội thoại

- Kế thừa `ai-service/app/AGENTS.md`. Nhận câu hỏi, chọn nguồn, hỏi bổ sung và tổng hợp câu trả lời có bằng chứng.
- Sáu ý định: FAQ, chính sách, phòng, giá, dịch vụ, booking cá nhân; câu hỏi kết hợp có thể cần nhiều nguồn.
- FAQ/chính sách gọi retrieval; nghiệp vụ tạo tool call typed để Spring thực thi. Python không tự thêm account hoặc gọi SQL/URL do model sinh.
- Thiếu ngày/số khách hoặc tham chiếu booking mơ hồ thì hỏi lại; không tự dùng booking đầu tiên hay khoảng ngày suy đoán.
- Giữ call budget, deadline và token cap toàn request; kết quả lỗi không kích hoạt lặp vô hạn.
- Chỉ dùng evidence thực nhận; citation phải khớp chunk ID/version. Không tính lại số tiền hoặc tạo chính sách ngoài nguồn.
- Giới hạn lịch sử hội thoại; lịch sử không phải nguồn chứng minh giá, booking hoặc quyền. Quyền luôn do Spring kiểm tra lại.
- Kiểm tra follow-up, câu hỏi nhiều nguồn, không đủ nguồn, tool bị từ chối và model đề xuất tool không hợp lệ.
