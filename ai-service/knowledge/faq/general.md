---
document_id: faq-general
title: "Câu hỏi về phòng và dịch vụ có trong database"
category: faq
version: "0.2.0-draft"
status: pending_review
approved: false
approved_by: null
approved_at: null
effective_from: null
effective_to: null
source_ref: "database:hotel_management/room_type,service,service_category"
observed_at: "2026-11-13"
updated_at: "2026-11-13"
---

# Câu hỏi về phòng và dịch vụ

> Bản nháp chờ duyệt, biên soạn từ danh mục database tại thời điểm khảo sát. Giá, tồn phòng và trạng thái dịch vụ khi khách hỏi phải kiểm tra lại bằng backend.

## FAQ-01 — Có những hạng phòng nào?

Danh mục hiện ghi nhận Phòng Standard, Phòng Deluxe Hướng Biển và Phòng Suite Gia Đình. Standard và Deluxe có sức chứa 2 khách; Suite Gia Đình có sức chứa 4 khách theo trường capacity của từng hạng phòng.

Nguồn: bảng `room_type`, ID `1`, `2`, `3`. Chi tiết xem [Danh mục phòng](room-catalog.md), document `room-catalog`, version `0.1.0-draft`.

## FAQ-02 — Hạng phòng nào có Wi-Fi?

Mô tả tiện nghi của Phòng Standard ghi Wi-Fi tốc độ cao; Phòng Deluxe Hướng Biển ghi Wi-Fi. Danh sách tiện nghi của Phòng Suite Gia Đình chưa ghi thông tin này, vì vậy không suy ra có hoặc không có Wi-Fi cho hạng Suite.

Database không cung cấp mật khẩu, giá Wi-Fi hoặc phạm vi phủ sóng; tài liệu không bổ sung các thông tin đó.

## FAQ-03 — Phòng nào có hướng biển?

Phòng Deluxe Hướng Biển có mô tả view biển và tiện nghi ban công ngắm cảnh biển. Nội dung này áp dụng cho hạng phòng có ID `2`, không áp dụng chung cho mọi phòng.

## FAQ-04 — Đi nhóm 4 người nên xem hạng phòng nào?

Phòng Suite Gia Đình có sức chứa 4 khách, mô tả diện tích 65 m², hai giường King, phòng khách riêng, bếp mini, bồn tắm massage và sofa bed. Việc đặt còn phụ thuộc phòng trống theo ngày lưu trú; không tăng sức chứa lên quá 4 chỉ vì mô tả có sofa bed.

## FAQ-05 — Có bữa sáng không?

Danh mục dịch vụ ghi nhận Bữa sáng Buffet, service ID `2`, đơn vị Suất, đang hoạt động tại thời điểm khảo sát. Database được đọc chưa thể hiện dịch vụ này đã bao gồm trong giá của từng hạng phòng; không mặc định ăn sáng miễn phí hoặc tặng kèm.

## FAQ-06 — Có dịch vụ giặt ủi không?

Danh mục ghi nhận Giặt ủi quần áo nhanh, service ID `3`, đơn vị Kg, đang hoạt động tại thời điểm khảo sát. Giờ tiếp nhận, thời gian hoàn thành, loại vải và điều kiện đổi/hủy chưa có trong danh mục đã đọc, vì vậy chưa tạo quy định về các nội dung này.

## FAQ-07 — Có dịch vụ nước uống nào?

Danh mục ghi nhận Nước khoáng Lavie 500ml, service ID `1`, đơn vị Chai, thuộc nhóm Ẩm thực & Đồ uống (F&B). Không suy ra nước uống được tặng miễn phí trong phòng.

## FAQ-08 — Giá và phòng trống được xác định như thế nào?

Database lưu giá cơ sở theo hạng phòng và dữ liệu phòng/booking theo thời gian. Để biết lựa chọn còn trống và giá áp dụng cho yêu cầu cụ thể, cần tra cứu backend với ngày nhận phòng, ngày trả phòng và số khách. Tài liệu này không lưu giá hoặc số phòng trống cố định.

Nguồn dịch vụ: bảng `service` và `service_category`. Hướng dẫn danh mục xem [Dịch vụ](../services/usage-guide.md), document `service-usage-guide`, version `0.2.0-draft`.
