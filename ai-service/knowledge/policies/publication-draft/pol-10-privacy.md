---
document_id: "pbl6-publication-pol-10"
title: "Quyền riêng tư và lưu giữ dữ liệu — Academic Demo"
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
source_policy_id: "POL-10"
source_policy_version: "0.1.1"
derived_from: "../academic-demo-hotel-policies.md"
observed_at: "2026-11-22"
updated_at: "2026-11-22"
---

# POL-10 — Quyền riêng tư và lưu giữ dữ liệu (0.1.1)

> AI_GENERATED_SYNTHETIC · Academic Demo · approved: true. Người dùng duyệt nội dung ngày 22/11/2026; hiệu lực từ 22/11/2026, không áp hồi tố. Chưa rõ phiên bản hoặc tiền đã thu: cần nhân viên.

## POL-10-U01 Dữ liệu giả lập và quyền truy cập

- Academic Demo chỉ dùng dữ liệu cá nhân/giao dịch giả lập, không dùng danh tính hoặc booking thật. Chỉ thu trường cần cho mục đích đặt/lưu trú qua luồng bảo vệ, thông báo mục đích và phạm vi dùng.
- Không đưa JWT, mật khẩu/khóa, giấy tờ, liên hệ, hồ sơ/giao dịch khách hoặc hội thoại cá nhân vào FAQ/corpus/model/log trợ lý hay nguồn công khai. Giá/chính sách tĩnh không kèm bản ghi khách; khách dán dữ liệu riêng vào chat cần dùng luồng bảo vệ, không tái dùng làm ví dụ/training.
- Dữ liệu riêng chỉ xem ở màn hình nghiệp vụ có kiểm tra quyền; mã booking/email/số điện thoại trong chat không tự chứng minh quyền. Không dùng yêu cầu xóa chưa xác minh để xóa dữ liệu người khác.
- Không tái dùng marketing/chia sẻ bên thứ ba nếu chưa có đồng ý và review riêng. Không tự tuyên bố mã hóa, tự động xóa, tuân thủ pháp luật hoặc ngân hàng đã bảo mật khi chưa có chứng cứ.

## POL-10-U02 Hạn log gốc và log trong backup

- Theo UTC+07:00, log gốc đã làm sạch tối đa 14 ngày liên tục từ lúc log được tạo. Log trong backup cũng cùng hạn đó, không reset tuổi theo ngày sao chép; backup 30 ngày không được kéo dài hạn log.
- Trước hạn phải loại log hết hạn hoặc xóa cả backup nếu không tách được; backup chứa nhiều log theo hạn sớm nhất còn bên trong. Bản sao gồm nhiều loại dữ liệu áp hạn sớm nhất.
- Chỉ gia hạn nếu nhóm xác nhận lý do, phạm vi tối thiểu, loại/bản sao/bản ghi, người chịu trách nhiệm, ngày kết thúc và lịch xem lại. Giữ log quá 14 ngày phải ghi ngoại lệ log riêng, không ngầm dùng hạn backup hay lưu vô thời hạn.
- Phải kiểm kê backup, bản xuất và bản khôi phục; chưa xóa hết hoặc đang giữ ngoại lệ thì nói rõ phần còn lại, không báo đã xóa hoàn toàn. Đây là quy trình thủ công đề xuất, không cam kết xóa tự động.
- Ví dụ log tạo 01/12/2026 10:00: gốc và mọi backup chứa log hết hạn 15/12 10:00 nếu không có ngoại lệ riêng.

## POL-10-U03 Snapshot, backup không log và bản khôi phục

- UTC+07:00: DB/snapshot/backup demo không chứa log tối đa 30 ngày lịch sau ngày kết thúc demo do nhóm ghi nhận, hết ngày địa phương. Chưa chốt ngày kết thúc thì chưa có lịch xóa cụ thể, không tự nói đã tuân thủ.
- Log gốc và trong backup tối đa 14 ngày từ lúc log tạo, không reset theo sao chép. Bản có nhiều loại áp hạn sớm nhất; không dùng hạn backup 30 ngày để kéo dài log.
- Bản sao tạm để khôi phục tối đa 24 giờ từ lúc tạo và không vượt hạn gốc sớm nhất của dữ liệu bên trong. Đưa vào dùng tiếp vẫn giữ tuổi/hạn gốc; kiểm tra dấu vết đã xóa/hết hạn trước khôi phục, không đưa log hết hạn trở lại.
- Gia hạn chỉ khi nhóm ghi lý do, phạm vi tối thiểu, loại/bản sao/bản ghi, người chịu trách nhiệm, hạn kết thúc và lịch xem lại; log quá hạn cần ngoại lệ log riêng. Kiểm kê backup/bản xuất/bản khôi phục, chưa xử lý hết thì không nói đã xóa toàn bộ; không hứa tự động xóa.
- Ví dụ log tạo 01/12 10:00, bản khôi phục tạo 14/12 18:00: hạn 15/12 10:00, sớm hơn 24 giờ. Demo kết thúc 10/12/2026: backup không log hết hạn cuối ngày 09/01/2027.

## POL-10-U04 Yêu cầu xem, sửa, xóa và sự cố

- Yêu cầu xem/sửa/xóa qua nhóm dự án, xác minh quyền người yêu cầu và thông báo kết quả hoặc phần còn phải xử lý. Không dùng mã booking/email/số điện thoại trong chat thay kiểm tra quyền, không xóa dữ liệu người khác theo yêu cầu chưa xác minh.
- Phản ánh có dấu thời gian theo UTC+07:00: mục tiêu xác nhận tiếp nhận ≤24 giờ liên tục, hướng xử lý ≤3 ngày làm việc kể cả còn thiếu. Thứ Hai–thứ Sáu lịch demo, không dùng lịch nghỉ lễ; đếm từ ngày làm việc kế tiếp, hạn 23:59:59 ngày thứ N.
- Nhân viên xác nhận bộ tối thiểu: vụ việc/phiên bản liên quan, quyền và kênh phản hồi, nội dung/thời điểm/yêu cầu/chứng cứ; thêm chứng từ/phân bổ/hoàn/kênh nhận hoàn chỉ nếu liên quan tiền. Từ lần đầu đủ, mục tiêu kết luận ban đầu ≤7 ngày làm việc cùng cách đếm; mốc chưa rõ cần đối soát, không backdate/reset vì xử lý chậm.
- Thiếu thông tin thì nêu phần thiếu/người xử lý/mốc cập nhật; quá thời hạn mục tiêu/mốc cập nhật hoặc chờ duyệt chưa có mốc cập nhật thì chuyển cấp xử lý. Chưa có hạn tổng, thời hạn mục tiêu phê duyệt/ngân hàng hoặc thời hạn pháp lý tự cam kết.
- Nhập nhầm dữ liệu thật/lộ secret: dừng dùng/chia sẻ phần đó, chuyển người phụ trách; không sao chép vào policy/ví dụ/log. Còn backup/bản xuất/bản khôi phục hoặc giữ ngoại lệ thì nói rõ, không báo xóa hoàn toàn; gia hạn phải có lý do/phạm vi/người phụ trách/hạn và lịch xem lại.

