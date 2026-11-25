---
document_id: "pbl6-publication-pol-05"
title: "Chính sách hoàn tiền — Azure Bay"
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
source_policy_id: "POL-05"
source_policy_version: "0.1.1"
derived_from: "../academic-demo-hotel-policies.md"
observed_at: "2026-11-22"
updated_at: "2026-11-22"
---

# POL-05 — Hoàn tiền (0.1.1)

> AI_GENERATED_SYNTHETIC · Academic Demo · approved: true. Người dùng duyệt nội dung ngày 22/11/2026; hiệu lực từ 22/11/2026, không áp hồi tố. Chưa rõ phiên bản hoặc tiền đã thu: cần nhân viên.

## POL-05-U01 Tổng hoàn khi hủy trước nhận phòng

- Chỉ cho booking đã xác nhận chưa nhận phòng, yêu cầu hủy hợp lệ có quyền và dấu vết tiếp nhận, chứng từ/phiên bản rõ. UTC+07:00: d=ngày đến−ngày nhận hợp lệ; r=1 nếu d≥3, 0,5 nếu d=1–2, 0 nếu d≤0; là ngày lịch, không dùng ngày xử lý.
- D là cọc yêu cầu: làm tròn HALF_UP(30% tiền phòng sau giảm được chấp nhận, trước thuế/dịch vụ) VND nguyên. P0 là tiền phòng thực còn giữ trước quyết định gồm thuế phòng, trừ hoàn trước quyết định, không trừ lại các lệnh của chính quyết định này.
- C0 (dịch vụ) và E0 (phí sớm/muộn) chỉ gồm tiền thực đã thu còn giữ cho phần chưa cung cấp, đã được nhân viên xác minh đủ điều kiện từ chứng từ, dấu vết sử dụng và phân bổ thuế gốc. Cả hai gồm phần thuế tương ứng đã thu. U0 là tiền chưa phân bổ thực còn giữ. Không cộng khoản chỉ báo giá/chưa thu. Bốn nhóm không âm, rời nhau; phần đã cung cấp tách riêng.
- Cọc hiệu dụng=min(D,P0); H=làm tròn HALF_UP(r×cọc hiệu dụng) VND nguyên; phí F=cọc hiệu dụng−H. Hoàn phòng=P0−F; tổng mục tiêu T=P0−F+C0+E0+U0. Không áp F lên C0/E0/U0, cộng thuế lại hoặc giữ hết tiền vượt cọc.
- Số lập lệnh mới=max(T−tiền đã hoàn−tiền dành cho lệnh đang xử lý,0); chốt số gốc cho một quyết định, không tính lại từ dư giảm dần hoặc hoàn trùng/quá tiền giữ. Chứng từ/phân bổ/thuế/phần đã cung cấp/mốc thời gian chưa đủ: trợ lý không chốt số hoàn, chuyển nhân viên.
- Đơn chưa xác nhận chờ cọc/hết hạn không có F; sau nhận phòng không dùng công thức hủy này. Khách sạn không cung cấp phần lưu trú chưa dùng: quản lý xác minh để hoàn khoản phòng phần đó không F; dịch vụ đã dùng tách riêng.

## POL-05-U02 Chứng cứ, giới hạn và hoàn nhiều lần

- Chỉ hoàn tiền thực đã thu còn giữ và đủ điều kiện, không suy từ cọc yêu cầu/trạng thái đơn. Tiền phòng, dịch vụ, phí sớm/muộn và tiền chưa phân bổ phải rời nhau; một phần chứng từ không được vào hai nhóm hoặc hai hồ sơ.
- Mỗi quyết định chốt tiền gốc và mục tiêu hoàn; số lệnh mới bằng mục tiêu trừ đã hoàn và đang dành cho lệnh xử lý, tối thiểu 0. Không tính lại phí từ dư giảm dần, không hoàn quá tiền giữ.
- Lệnh đang xử lý giữ phần tiền dành riêng; chưa rõ thất bại thì không giải phóng để lập lệnh trùng. Ghi nhận riêng đang xác minh/đã duyệt/đã gửi/đã nhận; thông báo thành công không chứng minh ngân hàng đã trả.
- Chỉ hoàn tiền thực qua kênh đã xác minh, không đổi sang voucher/points hoặc vừa hoàn vừa bảo lưu cùng khoản. Thiếu chứng từ, phân bổ, mốc thời gian hay phiên bản: nhân viên đối soát, chưa hứa số tiền hoặc hoàn ngay.
- Chỉ khi mọi nhóm tiền đủ điều kiện đều bằng 0 mới kết luận tổng hoàn 0; tiền phòng bằng 0 vẫn có thể còn tiền dịch vụ, phí chưa cung cấp hoặc tiền chưa phân bổ cần hoàn.

## POL-05-U03 Dịch vụ và phí chưa cung cấp

- Ưu tiên thu phí sớm/muộn khi cung cấp. Phí hoặc dịch vụ thu trước chưa cung cấp, hủy hợp lệ và được nhân viên xác nhận đủ điều kiện: hoàn phần chưa cung cấp cùng thuế đã thu tương ứng; phần đã cung cấp không tự hoàn.
- Nhân viên dựa báo giá, chứng cứ sử dụng và thuế phân bổ của hóa đơn gốc; tổng thuế phân bổ bằng tổng thuế gốc, không làm tròn riêng để tăng tổng. Không chia đều theo giờ khi thiếu quy tắc; thiếu bằng chứng cần nhân viên, chưa có số cuối.
- Hồ sơ chỉ hoàn dịch vụ/phí, kể cả sau nhận phòng, có mục tiêu bằng khoản dịch vụ đủ điều kiện + khoản phí đủ điều kiện + tiền chưa phân bổ đủ điều kiện, không phí hủy phòng và không tự thêm tiền đêm phòng.
- Các khoản đã gồm thuế không cộng thuế lần nữa. Trừ tiền đã hoàn và dành cho lệnh đang xử lý, không dùng cùng phần chứng từ cho hồ sơ này và hồ sơ hủy phòng hoặc hoàn thu thừa.
- Ví dụ phí chưa cung cấp đã thu 255.000+25.500 thuế: hoàn đủ điều kiện 280.500; Breakfast Set chưa cung cấp đã thu 180.000+18.000 thuế: 198.000 sau duyệt. Số chỉ minh họa; dịch vụ đã dùng/khiếu nại cần nhân viên.

## POL-05-U04 Hồ sơ và thời hạn hoàn

- Bộ tối thiểu: booking/phiên bản, quyền người yêu cầu, chứng từ và thời điểm giao dịch đáng tin, phân bổ tiền phòng/dịch vụ/phí/tiền chưa phân bổ, phần đã cung cấp và thuế, lịch sử hoàn/lệnh đang xử lý, kênh nhận hoàn đã xác minh qua luồng bảo vệ. Không gửi giấy tờ/số tài khoản vào chat.
- Nhân viên tiếp nhận được nhóm chỉ định xác nhận bộ lần đầu đủ, ghi mốc và bằng chứng/người xác nhận. Mốc đủ hồ sơ khác mốc nhận yêu cầu và giờ xử lý; không dời mốc vì xử lý chậm. Không chứng minh được mốc thì đối soát, không backdate.
- Mục tiêu kiểm tra ≤3 ngày làm việc từ mốc hồ sơ đủ; mục tiêu gửi lệnh ≤5 ngày làm việc từ mốc được người có thẩm quyền duyệt. UTC+07:00, ngày làm việc thứ Hai–thứ Sáu trong lịch demo, không dùng lịch nghỉ lễ; đếm từ ngày làm việc kế tiếp, hạn 23:59:59 ngày thứ N.
- Hồ sơ thiếu: chờ bổ sung, nêu phần thiếu/người xử lý/mốc cập nhật. Quá hạn kiểm tra/gửi lệnh, quá mốc cập nhật hoặc chờ duyệt chưa có mốc cập nhật: chuyển cấp xử lý, không tự duyệt.
- Kiểm tra, chờ phê duyệt, gửi và ngân hàng trả là các bước riêng; chưa có hạn tổng hoặc thời hạn mục tiêu duyệt/ngân hàng, không hứa 3+5 ngày hay ngày tiền về. Đã gửi chưa phải đã nhận; cần bằng chứng nhận hoàn.

## POL-05-U05 Đơn chưa đủ cọc, hết hạn hoặc tiền đến sau hủy

- Đơn chưa được xác nhận do chưa đủ cọc/hết hạn: không phí hủy, hoàn khoản thực nhận chưa phân bổ sau xác minh. Không coi cọc yêu cầu hoặc trạng thái đã xác nhận là chứng từ.
- Giữ chỗ kết thúc lúc tạo đơn +15 phút, UTC+07:00; sự kiện giao dịch đáng tin đạt đủ cọc phải trước hạn, bằng hạn là quá hạn. Tiền có thời điểm sự kiện có chứng cứ sau hết hạn/hủy là khoản chưa phân bổ riêng, trả 100% sau xác minh, không tự mở lại đơn hoặc thu phí hủy lần nữa.
- Chứng cứ tới sau nhưng xác nhận thời điểm sự kiện có chứng cứ trước hạn: nhờ nhân viên đối soát trạng thái/phòng, không quy lỗi trễ cho khách hoặc tự khôi phục/cấp trùng phòng. Timestamp thiếu/xung đột không được thay bằng giờ xử lý.
- Giữ mục tiêu riêng cho khoản đến sau quyết định; không tính lại phí của hồ sơ cũ. Trừ số đã hoàn và đang dành cho lệnh xử lý, không hoàn trùng/quá thực giữ. Tiền chưa xác minh thì chờ đối soát, không hứa hoàn ngay.

## POL-05-U06 Sau nhận phòng, cọc dư và ngoại lệ

- Sau thực nhận phòng/trả phòng không dùng tỷ lệ hủy trước nhận. Đối soát thu thừa sau tổng hóa đơn đã chốt; có thể hoàn riêng dịch vụ/phí chưa cung cấp và tiền chưa phân bổ đủ điều kiện, không tự hoàn đêm đã xác nhận.
- Rời sớm vì lý do cá nhân hoặc dịch vụ đã dùng cần quản lý xem xét bằng chứng, không tự thêm phí hủy hoặc hứa hoàn. Lỗi cung ứng khách sạn: hoàn toàn bộ khoản phòng phần chưa cung cấp đã thu sau quản lý xác minh, không phí hủy; dịch vụ đã dùng tách riêng, không tự hứa bồi thường thêm.
- Với sửa booking đã xác nhận trước nhận phòng: cọc mới bằng 30% tiền phòng mới sau giảm được chấp nhận trước thuế/dịch vụ, làm tròn HALF_UP VND nguyên; cọc dư là phần cọc phòng khả dụng vượt cọc mới, không gồm tiền đã hoàn và không gồm tiền đã dành cho hoàn/chỉ thị tài chính khác. Trước hiệu lực, khách phải ghi lựa chọn hoàn dư không phí hoặc giữ ứng trước cho hóa đơn mới như một phần chấp nhận báo giá. Sau hiệu lực, thực hiện lựa chọn đã ghi. Thiếu hoặc mâu thuẫn bản ghi: chuyển nhân viên, không tự áp phần sửa hay tự chọn thay khách.
- Hoàn cọc dư có mã/chứng từ riêng, trong giới hạn tiền giữ sau khoản đã hoàn/đang xử lý; không áp bảng tỷ lệ hủy, không trùng hồ sơ hủy hoặc thu thừa. Phí đã hoàn được phản ánh một lần trong hóa đơn/sổ đối soát điều chỉnh, không tạo lần hoàn thu thừa thứ hai.
- Receipt, phần chưa cung cấp, phân bổ thuế, phiên bản hoặc quyết định ngoại lệ chưa rõ: chuyển nhân viên, chưa báo số cuối; không tự chọn quyền lợi voucher/loyalty.

