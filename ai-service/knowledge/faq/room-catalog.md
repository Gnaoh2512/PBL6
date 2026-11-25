---
document_id: room-catalog
title: "Hạng phòng và tiện nghi theo database"
category: room_catalog
version: "0.1.0-draft"
status: pending_review
approved: false
approved_by: null
approved_at: null
effective_from: null
effective_to: null
source_ref: "database:hotel_management/room_type;ids=1,2,3"
observed_at: "2026-11-13"
updated_at: "2026-11-13"
---

# Hạng phòng và tiện nghi

> Bản nháp chờ duyệt, chỉ phản ánh các trường type_name, capacity, description và amenities đã đọc từ bảng room_type. Đây là danh mục, không phải xác nhận còn phòng theo ngày.

## ROOM-01 — Phòng Standard

- Mã hạng phòng: `1`.
- Sức chứa theo database: 2 khách.
- Mô tả nguồn: phòng tiêu chuẩn 1 giường đôi, đầy đủ tiện nghi, sạch sẽ thoáng mát.
- Tiện nghi ghi nhận: Wi-Fi tốc độ cao, TV màn hình phẳng, điều hòa hai chiều, bình nóng lạnh.

Không bổ sung diện tích, hướng nhìn, ăn sáng hoặc chính sách giường phụ vì các trường đã đọc không ghi những thông tin đó cho hạng này.

## ROOM-02 — Phòng Deluxe Hướng Biển

- Mã hạng phòng: `2`.
- Sức chứa theo database: 2 khách.
- Mô tả nguồn: phòng cao cấp view biển lãng mạn, nội thất hiện đại.
- Tiện nghi ghi nhận: Wi-Fi, TV 4K, điều hòa, bồn tắm ngâm, ban công ngắm cảnh biển, minibar.

Minibar là tiện nghi được ghi trong mô tả; không có căn cứ để khẳng định đồ dùng trong minibar miễn phí. Database chưa ghi loại giường hoặc diện tích cho hạng này trong các trường đã đọc.

## ROOM-03 — Phòng Suite Gia Đình

- Mã hạng phòng: `3`.
- Sức chứa theo database: 4 khách.
- Mô tả nguồn: phòng VIP không gian rộng rãi 65 m², thích hợp cho gia đình hoặc nhóm bạn.
- Tiện nghi ghi nhận: 2 giường King, phòng khách riêng, bếp mini, bồn tắm massage, sofa bed.

Không tăng sức chứa theo số chỗ ngủ suy đoán. Các tiện nghi không được liệt kê cho hạng này không được tự động sao chép từ Standard hoặc Deluxe.

## ROOM-04 — Cập nhật và tra cứu

Khi tên, mô tả, sức chứa hoặc tiện nghi trong room_type thay đổi, tài liệu phải được đối chiếu và duyệt lại. Giá và phòng trống luôn lấy từ backend tại thời điểm tra cứu, không lấy từ bản mô tả này.
