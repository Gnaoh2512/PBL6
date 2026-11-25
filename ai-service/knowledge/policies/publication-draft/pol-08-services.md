---
document_id: "pbl6-publication-pol-08"
title: "Chính sách sử dụng dịch vụ — Azure Bay"
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
source_policy_id: "POL-08"
source_policy_version: "0.1.1"
derived_from: "../academic-demo-hotel-policies.md"
observed_at: "2026-11-22"
updated_at: "2026-11-22"
---

# POL-08 — Sử dụng dịch vụ (0.1.1)

> AI_GENERATED_SYNTHETIC · Academic Demo · approved: true. Người dùng duyệt nội dung ngày 22/11/2026; hiệu lực từ 22/11/2026, không áp hồi tố. Chưa rõ phiên bản hoặc tiền đã thu: cần nhân viên.

## POL-08-U01 Điều kiện nhận yêu cầu dịch vụ

- Chỉ nhận dịch vụ trong danh mục được nhóm dùng và xác nhận đang đang hoạt động, có đúng đơn vị, giá được chấp nhận và số lượng nguyên dương; qua luồng có quyền với đúng booking/phòng.
- Dịch vụ trong kỳ lưu trú cần booking đã thực nhận phòng; trước nhận phòng như Airport Transfer do nhân viên xử lý riêng.
- Ngừng hoạt động hoặc chưa rõ đang hoạt động/giá: chưa xác nhận cung cấp. Giá thiếu/không rõ không tự coi là 0; số lượng không hợp lệ không tự sửa thành 1 để nhận đơn.
- Tên Express, 45 mins hoặc Full Day không tự cam kết giờ mở cửa/thời hạn đáp ứng; chi tiết phải được nhân viên xác nhận trước đặt. Ngoài danh mục hoặc yêu cầu riêng chưa có báo giá thì nhờ nhân viên, không tự tạo tên/mức phí.
- Không mặc định phòng gồm ăn sáng/minibar/gói welcome; quyền lợi voucher/loyalty chỉ dùng khi có bằng chứng riêng, không trừ hai lần. Không tự giảm giá dịch vụ theo tuổi.

## POL-08-U02 Ghi phí, hủy và sử dụng một phần

- Chỉ tính dòng dịch vụ đã chấp nhận có giá áp dụng; tổng dòng trước thuế = số lượng×giá áp dụng−giảm dòng. Không tính một lần dùng hai lần từ yêu cầu và ghi nhận sử dụng, không trừ giảm dòng hai lần.
- Chỉ đặt dịch vụ đang hoạt động có giá/đơn vị được xác nhận, số lượng nguyên dương, đúng quyền booking/phòng. Trong kỳ lưu trú cần đã thực nhận phòng; trước nhận phòng cần nhân viên xử lý riêng.
- Được nhân viên xác nhận hủy trước bắt đầu: không thu hoặc hoàn phần trả trước, gồm thuế đã thu tương ứng, tách khỏi phí hủy phòng. Ưu tiên thu khi cung cấp.
- Đã bắt đầu/hoàn thành không tự miễn phí hoặc hoàn hết; chỉ phần chưa cung cấp có chứng cứ được nhân viên xác nhận đủ điều kiện mới hoàn. Không tự suy tỷ lệ; thiếu chứng cứ sử dụng/thuế thì chưa có số cuối.
- Khoản hoàn gồm thuế không cộng lại thuế; không trùng hồ sơ hủy phòng/hoàn thu thừa hoặc vượt tiền giữ sau phần đã hoàn/đang xử lý. Dịch vụ đã dùng hoặc tranh chấp chuyển nhân viên xem xét, không tự cấp bồi thường.

## POL-08-U03 Đơn vị catalogue và ví dụ phí

- Trong bộ dữ liệu giả lập: Breakfast Set ID 1 theo person, Airport Transfer ID 2 theo trip, Express Laundry 3kg ID 3 theo package. Gói 3kg không phải giá mỗi Kg; phải xác minh danh mục/giá/đang hoạt động đúng nguồn trước nhận yêu cầu.
- Chỉ nhận số lượng nguyên dương, giá/đơn vị đã chấp nhận, đúng quyền booking/phòng; trong kỳ lưu trú cần đã thực nhận phòng, trước nhận phòng cần nhân viên xử lý riêng. Chưa rõ thì chưa xác nhận, không đổi số lượng thành 1 hay giá thiếu thành 0.
- Ví dụ hai package laundry giá 120.000/package: trước thuế 240.000, thuế demo 10% là 24.000, tổng 264.000; không phải hai Kg. Hai Breakfast Set theo giá minh họa 180.000/person là 360.000 trước thuế; không tự giảm theo tuổi.
- Đây là minh họa số của dữ liệu giả lập, không phải báo giá hiện tại. Thuế HALF_UP VND nguyên tính một lần trên tổng tiền phòng+dòng dịch vụ+phí sớm/muộn trước giảm hóa đơn; không cộng thuế dòng lại lần nữa. Không mặc định dịch vụ miễn phí hoặc đã nằm trong giá phòng.

