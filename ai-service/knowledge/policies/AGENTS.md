# Policies — quy định gốc của khách sạn

- Kế thừa `ai-service/knowledge/AGENTS.md`.
- Chia theo chính sách: đặt cọc, hủy/hoàn tiền, nhận/trả phòng, trẻ em, phụ thu, thú cưng và quy định lưu trú thực có.
- Giữ nguyên điều kiện, mốc thời gian, đơn vị, ngoại lệ và version; không tự tạo mức hoàn tiền hoặc phụ thu.
- Phân biệt ngày hiệu lực tài liệu với chính sách áp dụng cho từng booking. Backend phải xác định policy/version của booking khi trả lời cá nhân.
- Khi phiên bản áp dụng chưa xác định hoặc các nguồn mâu thuẫn, trợ lý phải báo chưa đủ căn cứ; không tự chọn điều khoản có lợi hơn.
- Số tiền hoàn thực tế do service nghiệp vụ tính; RAG giải thích quy định, không thay calculator.
- Không sửa chính sách để khớp câu trả lời model; sửa nguồn qua quy trình duyệt và cập nhật snapshot.
