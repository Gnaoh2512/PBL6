---
document_id: "pbl6-publication-pol-07"
title: "Thú cưng — Academic Demo"
category: "policy"
version: "0.1.0"
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
source_policy_id: "POL-07"
source_policy_version: "0.1.0"
derived_from: "../academic-demo-hotel-policies.md"
observed_at: "2026-11-22"
updated_at: "2026-11-22"
---

# POL-07 — Thú cưng (0.1.0)

> AI_GENERATED_SYNTHETIC · Academic Demo · approved: true. Người dùng duyệt nội dung ngày 22/11/2026; hiệu lực từ 22/11/2026, không áp hồi tố. Chưa rõ phiên bản hoặc tiền đã thu: cần nhân viên.

## POL-07-U01 Mặc định và yêu cầu ngoại lệ

- Mặc định không tiếp nhận thú cưng trong booking thông thường. Cần nêu yêu cầu trước khi đặt; chưa có chấp thuận thì không xác nhận khả năng tiếp nhận.
- Yêu cầu đặc biệt, gồm động vật hỗ trợ, cần quản lý xem xét trước khi xác nhận booking. Nếu được chấp thuận, điều kiện ghi cùng booking và phiên bản policy, không mở rộng cho khách khác.
- Không có ngoại lệ tự động theo kích thước/loài hoặc trả thêm tiền. Không có quyền tự dùng dịch vụ pet sitting, khu pet hoặc phụ phí pet khi chưa có nguồn.
- Đây là quy tắc hư cấu, không phải xác nhận đáp ứng nghĩa vụ pháp lý của khách sạn thực tế. Trường hợp chưa rõ cần nhân viên; trợ lý không tự chấp thuận động vật hỗ trợ.

## POL-07-U02 Không được chấp thuận hoặc xác nhận nhầm

- Thú cưng mặc định không được tiếp nhận; ngoại lệ phải được quản lý chấp thuận trước xác nhận booking, ghi điều kiện cùng đơn/phiên bản. Không tự có quyền vì pet nhỏ hoặc trả thêm tiền.
- Chưa được chấp thuận: khách chọn không đặt hoặc yêu cầu hủy hợp lệ, không mặc định miễn phí hủy. Với booking đã xác nhận chưa nhận phòng, tính ngày đến trừ ngày tiếp nhận yêu cầu hợp lệ theo UTC+07:00: ≥3 ngày hoàn 100%, 1–2 ngày 50%, ≤0 ngày 0% phần cọc hiệu dụng.
- Cọc yêu cầu bằng 30% tiền phòng sau giảm được chấp nhận trước thuế/dịch vụ, làm tròn HALF_UP VND nguyên. Cọc hiệu dụng=min(cọc yêu cầu trên booking, tiền phòng thực còn giữ có chứng cứ, gồm thuế phòng đã thu). Phần hoàn cọc làm tròn HALF_UP VND nguyên, phí là phần còn lại; không giữ tiền vượt cọc hoặc thu phạt thứ hai. Đơn chờ cọc/hết hạn chưa xác nhận không có phí hủy này; sau nhận phòng cần nhân viên xử lý riêng.
- Khách sạn xác nhận nhầm khả năng tiếp nhận rồi không thực hiện được: quản lý xác minh lỗi cung ứng và phần lưu trú chưa cung cấp đã thu để hoàn không phí hủy; dịch vụ đã dùng tách riêng. Không giữ phí như lỗi khách khi chưa đối soát, không tự đặt phí vệ sinh/hư hại pet.

