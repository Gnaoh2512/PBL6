---
document_id: faq-booking-guide
title: "Thông tin đặt phòng được dữ liệu hệ thống hỗ trợ"
category: faq
version: "0.2.0-draft"
status: pending_review
approved: false
approved_by: null
approved_at: null
effective_from: null
effective_to: null
source_ref: "schema:hotel_management/booking,booking_room,room,room_type,payment,invoice,service_usage"
observed_at: "2026-11-13"
updated_at: "2026-11-13"
---

# Thông tin đặt phòng được hệ thống hỗ trợ

> Bản nháp chờ duyệt. Nội dung căn cứ cấu trúc dữ liệu; không sao chép bản ghi booking, thanh toán, hóa đơn hoặc thông tin khách thật.

## BG-01 — Cần thông tin gì để tra phòng?

Ngày nhận phòng, ngày trả phòng và số khách là các thông tin lưu trong booking. Loại phòng lưu sức chứa và mô tả tiện nghi; phòng thực tế liên kết với loại phòng. Backend sử dụng yêu cầu và dữ liệu nghiệp vụ để kiểm tra lựa chọn phù hợp, không thể kết luận khả dụng chỉ từ mô tả hạng phòng.

## BG-02 — Booking có thể chứa những thông tin nào?

Cấu trúc booking có mã đơn, ngày nhận/trả dự kiến, số khách, trạng thái và khoản cọc yêu cầu. Bảng booking_room liên kết phòng với booking, giá áp dụng và thời điểm nhận/trả thực tế. Chỉ cung cấp dữ liệu của booking sau khi backend kiểm tra quyền của người đang đăng nhập.

## BG-03 — Ngày đặt phòng có cho biết giờ nhận phòng chuẩn không?

Ngày nhận/trả dự kiến và thời điểm nhận/trả thực tế là dữ liệu của kỳ lưu trú. Chúng không phải chính sách giờ nhận/trả chuẩn của khách sạn. Database được khảo sát chưa có nguồn chính sách đó, vì vậy tài liệu không đưa ra giờ chuẩn hoặc phí nhận sớm/trả muộn.

## BG-04 — Có thể xem thông tin tiền phòng và thanh toán nào?

Cấu trúc dữ liệu có giá áp dụng của phòng, khoản cọc yêu cầu, khoản thanh toán, tiền phòng, dịch vụ, thuế, giảm giá và tổng hóa đơn. Nội dung và số tiền cụ thể phải lấy từ backend sau xác thực/phân quyền. Không dùng số liệu của booking khác làm ví dụ hoặc suy ra mọi đơn có cùng điều kiện.

## BG-05 — Dữ liệu có xác định chính sách hủy và hoàn tiền không?

Booking có trạng thái, lý do và thời điểm hủy; các trường này ghi nhận xử lý của từng đơn. Chúng không quy định điều kiện hủy chung, tỷ lệ hoàn, thời hạn hoàn hoặc phiên bản chính sách áp dụng. Tài liệu không tự xây bảng hoàn tiền từ schema hoặc lịch sử giao dịch.

## BG-06 — Xem booking cá nhân như thế nào?

Truy cập tài khoản đã liên kết và sử dụng luồng tra cứu cá nhân do backend kiểm soát. Mã booking chỉ là khóa tra cứu, không phải bằng chứng quyền sở hữu. Không cung cấp booking của người khác, cũng không dùng thông tin trong hội thoại thay kết quả xác thực.

## BG-07 — Có thể xem dịch vụ đã sử dụng không?

service_usage liên kết dịch vụ với booking, lưu số lượng, giá áp dụng, khoản giảm và tổng tiền. Đây là dữ liệu riêng của kỳ lưu trú, chỉ được tra cứu sau kiểm tra quyền; không đưa lịch sử sử dụng vào knowledge dùng chung.
