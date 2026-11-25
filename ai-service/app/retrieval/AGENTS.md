# Retrieval — tìm bằng chứng trong tài liệu

- Kế thừa `ai-service/app/AGENTS.md`. Chỉ tìm FAQ/chính sách/hướng dẫn được duyệt; không truy xuất booking hoặc lịch sử chat cá nhân.
- Đầu vào gồm query và bộ lọc metadata đã validate; đầu ra gồm chunk text, document ID/version, section, nguồn và score gốc.
- Lọc approved/category/hiệu lực trước khi đưa evidence vào model. Với câu hỏi chính sách cho booking cũ, cần backend xác định phiên bản áp dụng; không tự dùng bản mới nhất.
- Không đưa file AGENTS.md, README hướng dẫn phát triển hoặc fixture vào index khách sạn.
- Bắt đầu với cách tìm kiếm tối thiểu đo được; keyword/vector/hybrid phải có nhãn rõ và được so trên cùng dữ liệu.
- Không tự đặt ngưỡng từ chối theo cảm giác; đánh giá trên dev set. Không đủ evidence thì báo trạng thái rõ.
- Không đổi cosine thành phần trăm tin cậy. Lưu model revision/snapshot ID để tái lập kết quả.
- Kiểm tra lọc hết hiệu lực, tài liệu mâu thuẫn, trích dẫn chính xác và passage chứa prompt injection.
