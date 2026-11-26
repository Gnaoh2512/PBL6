---
document_id: "pbl6-publication-pol-01"
title: "Chính sách đặt phòng — Azure Bay"
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
source_policy_id: "POL-01"
source_policy_version: "0.1.1"
derived_from: "../academic-demo-hotel-policies.md"
observed_at: "2026-11-22"
updated_at: "2026-11-22"
---

# POL-01 — Đặt phòng (0.1.1)

> AI_GENERATED_SYNTHETIC · Academic Demo · approved: true. Người dùng duyệt nội dung ngày 22/11/2026; hiệu lực từ 22/11/2026, không áp hồi tố. Chưa rõ phiên bản hoặc tiền đã thu: cần nhân viên.

## POL-01-U01 Ngày đặt, số đêm và số phòng

- Giờ/ngày dùng UTC+07:00. Booking thông thường chỉ nhận ngày đến sau ngày tạo; ngày đến trước ngày tạo bị từ chối. Ngày trả phải sau ngày nhận, tối thiểu một đêm; ngày trả là đầu mút không tính đêm.
- Mỗi yêu cầu chọn một phòng; nhóm nhiều phòng có thể dùng các đơn độc lập. Hủy một đơn không tự hủy đơn khác.
- Cùng ngày hoặc walk-in cần nhân viên xác nhận giờ tiếp nhận, phòng, báo giá và thanh toán. Chưa có cutoff cố định: không mặc định còn phòng hoặc được nhận trước 22:00; đến sau 22:00 cần thỏa thuận trước, không hứa tiếp nhận 24/7.
- Số người, kể cả sơ sinh, phải trong sức chứa được xác nhận cho phòng; số người không tự chứng minh còn phòng.

## POL-01-U02 Cọc và cửa sổ giữ chỗ

- Cọc yêu cầu bằng 30% tiền phòng sau giảm phòng/voucher được chấp nhận, trước thuế và dịch vụ, làm tròn HALF_UP đến VND nguyên. Cọc là ứng trước, không phải phí đặt chỗ.
- Cửa sổ giữ chỗ kết thúc tại lúc tạo đơn +15 phút (UTC+07:00). Chỉ xác nhận khi đủ cọc được đối soát và phòng được xác nhận giữ; được nhận nhiều khoản một phần trong cửa sổ.
- Với nhiều khoản, dùng thời điểm giao dịch có chứng cứ đáng tin muộn nhất trong tập cần để đủ cọc; phải trước hạn. Bằng hạn là quá hạn. Ảnh chuyển khoản hoặc thông báo trợ lý không phải bằng chứng đủ.
- Thiếu tiền/tiền đến quá hạn không tự khôi phục đơn; tiền chưa phân bổ được hoàn sau xác minh, không phí hủy của booking đã xác nhận. Cọc bằng 0 cần nhân viên xác nhận, không tạo giao dịch 0; vẫn có thể còn thuế/phí.
- Chứng cứ tới sau nhưng chứng minh tiền đúng hạn, hoặc mốc thời gian xung đột: nhờ nhân viên đối soát; không tự đổi sang giờ xử lý, quy lỗi trễ cho khách hoặc khôi phục/cấp trùng phòng.

## POL-01-U03 Đến muộn và không đến nhận phòng

- Ngày/giờ theo UTC+07:00. Đến sau 22:00 cần thỏa thuận tiếp nhận trước; không có lời hứa tiếp nhận 24/7. Booking cùng ngày cần nhân viên xác nhận giờ tiếp nhận kể cả trước 22:00.
- Nếu không có thỏa thuận đến muộn còn hiệu lực và chưa thực nhận phòng, mốc không đến nhận phòng là 00:00 ngày kế tiếp ngày đến. Thỏa thuận còn hiệu lực qua nửa đêm không bị bỏ qua.
- Với booking đã xác nhận, chưa nhận phòng, cọc yêu cầu bằng 30% tiền phòng sau giảm được chấp nhận trước thuế/dịch vụ, làm tròn HALF_UP VND nguyên. Phí không đến tối đa phần cọc hiệu dụng: nhỏ hơn giữa cọc yêu cầu và tiền phòng thực còn giữ có chứng cứ, gồm thuế phòng đã thu; không thêm khoản phạt thứ hai hoặc thu tiền đêm chưa dùng.
- Đơn chưa đủ cọc/hết hạn mà chưa được xác nhận không chịu phí hủy này; trả khoản chưa phân bổ sau xác minh. Thiếu bằng chứng, phiên bản áp dụng hoặc trạng thái thì cần nhân viên.

## POL-01-U04 Báo giá sửa booking và thời điểm có hiệu lực

- Ưu tiên sửa booking đã xác nhận nhưng chưa thực nhận phòng. Đơn đang chờ cọc, đã nhận phòng, nhiều booking hoặc ngoại lệ cần nhân viên xử lý riêng; không reset giữ chỗ gốc.
- Báo giá phải xác định mã/phiên bản báo giá, phiên bản policy, thay đổi ngày/phòng/giá, giảm giá được chấp nhận, cọc mới, tiền thực đã phân bổ, số phải bổ sung, giờ nhận/trả và khả năng cung ứng. Thiếu thông tin hoặc quyền lợi chưa rõ thì nhờ nhân viên, chưa có báo giá cuối.
- Ngày đến sửa không trước ngày phát hành/chấp nhận báo giá (UTC+07:00); cùng ngày cần nhân viên xác nhận. Đổi ngày không tự bỏ điều kiện tuổi hoặc cho quyền đến muộn.
- Báo giá hiệu lực 15 phút từ lúc phát hành. Khách phải chấp nhận đúng phiên bản báo giá và đủ khoản bổ sung theo thời điểm giao dịch đáng tin trước hạn; bằng hạn là quá hạn. Không dùng chấp nhận phiên bản báo giá cũ cho phiên bản báo giá mới.
- Chỉ áp thay đổi một lần khi đủ chấp nhận, tiền và xác nhận khả năng cung ứng. Không cần giao dịch 0 nếu không phải bổ sung. Trước đó booking gốc giữ ngày/phòng/giá/cọc/trạng thái hiện hữu.

## POL-01-U05 Báo giá sửa hết hạn hoặc xử lý muộn

- Đối với sửa booking đã xác nhận trước khi nhận phòng, báo giá có hạn 15 phút từ lúc phát hành; đúng phiên bản báo giá phải được chấp nhận và khoản bổ sung phải đủ theo thời điểm sự kiện có chứng cứ đáng tin trước hạn (UTC+07:00).
- Từ chối, không chấp nhận hoặc hết hạn thiếu tiền/chấp nhận: bỏ riêng phần sửa, không tự hủy/phạt booking gốc. Khoản bổ sung chưa được áp dụng là tiền chưa phân bổ, hoàn sau xác minh, không phí hủy; mapping chưa rõ cần đối soát.
- Báo giá chờ xử lý không đóng băng hoặc gia hạn các điều kiện độc lập của booking gốc: yêu cầu hủy hợp lệ, không đến nhận phòng và thỏa thuận đến muộn vẫn áp dụng.
- Tiền đúng hạn nhưng xử lý muộn hoặc phòng thay đổi: nhân viên giải quyết trong khi giữ booking gốc theo các điều kiện độc lập của nó; không cấp trùng phòng hoặc quy lỗi chậm xử lý cho khách.
- Không thực hiện được cam kết đã nhận cần quản lý xem xét: phần lưu trú chưa cung cấp đã thu được hoàn không phí hủy sau xác minh; dịch vụ đã dùng tách riêng, không tự hứa bồi thường thêm.

## POL-01-U06 Hủy khi đang sửa booking

- Hủy là yêu cầu riêng, hợp lệ khi hệ thống nhận diện booking, xác minh quyền người yêu cầu, ý muốn hủy và có dấu vết tiếp nhận. Dùng ngày tiếp nhận hợp lệ theo UTC+07:00, không dùng ngày nhân viên xử lý; chưa có chứng cứ thì nhờ nhân viên.
- Sửa chưa có hiệu lực: hủy trên ngày đến/cọc/phiên bản gốc và chấm dứt báo giá đang chờ. Sửa đã có hiệu lực: dùng ngày đến/cọc/phiên bản đã chốt. Không thu hai phí hủy.
- Chỉ với booking đã xác nhận và trước thực nhận phòng, phần cọc hiệu dụng là min(cọc yêu cầu, tiền phòng thực còn giữ có chứng cứ, gồm thuế phòng đã thu). Tỷ lệ hoàn phần này: trước ≥3 ngày lịch 100%, trước 1–2 ngày 50%, cùng ngày hoặc sau ngày đến 0%; không phải mốc giờ.
- Hoàn phần cọc làm tròn HALF_UP VND nguyên trước, phí là phần còn lại; tiền phòng trả trước vượt phần cọc hiệu dụng không bị giữ chỉ vì trả nhiều. Sau nhận phòng cần đối soát riêng; lỗi cung ứng do khách sạn cần quản lý xác minh, không tự áp phí lên phần chưa cung cấp.
- Đơn chưa được xác nhận chờ cọc/hết hạn không phí hủy; hoàn tiền chưa phân bổ sau xác minh. Thiếu mốc thời gian/chứng từ hoặc phiên bản thì cần nhân viên, không tự chọn mốc.

