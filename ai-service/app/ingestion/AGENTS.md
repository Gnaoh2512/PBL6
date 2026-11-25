# Ingestion offline — chuẩn bị nguồn RAG

- Kế thừa `ai-service/app/AGENTS.md`. Chế độ corpus khách sạn chỉ đọc nguồn từ `ai-service/knowledge` trong allowlist, validate và tạo snapshot dẫn xuất.
- Không glob toàn bộ repository. Loại mọi AGENTS.md/README.md hướng dẫn, secrets, file ẩn, fixture và dữ liệu cá nhân khỏi corpus khách sạn.
- Ngoại lệ test/demo tường minh: được đọc fixture synthetic trong `ai-service/tests/fixtures` vào index test riêng, manifest có nhãn synthetic. Không ghi đè snapshot khách sạn, không cho cấu hình public/live chọn index test và không tự fallback sang fixture khi thiếu nguồn. Demo dùng index này phải hiện rõ nhãn dữ liệu giả lập.
- Chỉ index tài liệu có metadata hợp lệ và đã duyệt; tài liệu thiếu hiệu lực/nguồn phải bị từ chối hoặc cách ly có báo cáo.
- Chia chunk theo cấu trúc tiêu đề/điều khoản, giữ ID/version/section/checksum và liên kết nguồn. Không cắt mất điều kiện hay ngoại lệ của chính sách.
- Chuẩn hóa tiếng Việt giữ dấu; lưu embedding model revision và tham số chunking trong manifest.
- Xây snapshot mới rồi kiểm tra trước khi chuyển sang snapshot active; không để retrieval đọc index ghi dở. Quy định đường dẫn output/ignore trước lần tạo index đầu tiên.
- Không crawl URL do khách gửi và chưa tạo upload API. Không đưa booking, số điện thoại/email khách hoặc hội thoại cá nhân vào index.
- Kiểm tra nguồn chưa duyệt, checksum đổi, policy bị rút, index lỗi và tái lập snapshot.
