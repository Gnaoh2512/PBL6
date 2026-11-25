---
document_id: "pbl6-publication-pol-03"
title: "Chính sách đặt cọc và thanh toán — Azure Bay"
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
source_policy_id: "POL-03"
source_policy_version: "0.1.1"
derived_from: "../academic-demo-hotel-policies.md"
observed_at: "2026-11-22"
updated_at: "2026-11-22"
---

# POL-03 — Đặt cọc và thanh toán (0.1.1)

> AI_GENERATED_SYNTHETIC · Academic Demo · approved: true. Người dùng duyệt nội dung ngày 22/11/2026; hiệu lực từ 22/11/2026, không áp hồi tố. Chưa rõ phiên bản hoặc tiền đã thu: cần nhân viên.

## POL-03-U01 Nghĩa vụ cọc và chứng cứ thanh toán

- Cọc bằng 30% tổng tiền phòng sau giảm phòng/voucher được chấp nhận, trước thuế/dịch vụ, làm tròn HALF_UP đến VND nguyên. Đây là ứng trước khấu trừ hóa đơn, không phải phí đặt chỗ hoặc cọc tài sản.
- Đủ cọc trước lúc tạo đơn +15 phút (UTC+07:00) và phòng được xác nhận giữ mới xác nhận đơn. Được góp nhiều khoản trong cửa sổ; bằng hạn là quá hạn. Thiếu tới hạn: đơn hết hạn, khoản chưa phân bổ hoàn sau xác minh, không phí hủy booking đã xác nhận.
- Tiền mặt tại quầy hoặc chuyển khoản được đối soát; không hứa mọi thẻ/ví. Nhân viên kiểm tra quyền, VND, phân bổ, chứng từ và mốc thời gian. Chờ ngân hàng/xác minh hoặc trạng thái đơn không chứng minh đã trả; không ghi trùng.
- Thời điểm đủ cọc là thời điểm giao dịch đáng tin muộn nhất trong tập cần để đủ, không phải lúc xử lý. Ảnh khách gửi không đủ; chứng cứ muộn/xung đột cần nhân viên, không tự khôi phục/cấp phòng trùng.
- Cọc bằng 0, kể cả tiền phòng dương nhưng làm tròn, cần nhân viên xác nhận, không giao dịch 0; vẫn có thể còn thuế/dịch vụ. Thiệt hại cần chứng cứ và thỏa thuận nhân viên, không tự thêm cọc hư hại.

## POL-03-U02 Công thức hóa đơn demo

- Số tiền là VND; G là tổng tiền phòng các đêm trước giảm; S là tổng dòng dịch vụ đã vào hóa đơn, mỗi dòng = số lượng × giá áp dụng − giảm dòng; E là tổng phí sớm/muộn đã chấp thuận trước thuế. Không trừ giảm dòng hai lần.
- Thuế demo Tax = làm tròn HALF_UP[10% × (G+S+E)] đến VND nguyên, trước giảm hóa đơn. A_room là phần giảm được chấp nhận phân bổ rõ cho tiền phòng; A_other là giảm hóa đơn khác không phân bổ vào tiền phòng. Tổng giảm A_bill=A_room+A_other, mỗi khoản một lần; không tự thêm loyalty.
- Bill=max(G+S+E+Tax−A_bill,0). P là tiền thực thu cho hóa đơn đã trừ hoàn trước đó. Còn thu=max(Bill−P,0); thu thừa=max(P−Bill,0), không trừ cọc lần hai. Cọc=làm tròn HALF_UP[30%×max(G−A_room,0)] VND nguyên, không dùng A_bill thay A_room.
- Chỉ tính khoản có giá/giảm/phân bổ được chấp nhận; số cụ thể cần nhân viên đối soát, không phải báo giá live hoặc chính sách thuế pháp lý. Giảm hết tiền phòng không mặc nhiên miễn thuế demo hoặc dịch vụ.
- Ví dụ G=1.700.000, S=360.000, E=0: toàn bộ giảm 100.000 VND là giảm phòng, A_room=A_bill=100.000, A_other=0. Tax=206.000, Bill=2.166.000, cọc=480.000; nếu đã nộp cọc đó thì còn thu 1.686.000. Số chỉ minh họa, không cấp quyền giảm giá.

## POL-03-U03 Tất toán, ứng trước và thu thừa

- Phần còn phải thu được đối soát và thanh toán khi trả phòng; chỉ xác nhận đã thanh toán/trả phòng khi số dư đã xử lý đầy đủ. Không suy ra đã thu tiền từ trạng thái booking hoặc thông báo thành công.
- Tổng hóa đơn đã xác nhận gọi là Bill; P là tiền thực thu của hóa đơn sau các khoản hoàn. Còn thu=max(Bill−P,0); thu thừa cuối cùng=max(P−Bill,0), hoàn sau đối soát, không trừ hóa đơn thêm lần nữa.
- Ứng trước vượt cọc yêu cầu khác với thu thừa hóa đơn: phần ứng trước có thể giữ làm khoản ứng trước cho Bill nếu khách đồng ý. Cọc/voucher/loyalty không bị trừ hai lần; quyền lợi chưa được duyệt không tự cộng.
- Tiền chưa về hoặc chưa xác minh thì chờ đối soát, không hứa hoàn ngay. Receipt, phân bổ hoặc số tiền chưa rõ cần nhân viên; không tự tạo khoản thu âm hay thêm cọc hư hại.

## POL-03-U04 Cọc bổ sung khi tăng giá trị booking

- Áp dụng sửa booking đã xác nhận chưa nhận phòng, theo báo giá được nhân viên xác nhận. Tiền phòng mới sau giảm phòng được chấp nhận, trước thuế/dịch vụ là R; cọc mới D_new = làm tròn HALF_UP(30%×max(R,0)) VND nguyên.
- D_held là cọc phòng khả dụng: tiền thực đã thu còn giữ, không tính phần đã hoàn và không tính phần đã dành cho lệnh hoàn hoặc chỉ thị tài chính khác. Không dùng tiền dịch vụ/phí tự bù cọc. Cần bổ sung=max(D_new−D_held,0); không thu cọc cũ lần hai.
- Báo giá hiệu lực 15 phút từ lúc phát hành, UTC+07:00. Phải chấp nhận đúng phiên bản báo giá và đủ bổ sung theo thời điểm sự kiện có chứng cứ đáng tin trước hạn; bằng hạn là quá hạn. Không phải bổ sung thì không tạo giao dịch 0.
- Chỉ sửa khi đủ chấp nhận/tiền/khả năng cung ứng; chưa đủ thì giữ gốc theo điều kiện của nó. Báo giá hết hạn chỉ bỏ phần sửa, không hủy/phạt gốc; tiền bổ sung chưa áp dụng được hoàn sau xác minh. Chứng cứ thời gian muộn/xung đột cần nhân viên, không tự cấp trùng phòng.
- Ví dụ R=2.550.000, D_held=510.000: D_new=765.000, bổ sung 255.000, không thu lại 765.000. Quyền lợi voucher/loyalty chưa rõ phải được nhân viên xác nhận trong báo giá. Ví dụ đối soát: giữ 510.000 VND, đã dành cho hoàn 300.000 VND → D_held=210.000 VND; D_new=255.000 VND → cần bổ sung 45.000 VND.

## POL-03-U05 Cọc dư khi giảm giá trị booking

- Chỉ áp cho sửa booking đã xác nhận trước nhận phòng đã đáp ứng chấp nhận đúng báo giá và khả năng cung ứng. Báo giá hiệu lực 15 phút từ lúc phát hành (UTC+07:00); chấp nhận và mọi khoản bổ sung phải trước hạn, không áp khi bằng hạn.
- R là tiền phòng mới sau giảm được chấp nhận, trước thuế/dịch vụ; D_new=làm tròn HALF_UP(30%×max(R,0)) VND nguyên. D_held là cọc phòng khả dụng: tiền thực đã thu còn giữ, không tính phần đã hoàn và không tính phần đã dành cho lệnh hoàn hoặc chỉ thị tài chính khác. Cần bổ sung=max(D_new−D_held,0); cọc dư=max(D_held−D_new,0).
- Trước hiệu lực, khách ghi trong chấp nhận báo giá lựa chọn hoàn cọc dư không phí hủy hoặc giữ ứng trước cho hóa đơn mới; chưa chọn thì nhân viên xin xác nhận, chưa áp phần sửa. Sau hiệu lực, thực hiện lựa chọn đã ghi. Không đủ điều kiện tới hạn chỉ bỏ báo giá, không hủy/phạt gốc.
- Hoàn dư phải có chứng từ/mã xử lý riêng, trong giới hạn tiền thực còn giữ, trừ khoản đã hoàn/đang xử lý; không trùng hồ sơ hủy. Giữ dư làm ứng trước không biến toàn bộ tiền giữ thành phí hủy: cọc mới D_new là giới hạn dùng về sau.
- D_new=0 cần xác nhận nhân viên và lựa chọn dư trước hạn, không giao dịch 0; vẫn có thể còn thuế/dịch vụ. Ví dụ R=850.000,D_held=510.000: D_new=255.000, dư=255.000; đây không phải hủy nên không áp tỷ lệ phạt hủy. Ví dụ đối soát: giữ 510.000 VND, đã dành cho hoàn 300.000 VND → D_held=210.000 VND; D_new=255.000 VND → cần bổ sung 45.000 VND.

