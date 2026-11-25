# Knowledge tiếng Việt theo database — chờ duyệt

Ngày đối chiếu: 2026-11-13. Nguồn: database MySQL `hotel_management` trong container `mysql-db` đang chạy; không chỉ dựa trên file SQL seed. Các bản ghi danh mục có thể là dữ liệu mẫu của dự án, chưa phải xác nhận vận hành ngoài thực tế.

Tất cả tài liệu để approved=false, pending_review và chưa có ngày hiệu lực. Không đưa vào index phục vụ khách trước khi bạn duyệt. README.md và AGENTS.md là hướng dẫn quản lý, không phải nguồn RAG.

## Tài liệu có dữ liệu đối chiếu

| File | Nguồn | Nội dung |
| --- | --- | --- |
| [FAQ chung](faq/general.md) | room_type, service, service_category | Các loại phòng, Wi-Fi theo hạng, hướng biển, sức chứa, ăn sáng, nước uống và giặt ủi |
| [Danh mục phòng](faq/room-catalog.md) | room_type ID 1, 2, 3 | Tên, sức chứa, mô tả và tiện nghi đúng từng hạng |
| [Thông tin booking](faq/booking-guide.md) | Schema booking, booking_room, payment, invoice, service_usage | Trường dữ liệu hệ thống có thể tra cứu; không xuất dữ liệu khách |
| [Danh mục dịch vụ](services/usage-guide.md) | service ID 1, 2, 3 và service_category | Tên, nhóm, đơn vị; giá/trạng thái lấy lại từ backend |

## Nội dung đã loại

- Không có nguồn trong database được khảo sát cho bãi xe, giữ hành lý, thú cưng, khu hút thuốc, hồ bơi, phòng tập hoặc đưa đón; không tạo FAQ/chính sách về các tiện ích này.
- Không có nguồn quy định giờ nhận/trả chuẩn, mức phí ngoài giờ, độ tuổi trẻ em, giường phụ, nội quy, tỷ lệ cọc/hoàn hay thời hạn hoàn; đã bỏ bốn bản nháp chính sách suy đoán.
- Không có dữ liệu không đồng nghĩa khách sạn chắc chắn không cung cấp. Chỉ bổ sung tài liệu khi có nguồn chính thức mới và được bạn duyệt.

Thư mục policies tạm chỉ giữ AGENTS.md cho việc bổ sung nguồn chính sách sau này.

## Nguyên tắc duyệt và cập nhật

- Kiểm tra tên/phân loại/tiện nghi có đúng dữ liệu muốn dùng cho khách sạn hay còn là dữ liệu seed cần sửa.
- Chỉ duyệt sau khi xác nhận nội dung; cập nhật người duyệt, thời điểm duyệt, phiên bản, nguồn và hiệu lực. Không tự điền ngày khảo sát thành ngày hiệu lực.
- Mô tả danh mục cần được làm mới khi database đổi. Giá, tồn phòng, trạng thái dịch vụ và booking riêng luôn tra qua backend, không lấy từ knowledge tĩnh.
- Không lưu bản ghi account/customer, booking, giấy tờ, liên hệ hoặc giao dịch của khách vào corpus dùng chung.
