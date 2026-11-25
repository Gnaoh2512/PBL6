# Kho tri thức khách sạn — nguồn đã duyệt

- Kế thừa `ai-service/AGENTS.md`. Đây là nơi đặt tài liệu nghiệp vụ cho RAG. Đã có bản nháp tiếng Việt chờ người dùng duyệt; hiện chưa có nội dung khách sạn được duyệt.
- AGENTS.md chỉ là hướng dẫn phát triển, tuyệt đối không được ingestion đưa vào index.
- Mỗi tài liệu nghiệp vụ cần document_id, title, category, version, effective_from, effective_to nếu có, approved, source_ref và người/quy trình duyệt.
- Metadata là convention đề xuất; thống nhất schema trước khi tạo corpus. Không tự gắn approved cho tài liệu do model sinh.
- Không dùng nội dung demo làm chính sách thật. Dữ liệu synthetic phải tách sang tests/fixtures và có nhãn.
- Theo yêu cầu soạn nội dung để duyệt, được giữ bản nháp biên tập tại đây với approved=false, status=pending_review và effective_from=null. Đây không phải fixture synthetic; ingestion phải loại bản nháp khỏi index phục vụ khách, không tự đổi trạng thái duyệt.
- Không lưu booking, email/SĐT, giấy tờ, lịch sử chat, credential hoặc giá cần cập nhật live.
- Chỉ soạn nội dung có căn cứ trong database đang dùng hoặc nguồn chính thức đã được người dùng cung cấp. Ghi bảng/trường/ID và ngày đối chiếu; không dùng schema hoặc bản ghi lưu trú để suy thành chính sách chung.
- Không thêm mục tiện ích chỉ để đủ bộ FAQ. Không có dữ liệu thì bỏ mục, không kết luận tiện ích đó không tồn tại. Giữ approved=false cho dữ liệu lấy từ database chưa được người dùng duyệt.
- Quy định nguồn và phiên bản còn hiệu lực; thay đổi tài liệu phải kích hoạt build/kiểm tra snapshot và regression liên quan.
