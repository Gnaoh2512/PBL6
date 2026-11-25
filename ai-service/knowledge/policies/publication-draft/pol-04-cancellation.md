---
document_id: "pbl6-publication-pol-04"
title: "Hủy đặt phòng — Academic Demo"
category: "policy"
version: "0.1.1"
status: "approved"
source_type: "AI_GENERATED_SYNTHETIC"
approval_status: "approved"
approved: true
approved_by: "user"
approved_at: "2026-11-22"
effective_from: 2026-11-22
effective_to: null
synthetic: true
source_ref: "synthetic:pbl6-academic-demo/hotel-policies-v0.1.1"
source_document_id: "synthetic-hotel-policies-academic-demo"
source_document_version: "0.1.1"
source_policy_id: "POL-04"
source_policy_version: "0.1.1"
derived_from: "../academic-demo-hotel-policies.md"
observed_at: "2026-11-22"
updated_at: "2026-11-22"
---

# POL-04 — Hủy đặt phòng (0.1.1)

> AI_GENERATED_SYNTHETIC · Academic Demo · approved: true. Người dùng duyệt nội dung ngày 22/11/2026; hiệu lực từ 22/11/2026, không áp hồi tố. Chưa rõ phiên bản hoặc tiền đã thu: cần nhân viên.

## POL-04-U01 Tỷ lệ hủy trước khi nhận phòng

- Chỉ áp cho booking đã xác nhận, chưa thực nhận phòng. Yêu cầu hợp lệ có booking, quyền người yêu cầu đã xác minh, ý muốn hủy rõ và dấu vết hệ thống tiếp nhận. Chưa rõ phiên bản/chứng từ/mốc thời gian cần nhân viên, không chỉ dựa mã đơn trong chat.
- Theo UTC+07:00, d = ngày đến − ngày hệ thống tiếp nhận yêu cầu hợp lệ; không dùng ngày xử lý. d≥3: hoàn 100%; d=1 hoặc 2: 50%; d≤0 nhưng chưa nhận phòng: 0% của phần cọc hiệu dụng, không phải tổng tiền đã trả hoặc mốc 72/48/24 giờ.
- Cọc yêu cầu là 30% tiền phòng sau giảm được chấp nhận trước thuế/dịch vụ, làm tròn HALF_UP VND nguyên. Cọc hiệu dụng=min(cọc yêu cầu, tiền phòng thực còn giữ có chứng cứ, gồm thuế phòng; tách dịch vụ/phí riêng).
- Hoàn phần cọc hiệu dụng theo tỷ lệ rồi làm tròn HALF_UP VND nguyên; phí là phần cọc hiệu dụng trừ phần được hoàn. Tiền phòng trả trước vượt cọc hiệu dụng không bị giữ chỉ vì đã trả nhiều. Không thêm thuế/phí hủy hoặc tiền đêm chưa dùng.
- Đơn chưa được xác nhận chờ cọc/hết hạn: không phí hủy, hoàn tiền chưa phân bổ sau xác minh. Sau nhận phòng không dùng bảng này. Lỗi cung ứng của khách sạn: quản lý xác minh phần chưa cung cấp để hoàn không phí; lý do cá nhân/ngoại lệ khác cần duyệt, không tự hoàn toàn bộ.

## POL-04-U02 Mốc tiếp nhận yêu cầu hủy hợp lệ

- Yêu cầu hủy hợp lệ khi xác định booking, quyền người yêu cầu được xác minh, ý muốn hủy rõ và hệ thống có dấu vết tiếp nhận. Mã booking trong chat không tự cấp quyền.
- Dùng thời điểm sự kiện có chứng cứ hệ thống tiếp nhận hợp lệ theo UTC+07:00, tách khỏi giờ xử lý của nhân viên. Tin chưa hợp lệ không tự tạo mốc; khi bổ sung để hợp lệ thì dùng mốc hợp lệ, không backdate. Không xác minh được hoặc nguồn xung đột thì nhờ nhân viên, không tự chọn ngày có lợi cho một bên.
- Ví dụ ngày đến 10/12/2026: nhận hợp lệ 07/12 23:59, xử lý 08/12 09:00 vẫn trước 3 ngày lịch; nhận hợp lệ 08/12 00:00 là trước 2 ngày, không xét đủ 72 giờ.
- Báo giá sửa chưa có hiệu lực không đổi ngày đến/cọc để tính hủy; đã có hiệu lực dùng thông số và phiên bản đã chốt. Hết hạn báo giá không phải hủy gốc; yêu cầu hủy gốc riêng chấm dứt báo giá chưa áp dụng, không thu hai phí.

## POL-04-U03 Không đến, rời sớm và ngoại lệ cung ứng

- UTC+07:00: không có thỏa thuận đến muộn còn hiệu lực và chưa nhận phòng thì mốc không đến là 00:00 ngày kế tiếp ngày đến. Sau 22:00 cần thỏa thuận trước, không hứa tiếp nhận 24/7.
- Booking đã xác nhận chưa nhận phòng khi không đến: giữ tối đa min(cọc yêu cầu, tiền phòng thực còn giữ có chứng cứ, gồm thuế phòng đã thu), không thêm phạt thứ hai hoặc thu đêm chưa dùng. Cọc yêu cầu là 30% tiền phòng sau giảm được chấp nhận trước thuế/dịch vụ, làm tròn HALF_UP VND nguyên.
- Booking chờ cọc/hết hạn chưa xác nhận không chịu phí hủy này; khoản chưa phân bổ được hoàn sau xác minh. Sau thực nhận phòng không áp bảng hủy trước nhận; rời sớm không tự hoàn đêm đã xác nhận, không thêm phí hủy phòng.
- Khách sạn không cung cấp phần lưu trú chưa dùng: quản lý xác minh khoản phòng chưa dùng đã thu để hoàn toàn bộ phần đó, không phí hủy; dịch vụ đã thực hiện đối soát riêng. Không tự tặng nâng hạng, dịch vụ hoặc bồi thường.
- Ngoại lệ cá nhân/đặc biệt cần quản lý duyệt có lý do; chưa rõ phân bổ, chứng từ, phiên bản hoặc chứng cứ thì cần nhân viên, chưa chốt số hoàn.

