---
document_id: "pbl6-publication-pol-02"
title: "Nhận và trả phòng — Academic Demo"
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
source_policy_id: "POL-02"
source_policy_version: "0.1.1"
derived_from: "../academic-demo-hotel-policies.md"
observed_at: "2026-11-22"
updated_at: "2026-11-22"
---

# POL-02 — Nhận và trả phòng (0.1.1)

> AI_GENERATED_SYNTHETIC · Academic Demo · approved: true. Người dùng duyệt nội dung ngày 22/11/2026; hiệu lực từ 22/11/2026, không áp hồi tố. Chưa rõ phiên bản hoặc tiền đã thu: cần nhân viên.

## POL-02-U01 Giờ chuẩn và phí nhận sớm

- Với booking đã xác nhận và đúng phiên bản, giờ UTC+07:00: nhận từ 14:00 ngày đến, trả không muộn hơn 12:00 ngày đi. Nhân viên xác minh người đại diện và phòng sẵn sàng qua luồng bảo vệ; không gửi giấy tờ vào chat.
- Nhận trước 06:00 cần xác nhận thêm đêm trước theo báo giá, không cộng phí nhận sớm cho cùng thời gian. Từ 06:00 đến trước 10:00: 50%; từ 10:00 đến trước 14:00: 30%; từ 14:00: phí nhận sớm bằng 0.
- Tỷ lệ tính trên giá đêm đầu đã ghi trong booking trước giảm giá/thuế, không lấy giá danh mục mới; làm tròn HALF_UP VND nguyên. Không áp voucher phòng thêm lần nữa lên phí; thuế demo 10% được tính một lần trong hóa đơn.
- Chỉ thu phí khi khách đồng ý và nhân viên xác nhận cung cấp được; ưu tiên thu lúc cung cấp. Thiếu giá, không có phòng hoặc chưa được duyệt: chưa báo phí cuối, giữ giờ chuẩn, không hứa nâng hạng/dịch vụ miễn phí.

## POL-02-U02 Phí trả muộn và ở quá giờ

- Với booking đã xác nhận, giờ UTC+07:00: trả phòng không muộn hơn 12:00 ngày đi. Trả đến 12:00 không phí muộn; sau 12:00 đến 15:00 tính 30%; sau 15:00 đến 18:00 tính 50%.
- Tỷ lệ tính trên giá đêm cuối đã ghi trong booking trước giảm giá/thuế, làm tròn HALF_UP VND nguyên; không lấy giá mới hoặc áp lại voucher phòng lên phí. Phí chịu thuế demo 10%, tính một lần trong hóa đơn.
- Sau 18:00 cần xác nhận thêm đêm theo báo giá; không cộng cả giá đêm và phí 50% cho cùng thời gian. Sau khi đã nhận phòng, thêm đêm cần nhân viên thỏa thuận và đối soát phần còn phải thu.
- Chỉ áp phí khi khách đồng ý và nhân viên xác nhận khả năng cung cấp; ưu tiên thu lúc cung cấp. Không có phòng/chưa được duyệt thì không có quyền ở thêm. Đã ở quá giờ chưa được duyệt: nhân viên ghi thỏa thuận xử lý, trợ lý không tự đặt tiền phạt. Thiếu giá chưa có số phí cuối.

## POL-02-U03 Hoàn phí nhận sớm hoặc trả muộn

- Ưu tiên thu phí nhận sớm/trả muộn khi thực sự cung cấp. Nếu thu trước nhưng phần thời gian đã thỏa thuận chưa được cung cấp, hủy hợp lệ được hoàn khoản phí và thuế đã thu tương ứng sau nhân viên xác minh.
- Đã cung cấp một phần: chỉ phần chưa cung cấp có chứng cứ và được nhân viên xác nhận đủ điều kiện mới được hoàn, gồm thuế tương ứng. Không tự hoàn phần đã cung cấp hoặc chia đều theo giờ khi báo giá không quy định.
- Mỗi phần tiền chỉ vào một hồ sơ hoàn, tách tiền phòng, dịch vụ và tiền chưa phân bổ; không áp tỷ lệ phạt hủy phòng lên khoản phí đủ điều kiện này. Thuế đã nằm trong khoản hoàn không cộng lần nữa; không hoàn quá tiền còn giữ sau các lệnh đã hoàn/đang xử lý.
- Thiếu chứng cứ phần đã cung cấp, phân bổ thuế, chứng từ hoặc phiên bản thì chuyển nhân viên, chưa báo số cuối. Ví dụ đã thu 255.000 phí +25.500 thuế, chưa cung cấp: khoản đủ điều kiện là 280.500; đây là số minh họa, không phải báo giá hiện tại.
- Rời sớm sau nhận phòng không tự làm các đêm đã xác nhận được hoàn; lỗi cung ứng cần quản lý xác minh phần chưa cung cấp, không tự hứa quyền lợi bù thêm.

## POL-02-U04 Thêm đêm trước khi nhận phòng

- Nhận trước 06:00 ngày đến cần xác nhận thêm đêm trước theo báo giá, không cộng thêm phí nhận sớm cho cùng thời gian. Chỉ áp khi phòng sẵn sàng và khách đồng ý; thiếu giá chưa thể báo số cuối.
- Với booking đã xác nhận chưa thực nhận phòng, thêm đêm là sửa booking ưu tiên thay vì hủy/đặt lại. Nhân viên phải xác nhận báo giá đúng phiên bản báo giá, giá/giảm giá/cọc/tiền bổ sung, giờ nhận/trả và khả năng cung ứng.
- Báo giá có hạn 15 phút từ lúc phát hành, UTC+07:00. Chấp nhận đúng phiên bản báo giá và đủ tiền bổ sung theo chứng cứ giao dịch phải trước hạn, bằng hạn là quá hạn. Cọc phòng thực còn giữ, chưa dành cho hoàn khác, được tính vào cọc mới; không thu cọc hai lần.
- Chỉ đổi booking khi đủ chấp nhận, tiền và khả năng cung ứng. Báo giá hết hạn chưa đủ điều kiện chỉ bỏ phần sửa, không tự hủy/phạt gốc; tiền bổ sung chưa áp dụng được hoàn sau đối soát. Đơn đang chờ cọc/đã nhận phòng hoặc ngoại lệ cần nhân viên xử lý riêng.

