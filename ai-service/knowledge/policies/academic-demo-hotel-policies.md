---
document_id: synthetic-hotel-policies-academic-demo
title: "Chính sách khách sạn Azure Bay — Academic Demo"
category: policy
version: "0.1.1"
status: approved
source_type: AI_GENERATED_SYNTHETIC
approval_status: approved
approved: true
approved_by: "user"
approved_at: "2026-11-22"
effective_from: 2026-11-22
effective_to: null
synthetic: true
source_ref: "synthetic:pbl6-academic-demo/hotel-policies-v0.1.1"
observed_at: "2026-11-22"
updated_at: "2026-11-22"
---

# Chính sách khách sạn Azure Bay — Academic Demo

> Toàn bộ policy AI_GENERATED_SYNTHETIC cho khách sạn hư cấu đã được người dùng phê duyệt nội dung ngày 22/11/2026.
> Mọi mức phí, tuổi, thời hạn, quyền và điều kiện dưới đây vẫn là giả định cho Academic Demo, không phải chính sách khách sạn thực tế.
> “Quan sát” chỉ xác nhận nội dung file/code, không xác nhận policy đã được duyệt hoặc runtime đã thực thi.
> Đây là tài liệu tổng hợp đã được duyệt nội dung, không phải publication cho RAG; hiệu lực từ 22/11/2026 và không áp dụng hồi tố cho booking hiện có.
> Không chứa dữ liệu khách, mã booking, số tài khoản hay giao dịch cá nhân. Không kết nối database trong lần soạn này.

## SOURCES Evidence register

Khảo sát repository ngày 22/11/2026, HEAD c031267; working tree có thay đổi chưa commit.
Không đọc dữ liệu DB để thay cho quyền phê duyệt. Các nguồn implementation sau đều là bằng chứng kỹ thuật,
không phải người phê duyệt nội dung.

| Ref | Quan sát đã đối chiếu | Nguồn |
| --- | --- | --- |
| O1 | Schema có booking/booking_room, invoice/payment, service_usage/request; không có policy version, tuổi khách, giường phụ, pet, complaint, retention hoặc biểu phí sớm/muộn riêng. Seed có 4 hạng phòng capacity 2/2/3/2 và 15 dịch vụ thuộc 4 nhóm. | [schema](../../../schema_v4_clean.sql), [seed](../../../dummy_data.sql) |
| O2 | BookingCreateRequest nhận roomId, ngày, guestCount và thông tin khách; createBooking tính cọc từ tiền phòng sau voucher, tạo PENDING_DEPOSIT. Search lọc capacity và lịch; createBooking không có kiểm tra capacity tường minh tương đương ngay trong phương thức đã đọc. | [DTO](../../../BE/src/main/java/com/example/pbl6/dto/booking/BookingCreateRequest.java), [booking service](../../../BE/src/main/java/com/example/pbl6/service/CustomerBookingServiceImpl.java), [room repository](../../../BE/src/main/java/com/example/pbl6/repository/RoomRepository.java) |
| O3 | hotel.bank.deposit-percentage=30; payment-timeout-minutes=15 trong file cấu hình. RoomCatalogService đọc key hotel.deposit-percentage với default 30, khác key tạo đơn. Expiry dùng isAfter và job fixedRate 60000; không chứng minh hết hạn chính xác ngay tại giây thứ 900. | [config](../../../BE/src/main/resources/application.properties), [bank config](../../../BE/src/main/java/com/example/pbl6/config/BankConfig.java), [room service](../../../BE/src/main/java/com/example/pbl6/service/RoomCatalogServiceImpl.java), [booking service](../../../BE/src/main/java/com/example/pbl6/service/CustomerBookingServiceImpl.java) |
| O4 | Calculator có cọc 30%, thuế demo 10%, ngày hủy >=3:100%, 1–2:50%, <=0:0%. Đó là chênh lệch LocalDate, không phải 72/48/24 giờ. | [calculator](../../../BE/src/main/java/com/example/pbl6/service/financial/FinancialCalculator.java) |
| O5 | cancelWithFlexibleOptions chặn CHECKED_IN/CHECKED_OUT/CANCELED. CASH_REFUND dùng ngày xử lý; CREDIT_VOUCHER và LOYALTY_POINTS bảo lưu 100% cọc. Khi không có DEPOSIT nhưng CONFIRMED/CHECKED_IN, phương thức có fallback depositRequired. Ghi Payment REFUND không tự chứng minh tiền ngân hàng đã về. | [cancel DTO](../../../BE/src/main/java/com/example/pbl6/dto/billing/CancelBookingRequest.java), [billing service](../../../BE/src/main/java/com/example/pbl6/service/CustomerBillingServiceImpl.java) |
| O6 | Có check-in, live folio và settlement. checkInGuest kiểm tra CONFIRMED nhưng không áp giờ/biểu phí mới. settleCheckout nhận amount dương được cung cấp rồi gán PAID/CHECKED_OUT; không coi nhánh này là bằng chứng đã chặn mọi thanh toán thiếu. | [staff controller](../../../BE/src/main/java/com/example/pbl6/controller/StaffBillingController.java), [billing service](../../../BE/src/main/java/com/example/pbl6/service/CustomerBillingServiceImpl.java), [settlement DTO](../../../BE/src/main/java/com/example/pbl6/dto/billing/SettlementRequest.java) |
| O7 | Các luồng service có unit/price/active, trạng thái và booking link. Luồng orderInStayService loại canceled/expired/checked-out, không phải một guard CHECKED_IN duy nhất cho tất cả đường gọi; quantity/giá thiếu có fallback. | [billing service](../../../BE/src/main/java/com/example/pbl6/service/CustomerBillingServiceImpl.java), [service request service](../../../BE/src/main/java/com/example/pbl6/service/ServiceRequestServiceImpl.java), [service DTO](../../../BE/src/main/java/com/example/pbl6/dto/service/ServiceResponse.java) |
| O8 | FE hiển thị cọc 30%; FE/mobile có 14:00/12:00. Mobile có lựa chọn cash/voucher/points. Các chuỗi UI/mock không phải approval và không xác nhận timezone. | [FE booking](../../../FE/src/pages/public/BookingPage.jsx), [FE guest](../../../FE/src/pages/guest/GuestDashboardPage.jsx), [mobile constants](../../../mobile-app/src/utils/constants.ts), [mobile bookings](../../../mobile-app/src/screens/customer/MyBookingsScreen.tsx) |
| O9 | Knowledge cũ vẫn approved=false, dựa bộ dữ liệu khác: Suite capacity 4; service ID 1 là nước, ID 2 buffet, giặt theo Kg. Seed hiện tại là Suite 3; ID 1 Breakfast Set, ID 2 Airport Transfer, ID 3 laundry package. Không ghép bằng ID trần hoặc lấy chéo tiện nghi. | [room draft](../faq/room-catalog.md), [service draft](../services/usage-guide.md), [booking draft](../faq/booking-guide.md), [knowledge notes](../README.md) |
| O10 | D1 là FAQ có gate, business broker chưa triển khai. Source allowlist chưa chứa tài liệu này. Draft/synthetic không phải facts được approved gate xác minh. | [architecture](../../docs/architecture.md), [process](../../docs/PROCESS.md), [allowlist](../../app/ingestion/snapshot.py) |

Source hashes lúc soạn:
- schema_v4_clean.sql: 9529de29f1e62571ce96555fc05dd72b6aa9e461d1412e03ad48ef5845a32c55.
- dummy_data.sql: 5a3cdc92c493c1be7d77dc3a2b2ab384a47adb1e6a0919942f4abad78fa804d2.
- Hash chỉ định danh bytes; không cấp semantic approval.

## COMMON Common conventions

### Giả định và phạm vi chung

| ID | Giả định AI đề xuất, lý do và phạm vi |
| --- | --- |
| A01 | Múi giờ Asia/Ho_Chi_Minh (UTC+07:00). Ngày làm việc là thứ Hai–thứ Sáu trong lịch demo, không tự tra lịch nghỉ lễ; đếm từ ngày làm việc kế tiếp sau sự kiện, hạn là 23:59:59 của ngày thứ N. Mốc 24 giờ là thời lượng liên tục, không dùng phép đếm ngày làm việc. Các SLA là mục tiêu giả lập, chưa được triển khai. |
| A02 | VND; giá phòng và dịch vụ dùng trong công thức là trước thuế demo. Dùng số nguyên VND, làm tròn HALF_UP cọc, phí sớm/muộn, thuế và phần cọc được hoàn H; phí hủy F là phần còn lại, không làm tròn lần hai. Chọn phép tính thuế demo 10% trước giảm hóa đơn để không mâu thuẫn calculator/seed; không tuyên bố đây là chính sách thuế pháp lý. |
| A03 | Cọc 30% tiền phòng sau voucher/giảm phòng, trước thuế và dịch vụ; giữ chỗ 15 phút. Mượn giá trị O3/O4 để dễ đối chiếu, là giả định Academic Demo đã được người dùng duyệt nội dung, không phải dữ liệu khách sạn thực tế. |
| A04 | Check-in 14:00, check-out 12:00; chọn mốc UI làm giả định, không coi UI là policy đã duyệt. Phí sớm/muộn theo POL-02, đều cần chấp thuận tình trạng phòng. |
| A05 | Hủy trước actual check-in: số ngày lịch d >=3 / 1–2 / <=0 tương ứng tỷ lệ hoàn phần cọc hiệu dụng 100% / 50% / 0%. Chọn tương thích dạng calculator; không đổi thành mốc giờ. |
| A06 | Chỉ tính tiền đã thu và đối soát; deposit_required không phải bằng chứng đã thu. Mỗi đồng được phân bổ duy nhất cho phòng, dịch vụ riêng, phí sớm/muộn hoặc tiền chưa phân bổ. Quyết định hoàn có snapshot và mã xử lý riêng để không tính lại phí hoặc hoàn hai lần. |
| A07 | v0.1 chỉ đề xuất hoàn tiền thật qua kênh được đối soát; không quy đổi voucher/points trong phạm vi draft. Nhánh O5/mobile vẫn tồn tại và khác đề xuất, chưa bị tắt. |
| A08 | Mỗi người, kể cả trẻ sơ sinh, tính một chỗ trong capacity. Có người chịu trách nhiệm >=18 tuổi tại ngày check-in; dưới 18 đi cùng người giám hộ. Không thêm giường, suất ăn miễn phí hoặc quyền vượt capacity. |
| A09 | Service chỉ được nhận theo catalogue đang active và báo giá được chấp nhận; không suy ra SLA/giờ mở cửa từ tên. Yêu cầu trước check-in xử lý thủ công riêng. |
| A10 | Hoàn: xác minh mục tiêu <=3 ngày làm việc từ refund_information_completed_at; gửi hoàn <=5 ngày làm việc từ refund_approved_at. Complaint: xác nhận tiếp nhận <=24 giờ từ complaint_received_at, phản hồi hướng xử lý <=3 ngày làm việc từ complaint_received_at, kết luận ban đầu <=7 ngày làm việc từ information_completed_at. Không phải cam kết app/ngân hàng đã thực hiện. |
| A11 | Mặc định không tiếp nhận thú cưng; yêu cầu đặc biệt/động vật hỗ trợ cần quản lý xem xét trước khi xác nhận booking. Không tự thêm phụ phí hoặc dịch vụ dành cho pet. |
| A12 | Privacy: chỉ dữ liệu giả lập; log gốc và log trong backup cùng hạn 14 ngày từ lúc log được tạo. DB/snapshot/backup không chứa log tối đa 30 ngày sau ngày kết thúc demo được nhóm ghi nhận. Bản khôi phục tối đa 24 giờ từ lúc tạo và không vượt hạn gốc của bất kỳ dữ liệu nào bên trong; ngoại lệ gia hạn phải được ghi riêng theo POL-10. Đây là giả định vòng đời, chưa có job xóa hoặc xác nhận đã xóa. |
| A13 | Khi khách sạn không thể cung cấp phần lưu trú chưa sử dụng: đề xuất trả lại toàn bộ khoản phòng chưa sử dụng đã thu, không phí hủy phần đó. Các khoản dịch vụ đã thực hiện vẫn phải đối soát riêng. Ngoại lệ cần quản lý ghi nhận, không tạo quyền lợi bù thêm tự động. |
| A14 | M1: ưu tiên thu phí sớm/muộn khi thực hiện; trả trước chưa được cung cấp thì hoàn cả phí và phần thuế đã thu tương ứng. Phần đã cung cấp không tự hoàn. Tách E0 khỏi P0/C0/U0 để tránh tính hai lần; thiếu chứng cứ phân bổ thì chuyển nhân viên. |
| A15 | M2: amendment ưu tiên cho booking CONFIRMED chưa check-in, báo giá hiệu lực 15 phút từ quote_issued_at, không kéo dài giữ chỗ ban đầu. Chỉ áp khi khách chấp nhận và đủ nghĩa vụ bổ sung trước quote_expires_at; thất bại/hết hạn chỉ bỏ amendment, không hủy/phạt booking gốc. Giảm giá trị xử lý cọc dư theo POL-03. Chọn 15 phút để nhất quán cửa sổ demo, không phải khả năng backend đã có. |
| A16 | M3: booking thông thường có ngày đến sau ngày tạo tại UTC+07:00. Ngày đến trước ngày tạo bị từ chối; cùng ngày/walk-in là luồng riêng cần nhân viên xác nhận giờ tiếp nhận và phòng. Không suy ra cutoff tự động; sau 22:00 vẫn cần thỏa thuận đến muộn. |
| A17 | N1/N2: event time là thời điểm sự kiện có chứng cứ đáng tin; processing time là thời điểm xử lý. Không đổi mốc quyền lợi chỉ vì xử lý chậm. Nhân viên xác nhận checklist, ghi timestamp và người chịu trách nhiệm; thiếu chứng cứ thì xử lý thủ công, không dùng model chọn mốc. |

Các con số và điều kiện A01–A17 là giả định Academic Demo, AI_GENERATED_SYNTHETIC, status=approved, approval_status=approved, approved=true theo phê duyệt của người dùng.
Người dùng đã phê duyệt A01–A17 và chi tiết N1–N4 ngày 22/11/2026 cho Academic Demo; hiệu lực từ 22/11/2026; chưa ingestion, chưa có approved fact catalog hoặc nghiệm thu D1.
Version đầu tài liệu định danh bản tổng hợp; khi ghi nhận approval bỏ hậu tố -draft: bản tổng hợp và chín policy là 0.1.1, riêng POL-07 là 0.1.0; không đổi quy tắc.
Policy version áp dụng phải được gắn với booking và đồng ý trước xác nhận; schema hiện chưa có binding đó.
Booking hiện có không được tự gắn v0.1. Nếu không biết phiên bản hoặc số tiền đã thu, chuyển review thủ công,
không tự chọn policy mới nhất, mức hoàn cao nhất hoặc số tiền từ model.

### Từ vựng tiền và công thức của draft

- G: tổng tiền phòng các đêm đã xác nhận trước giảm giá. B_first/B_last: đơn giá đêm đầu/cuối đã ghi nhận trong booking, trước giảm phòng và thuế, không phải giá catalogue mới tra.
- A_room: giảm giá phòng/voucher đã được backend chấp nhận; R = max(G - A_room, 0).
- D_req = round_HALF_UP(30% * R). Cọc là khoản ứng trước được khấu trừ, không phải phụ phí hoặc tiền bảo đảm hư hại.
- S: tổng các dòng dịch vụ được đưa vào hóa đơn, mỗi dòng = quantity * unit_price_applied - discount_amount; không trừ giảm của dòng lần thứ hai.
- E: tổng phí nhận sớm/trả muộn đã được chấp thuận, trước thuế; phí này chưa có loại dòng riêng được triển khai.
- Tax = round_HALF_UP(10% * (G + S + E)).
- A_bill gồm A_room và các khoản giảm hóa đơn khác được duyệt, mỗi khoản đúng một lần; không tự thêm/stack quyền lợi loyalty.
- Bill = max(G + S + E + Tax - A_bill, 0). P: tiền thực đã thu cho hóa đơn, đã trừ hoàn trước đó.
- Còn phải thu = max(Bill - P, 0); thu thừa = max(P - Bill, 0), hoàn sau đối soát. Không trừ cọc hai lần.
- Đây là cách diễn đạt policy, không ép invoice.total_amount hoặc folio.totalAmount có cùng tên/nghĩa.
  Bộ dữ liệu có cách biểu diễn net sau cọc; cần adapter và kiểm thử riêng trước khi áp dụng vào app.

Tại một quyết định hủy, chụp số dư ngay trước lần xử lý đầu:
- P0: tiền phòng thực thu còn giữ ngay trước quyết định, gồm cả thuế phòng đã thu; trừ các khoản hoàn/đảo tiền xảy ra trước quyết định này. Không trừ refund thuộc chính quyết định này thêm lần nữa; không gồm tiền dịch vụ riêng hoặc phí sớm/muộn.
- C0: tiền dịch vụ còn giữ cho phần chưa cung cấp đã được nhân viên xác nhận đủ điều kiện hoàn, gồm phần thuế đã thu tương ứng. E0: tiền phí sớm/muộn còn giữ cho phần chưa cung cấp được duyệt hoàn, gồm phần thuế đã thu tương ứng. Không đưa phần đã cung cấp vào C0/E0.
- U0: tiền chưa phân bổ còn giữ. P0/C0/E0/U0 rời nhau, đều không âm; một receipt có thể tách thành các phần nhưng tổng không vượt số còn giữ. C0/E0 đã gồm thuế thì không cộng thuế lần nữa.
- Nhân viên xác định phần phí/dịch vụ đã cung cấp từ báo giá, dấu vết sử dụng và phân bổ thuế của hóa đơn gốc. Tổng thuế phân bổ phải bằng Tax gốc, không làm tròn riêng để tăng tổng. Không mặc định chia đều theo giờ; thiếu tỷ lệ/phần thuế có chứng cứ thì chưa tính số hoàn cuối cùng.
- D_eff = min(D_req, P0). r theo ngày lịch, biểu diễn là 1 / 0.5 / 0 cho 100% / 50% / 0%.
- H = round_HALF_UP(r * D_eff) là phần cọc được hoàn; F = D_eff - H là phí giữ lại. Chỉ làm tròn H, không làm tròn riêng cả hai phía; cách này cùng thứ tự với calculator hiện có.
- Phí hủy F là khoản trọn gói demo; không cộng thuế/phụ phí hủy lần nữa hoặc thu thêm tiền phòng chưa sử dụng.
- Target_room = P0 - F; Target = Target_room + C0 + E0 + U0 cho hủy phòng trước check-in. C0/E0 đã lọc đủ điều kiện ngay từ đầu, không trừ phần đã dùng lần thứ hai. F chỉ áp lên D_eff của phòng, không áp lên C0/E0/U0.
- Hồ sơ chỉ hoàn dịch vụ/phí chưa cung cấp, kể cả sau check-in: Target riêng = C0 + E0 + U0 đủ điều kiện, F=0; không đưa P0 hoặc tự hoàn đêm phòng vào hồ sơ này. Đêm chưa cung cấp do lỗi khách sạn vẫn theo A13/POL-09.
- Freeze P0/C0/E0/U0/D_req/r/F/Target cho cùng mã quyết định. Không tính lại từ số dư giảm dần sau mỗi lần hoàn. Không dùng đồng thời cùng một phần receipt cho hồ sơ hủy phòng và hồ sơ hoàn phí riêng.
- Đã hoàn Completed và đã dành cho lệnh đang xử lý Reserved phải thỏa Completed + Reserved <= Target.
  Số có thể lập lệnh mới = max(Target - Completed - Reserved, 0).
- Nếu thiếu dữ liệu phân bổ/receipt, không tự chạy công thức. Không hoàn quá số thực còn giữ.
  Chuyển khoản sau quyết định được xử lý thành khoản chưa phân bổ riêng, không thu lại phí hủy.

### Timestamp và chứng cứ — N1

- cancellation_received_at là event time hệ thống tiếp nhận yêu cầu hủy hợp lệ: nhận diện được booking, người yêu cầu có quyền đã được xác minh, thể hiện rõ ý muốn hủy và có dấu vết tiếp nhận. Tin nhắn chưa hợp lệ không tự tạo mốc này; khi bổ sung để hợp lệ, ghi mốc tiếp nhận hợp lệ, không tự backdate.
- payment_event_at là thời điểm giao dịch được xác nhận bởi chứng cứ đáng tin: xác nhận ngân hàng/đối soát có định danh giao dịch, số tiền, liên kết booking và timestamp, hoặc receipt tiền mặt do người có trách nhiệm ghi nhận. Ảnh khách gửi hoặc giờ chatbot đọc tin không đủ chứng cứ.
- processing_at/verified_at ghi riêng lúc nhân viên hoặc hệ thống xử lý/xác minh, không thay event time. Với nhiều khoản cọc, mốc đạt đủ tiền là payment_event_at muộn nhất trong tập khoản hợp lệ cần để đủ cọc.
- So sánh event time với T_expire/quote_expires_at; bằng deadline là quá hạn. Nếu chứng cứ tới muộn nhưng xác nhận event time trước hạn, chuyển nhân viên đối soát, không gắn lỗi trễ cho khách hoặc tự khôi phục/cấp phòng trùng. Booking gốc/amendment chỉ có hiệu lực theo các guard riêng, không chỉ vì một timestamp.
- Không xác minh được event time, thứ tự sự kiện hoặc nguồn xung đột: giữ trạng thái cần xử lý thủ công, không tự chọn mốc có lợi cho một bên hoặc dùng processing time thay thế.

## POL-01 Booking Policy

**Policy ID:** POL-01  
**Policy name:** Booking Policy  
**Version:** 0.1.1  
**Status:** approved  
**Scope:** Booking giả lập tạo mới sau khi nhóm chấp nhận thử nghiệm phiên bản này; không áp dụng hồi tố.  
**Source type:** AI_GENERATED_SYNTHETIC  
**Approval status:** approved

### Rule

Giả định A01–A03/A08: mỗi yêu cầu UI chọn một phòng, checkout date sau checkin date; tối thiểu một đêm,
checkout date là đầu mút loại trừ. Nhóm nhiều phòng có thể dùng nhiều đơn độc lập, không cấm một khách có nhiều đơn.
Theo A16, booking thông thường chỉ nhận ngày đến sau ngày tạo booking theo UTC+07:00; ngày đến trước ngày tạo bị từ chối.
Cùng ngày hoặc walk-in phải qua nhân viên xác nhận giờ tiếp nhận, availability, báo giá và thanh toán; không tự coi ngày hợp lệ là được nhận phòng.
Mọi người đều tính vào capacity; dữ liệu phòng lấy theo seed/báo giá có phiên bản, không lấy mô tả knowledge cũ để nâng sức chứa.
Đơn online bắt đầu chờ cọc; chỉ xác nhận khi tiền được đối soát đủ D_req và phòng vẫn được xác nhận giữ.

### Conditions

Mốc T_expire = created_at + 15 phút; mốc đủ cọc theo event time tại COMMON phải < T_expire. Event time >= T_expire là quá hạn.
Ảnh chuyển khoản hoặc thông báo chatbot không phải receipt. Chứng cứ tới muộn hoặc không đủ tin cậy theo N1 chuyển nhân viên, không hứa tự khôi phục booking.
Đổi ngày/hạng/phòng ưu tiên amendment dưới đây; không mặc định hủy đơn cũ, chuyển cọc sang booking khác hoặc giữ giá catalogue cũ.

### Amendment — báo giá sửa đổi A15

- Phạm vi mặc định: booking CONFIRMED chưa actual check-in. PENDING_DEPOSIT, đã check-in, nhiều booking hoặc ngoại lệ cần nhân viên xử lý riêng; không reset cửa sổ giữ chỗ gốc.
- Nhân viên phát hành quote_id/revision, policy version, chi tiết thay đổi, G/A_room/R/D_req mới, tiền đã thu được phân bổ, số phải bổ sung, giờ nhận/trả dự kiến và xác nhận khả năng cung ứng. Ưu đãi chỉ ghi khi có bằng chứng chấp nhận; thiếu thông tin thì chưa phát hành báo giá cuối.
- Ngày đến sửa đổi không được trước ngày phát hành/chấp nhận quote tại UTC+07:00; cùng ngày cần nhân viên xác nhận như admission A16. Đổi ngày không tự tạo quyền nhận muộn hoặc bỏ kiểm tra tuổi.
- quote_expires_at = quote_issued_at + 15 phút (giả định mới A15, độc lập với T_expire gốc). Khách phải chấp nhận đúng revision tại accepted_at < quote_expires_at và đủ số bổ sung theo event time < quote_expires_at. Bằng deadline là quá hạn; quote thay thế không được tái dùng acceptance của revision cũ.
- Cọc đã nhận còn giữ, chưa dành cho refund/lệnh khác, được tính vào D_req mới theo POL-03. Không cần giao dịch 0 nếu không phải bổ sung; chỉ cần chấp nhận đúng báo giá trước hạn và đủ các điều kiện khác.
- Chỉ khi đủ acceptance, tiền và xác nhận khả năng cung ứng mới ghi nhận một lần amendment có hiệu lực; lúc đó mới đổi ngày/phòng/giá/D_req và version áp dụng. Trước đó, booking gốc giữ ngày/phòng/giá/D_req/trạng thái hiện hữu.
- Không chấp nhận, từ chối hoặc hết hạn mà thiếu tiền/acceptance: bỏ riêng amendment, không hủy booking gốc và không áp F cho booking gốc. Phần tiền bổ sung đã nhận nhưng chưa được áp dụng là khoản chưa phân bổ được hoàn theo POL-05, không tự thu phí; khoản không rõ mapping cần đối soát.
- Quote chờ xử lý không gia hạn/đóng băng điều kiện độc lập của booking gốc: yêu cầu hủy hợp lệ, no-show hoặc thỏa thuận đến muộn vẫn theo policy gốc đang có hiệu lực, không dựa vào hạn quote để giữ chỗ thêm.
- Nếu event time đúng hạn nhưng xử lý muộn hoặc phòng đã thay đổi, giữ booking gốc trong lúc nhân viên giải quyết; không tự cấp hai phòng hoặc quy lỗi chậm xử lý cho khách. Không thực hiện được cam kết đã nhận thì xét A13/POL-09, không tự tính phạt khách.
- Hủy booking gốc là yêu cầu hủy hợp lệ riêng theo POL-04; nếu amendment chưa có hiệu lực thì dùng thông số gốc. Nếu đã có hiệu lực thì dùng ngày đến/D_req và policy version của booking đã sửa. Hủy gốc đồng thời chấm dứt quote chưa áp dụng, không áp hai phí hủy.

### Exceptions

D_req=0 do R=0 hoặc do làm tròn khi R vẫn dương: xử lý xác nhận thủ công, không tạo chuyển khoản 0 đồng; vẫn có thể còn tiền phòng/thuế/phí trong Bill.
Tiền thiếu hoặc có event time sau hết hạn không khôi phục booking; trả lại khoản chưa phân bổ theo POL-05.
Đến sau 22:00 cần thỏa thuận tiếp nhận trước với nhân viên, không hứa lễ tân 24/7.
Chưa có cơ sở cho cutoff walk-in/cùng ngày cố định: phải được nhân viên xác nhận cụ thể trước khi nhận tiền/xác nhận tiếp nhận; mốc 22:00 không phải lời hứa luôn nhận khách trước giờ đó.
Không có thỏa thuận đến muộn và không actual check-in: đề xuất no-show từ 00:00 ngày kế tiếp ngày đến,
xử lý như hủy d<=0, không cộng thêm phạt ngoài F. Chưa có job no-show của draft.

### Examples

Standard trong seed capacity 2: hai người đủ điều kiện sức chứa nhưng chưa chứng minh còn phòng.
Tạo đơn 10:00, đủ cọc được ghi nhận 10:14:59: đạt mốc tiền; tại 10:15:00: quá hạn theo draft.
Hai đơn cho hai phòng cùng ngày được đánh giá riêng; hủy một đơn không tự hủy đơn kia.
Tạo ngày 11/12, yêu cầu đến 10/12: từ chối booking thông thường. Đến 11/12: chuyển luồng nhân viên, kể cả trước 22:00.
Quote 10:00 hết hạn 10:15, khách chưa chấp nhận hoặc chưa đủ tiền trước 10:15: bỏ amendment; booking gốc và cọc gốc giữ nguyên.

### Source observations and implementation status

O1–O3/O10: có ngày, booking state, QR và expiry job; chưa có policy-version binding, guard tuổi,
xác nhận D=0, hoặc kiểm chứng toàn bộ create paths theo capacity. Biên expiry hiện dùng isAfter khác giả định tại đúng deadline.
Chưa có quote/amendment atomic, giữ availability cho quote, timestamp contract hoặc admission guards theo A15–A17 được chứng minh; đây là quy trình đề xuất thủ công.
Đây là đề xuất, không bảo đảm mọi điều kiện đã được backend cưỡng chế.

## POL-02 Check-in / Check-out Policy

**Policy ID:** POL-02  
**Policy name:** Check-in / Check-out Policy  
**Version:** 0.1.1  
**Status:** approved  
**Scope:** Nhận/trả phòng của booking giả lập đã được xác nhận và gắn đúng phiên bản.  
**Source type:** AI_GENERATED_SYNTHETIC  
**Approval status:** approved

### Rule

Giả định A04: check-in chuẩn từ 14:00 ngày đến; trả phòng không muộn hơn 12:00 ngày đi, theo A01.
Nhân viên xác minh người đại diện/nhóm khách qua màn hình nghiệp vụ và phòng sẵn sàng; không gửi giấy tờ vào chat.
Chỉ áp phí khi khách đồng ý và nhân viên xác nhận có thể nhận sớm/trả muộn.
Theo A14, ưu tiên thu phí khi thực sự cung cấp phần thời gian đã chấp thuận; tiền thu trước chưa tự chứng minh đã cung cấp.

| Thời điểm giả lập | Cách tính trước thuế |
| --- | --- |
| Nhận trước 06:00 ngày đến | Phải xác nhận thêm đêm trước theo báo giá; không cộng thêm phí early check-in cho cùng phần thời gian |
| Nhận từ 06:00 đến trước 10:00 | 50% B_first |
| Nhận từ 10:00 đến trước 14:00 | 30% B_first |
| Nhận từ 14:00 | Không phí nhận sớm |
| Trả <=12:00 | Không phí trả muộn |
| Trả >12:00 và <=15:00 | 30% B_last |
| Trả >15:00 và <=18:00 | 50% B_last |
| Trả >18:00 | Phải xác nhận thêm đêm theo báo giá; không cộng thêm phí late check-out cho cùng phần thời gian |

### Conditions

Các khoản 30%/50% chỉ là giả định A04; tính theo đơn giá booking trước giảm/thuế, không lấy giá mới từ catalogue.
Không áp voucher phòng thêm lần nữa lên phí sớm/muộn. Các phí này vào E và chịu thuế demo A02.
Đêm bổ sung vào G của báo giá sửa đổi; trước check-in theo amendment POL-01/POL-03, không mặc định hủy booking gốc.
Sau actual check-in, thêm đêm cần thỏa thuận nhân viên và đối soát phần còn phải thu; không dùng cửa sổ amendment trước check-in để tự sửa trạng thái lưu trú.
Nếu thiếu B_first/B_last hoặc giá đêm thêm, chưa thể báo số cuối cùng.
Phí đã thu trước cho phần chưa cung cấp được hoàn cả phí và thuế đã thu tương ứng khi hủy hợp lệ, ghi duy nhất trong E0 theo COMMON/POL-05.
Nếu đã cung cấp một phần, chỉ phần chưa cung cấp có chứng cứ và được nhân viên xác nhận mới vào E0; phần đã cung cấp không tự hoàn.
Không chia tỷ lệ theo số giờ nếu báo giá/dấu vết không xác định cách chia; thiếu dữ liệu thì chuyển nhân viên, chưa báo số hoàn cuối.

### Exceptions

Không còn phòng/nhân viên chưa duyệt: giờ chuẩn tiếp tục áp dụng, không có quyền tự ở thêm.
Nếu đã ở quá giờ mà chưa được duyệt, nhân viên giải quyết thủ công và ghi thỏa thuận, không để AI tự tạo phạt.
Rời sớm sau actual check-in không tự hoàn đêm đã xác nhận; theo POL-05/POL-09 để xét ngoại lệ.
Nếu lỗi cung ứng của khách sạn: A13, không tự tặng nâng hạng hay dịch vụ.

### Examples

B_first=B_last=850000 chỉ để minh họa theo đơn giá Standard trong seed:
09:59 tính 425000; 10:00 tính 255000; 14:00 tính 0.
Phí 255000 cộng thuế demo 25500 thành 280500 khi minh họa riêng phí đó.
Khi lập Bill, Tax chỉ tính một lần trên tổng G+S+E; không cộng thêm thuế của phí lần thứ hai.
Trả 15:00 tính 255000; 15:01 tính 425000; 18:00 tính 425000.
18:01 cần duyệt thêm đêm, không tự cộng cả 50% phí muộn lẫn giá một đêm.
Đã trả trước early fee 255000 + thuế 25500, hủy hợp lệ trước khi nhận sớm: E0=280500; không đưa thêm vào P0/C0/U0.
Ca phân bổ đã được nhân viên xác nhận: phí gốc 255000, phần đã cung cấp 85000, chưa cung cấp 170000;
thuế gốc 25500 tách 8500/17000. E0=187000, phần đã cung cấp 93500 không tự hoàn; đây là input minh họa, không tạo quy tắc chia ba theo giờ.

### Source observations and implementation status

O6/O8: có đổi trạng thái check-in/out và UI 14:00/12:00. Chưa có biểu phí theo giờ,
đảm bảo availability cho phần giờ mở rộng, tuổi/giấy tờ đầy đủ hoặc adapter cho E.
Quy tắc này cần xử lý thủ công/triển khai sau, chưa phải khả năng đang hoạt động.

## POL-03 Deposit & Payment Policy

**Policy ID:** POL-03  
**Policy name:** Deposit & Payment Policy  
**Version:** 0.1.1  
**Status:** approved  
**Scope:** Cọc giữ phòng, ghi nhận tiền thực thu, tất toán và thu thừa của kịch bản Academic Demo.  
**Source type:** AI_GENERATED_SYNTHETIC  
**Approval status:** approved

### Rule

Giả định A02/A03/A06: D_req=30% R làm tròn HALF_UP, trong 15 phút theo POL-01.
Đây là ứng trước để khấu trừ Bill, không phải phí đặt chỗ hoặc cọc tài sản.
v0.1 đề xuất tiền mặt tại quầy hoặc chuyển khoản được đối soát; không hứa hỗ trợ mọi loại thẻ/ví.
Phần còn phải thu được đối soát và thanh toán khi checkout; chỉ xác nhận PAID/CHECKED_OUT khi số dư đã xử lý đầy đủ.
Không tự cộng quyền lợi loyalty chưa được duyệt hoặc trừ voucher/cọc hai lần.

### Conditions

Cho phép nhận nhiều khoản cọc một phần trong cửa sổ giữ chỗ, nhưng chỉ xác nhận khi tổng đã đối soát đủ D_req.
Nhân viên phải kiểm tra quyền, loại tiền, phân bổ và dấu vết từng receipt; không suy ra đã thu từ booking status.
Mỗi khoản chỉ ghi nhận một lần. Trạng thái chờ ngân hàng/đang xác minh không coi là đã thanh toán.
Phần ứng trước vượt D_req có thể giữ làm credit cho Bill nếu khách đồng ý; khác với thu thừa cuối cùng max(P-Bill,0), phải hoàn sau đối soát, không trừ Bill lần nữa.

Amendment theo POL-01: D_new=round_HALF_UP(30% * max(G_new-A_room_new,0)).
D_held là cọc phòng thực còn giữ, chưa hoàn hoặc Reserved cho lệnh khác; không dùng tiền dịch vụ/phí để tự bù cọc.
Topup=max(D_new-D_held,0); khách phải hoàn thành nghĩa vụ này trước hạn quote. Cọc gốc không bị thu lần hai.
Nếu giảm giá trị, Excess_deposit=max(D_held-D_new,0). Khi amendment có hiệu lực, khách chọn ghi phần dư làm ứng trước phòng cho Bill mới hoặc hoàn phần đó theo POL-05 với F=0.
Không có lựa chọn thì nhân viên xin xác nhận, chưa tự áp dụng amendment có phần dư; lựa chọn là một phần acceptance của quote.
Khoản hoàn cọc dư có mã quyết định/receipt riêng, nằm trong cap tiền còn giữ và không trùng Completed/Reserved của hồ sơ khác.
Đây là giảm nghĩa vụ cọc qua amendment, không phải hủy phòng; không áp bảng r. Nếu giữ dư làm ứng trước, hủy sau này chỉ dùng D_new làm cap D_eff, không dùng toàn bộ khoản giữ làm phí hủy.
Nếu D_new=0, không tạo giao dịch 0; xác nhận nhân viên và lựa chọn phần dư trước hạn, các nghĩa vụ Bill khác vẫn giữ. Ưu đãi không được tự khôi phục/stack; thiếu quyết định voucher/loyalty thì báo giá cần nhân viên xác nhận.

### Exceptions

Thiếu cọc tới deadline: hết hạn; hoàn phần đã nhận chưa phân bổ, không phạt hủy của booking đã xác nhận.
Nếu tiền chưa về hoặc không xác minh được: chờ đối soát, không hứa refund ngay.
D_req=0 luôn cần thủ công, kể cả tiền phòng dương nhưng cọc làm tròn thành 0; miễn/giảm tiền phòng không tự miễn thuế demo hoặc dịch vụ.
Không đề xuất khoản cọc hư hại riêng. Thiệt hại cần bằng chứng và thỏa thuận thủ công theo POL-09.

### Examples

Hai đêm Standard: G=1700000, không giảm, D_req=510000. Cọc 300000 rồi 210000 trước hạn là đủ.
Thêm 2 Breakfast Set: S=360000, E=0, Tax=206000, Bill=2266000, còn phải thu sau cọc=1756000.
Nếu có giảm phòng 100000: R=1600000, D_req=480000; Tax vẫn 206000,
Bill=2166000 và còn phải thu=1686000. Đây là phép tính demo, không phải báo giá live.
Tăng từ G=1700000 lên G_new=2550000, A_room_new=0, D_held=510000: D_new=765000, Topup=255000; không thu lại 765000.
Giảm xuống G_new=850000, A_room_new=0: D_new=255000, Excess_deposit=255000. Khách chọn hoàn 255000 hoặc giữ ứng trước; không F.

### Source observations and implementation status

O2–O4/O6: cọc và công thức tiền có trong code, nhưng key config search/tạo đơn khác nhau.
Folio/net-total và trạng thái PAID cần đối soát adapter; nhánh settleCheckout chưa chứng minh chặn thanh toán thiếu.
Không nói policy này đã được backend enforce hoặc chuyển tiền đã xảy ra.
Topup, cọc dư, lựa chọn credit/refund và chốt quote theo amendment là contract synthetic đề xuất, chưa được backend bảo đảm.

## POL-04 Cancellation Policy

**Policy ID:** POL-04  
**Policy name:** Cancellation Policy  
**Version:** 0.1.1  
**Status:** approved  
**Scope:** Hủy booking đã xác nhận, chưa actual check-in; pending/expired và no-show có nhánh riêng.  
**Source type:** AI_GENERATED_SYNTHETIC  
**Approval status:** approved

### Rule

Giả định A05/A06/A17: dùng cancellation_received_at, thời điểm hệ thống tiếp nhận yêu cầu hủy hợp lệ theo checklist N1 tại COMMON;
lấy ngày địa phương của event time đó, không lấy ngày nhân viên chậm xử lý. d = ngày đến - ngày nhận yêu cầu hợp lệ theo lịch A01.

| d | r cho phần cọc hiệu dụng | Phí F |
| --- | --- | --- |
| >=3 ngày lịch | 100% | 0 |
| 1 hoặc 2 ngày lịch | 50% | D_eff - H, với H làm tròn theo COMMON |
| 0 hoặc âm, vẫn chưa check-in | 0% | D_eff |

Phí tối đa bằng D_eff; không tự thu thêm toàn bộ tiền phòng chưa sử dụng hay một khoản no-show thứ hai.
Khoản trả trước vượt D_eff không bị giữ chỉ vì khách đã trả trước nhiều hơn; xem POL-05.

### Conditions

Yêu cầu qua luồng nghiệp vụ sau kiểm tra quyền; không chỉ dựa mã booking trong chat.
Thời điểm nhận và policy version phải có bằng chứng. Xử lý từng booking độc lập.
Đổi ngày/phòng không mặc định miễn phí hủy; cần thỏa thuận/báo giá mới trước khi hủy đơn cũ.
Các khoản service đã thực hiện là phần đối soát riêng, không nằm trong cọc phòng.
Quote amendment chưa áp dụng không đổi ngày đến hoặc D_req để tính hủy. Amendment đã có hiệu lực dùng thông số đã chốt; hết hạn quote không phải sự kiện hủy booking.

### Exceptions

PENDING_DEPOSIT/EXPIRED chưa thành booking được xác nhận: không phí hủy, trả khoản chưa phân bổ đã nhận.
Sau actual check-in: không dùng bảng này; regular billing/early departure theo POL-05/POL-09, không cộng F.
No-show theo POL-01 dùng d<=0, trừ khi có thỏa thuận đến muộn còn hiệu lực.
Lỗi cung ứng của khách sạn theo A13 được miễn F cho phần chưa cung cấp; lý do cá nhân/đặc biệt
cần quản lý duyệt ngoại lệ bằng văn bản, không tự suy ra được hoàn toàn bộ.

### Examples

Ngày đến 10/12/2026: yêu cầu nhận 07/12 lúc 23:59 có d=3; sang 08/12 lúc 00:00 có d=2.
Đây không phải mốc 72 giờ trước 14:00 ngày đến.
Với D_eff=510000: ngày 07/12 phí 0; ngày 08–09/12 phí 255000; ngày 10/12 phí 510000.
Chưa check-in tới ngày 11/12 cũng không tự tăng phí quá 510000.
Yêu cầu hợp lệ được hệ thống tiếp nhận 07/12 23:59, nhân viên xử lý 08/12 09:00: d=3, không đổi thành d=2.
Chỉ có tin chưa xác minh 07/12, tới 08/12 mới tiếp nhận đủ điều kiện hợp lệ: dùng mốc hợp lệ 08/12; không tự backdate. Nếu không chứng minh được mốc: chuyển nhân viên.

### Source observations and implementation status

O4/O5: dạng bậc ngày tương tự calculator; code dùng LocalDate.now lúc xử lý, chưa lưu received_at theo draft,
timezone/policy binding cũng chưa đủ. Bảng không tự áp cho booking cũ.
Nhánh hủy cũ không kèm refund và nhánh cancel-with-refund cần được nhóm chọn rõ, chưa sửa code.

## POL-05 Refund Policy

**Policy ID:** POL-05  
**Policy name:** Refund Policy  
**Version:** 0.1.1  
**Status:** approved  
**Scope:** Hoàn phòng trước check-in, tiền chưa phân bổ/thu thừa và các khoản service được duyệt hoàn.  
**Source type:** AI_GENERATED_SYNTHETIC  
**Approval status:** approved

### Rule

Giả định A06/A07/A10: dùng công thức Target và freeze snapshot tại COMMON.
Chỉ trả tiền đã thu, ràng buộc Target và số đã hoàn/đang dành cho lệnh khác; không refund dựa riêng deposit_required.
Các khoản phòng chưa sử dụng sau hủy không được tính thêm thuế/phí ngoài F.
Trong v0.1 chỉ hoàn tiền thực qua kênh đã xác minh; không đổi sang voucher/points và không vừa hoàn tiền vừa bảo lưu cùng khoản.

### Conditions

Dự kiến xác minh trong 3 ngày làm việc từ refund_information_completed_at, tức thời điểm thông tin tối thiểu
và quyền xử lý đã đủ; nếu thiếu phải thông báo phần thiếu, không coi hồ sơ tự được duyệt.
Sau refund_approved_at, mục tiêu gửi lệnh hoàn trong 5 ngày làm việc. Hai mốc này không thay ngày nhận yêu cầu hủy dùng ở POL-04.
Checklist và trách nhiệm tại POL-09 áp dụng cho refund: booking/policy version, quyền yêu cầu, receipt và timestamp đáng tin, phân bổ P0/C0/E0/U0, phần đã cung cấp, thuế, Completed/Reserved và kênh nhận hoàn đã xác minh trong luồng bảo vệ.
Không yêu cầu khách đưa giấy tờ/số tài khoản vào chat; chỉ dùng định danh tham chiếu trong tài liệu/corpus.
Nhân viên tiếp nhận được nhóm chỉ định xác nhận bộ tối thiểu đã đủ và ghi refund_information_completed_at cùng bằng chứng/người xác nhận; người phê duyệt có thẩm quyền là vai trò riêng, không phải AI. Chưa có cá nhân được bổ nhiệm.
Trạng thái đề xuất: RECEIVED -> WAITING_INFORMATION hoặc READY_FOR_REVIEW -> UNDER_REVIEW -> PENDING_APPROVAL -> APPROVED/REJECTED; sau APPROVED mới SENT và CONFIRMED_RECEIVED khi có bằng chứng.
Trong 3 ngày làm việc là kiểm tra hồ sơ, không phải tự phê duyệt. Chưa quy định SLA cho thời gian chờ người phê duyệt hoặc ngân hàng, nên không cộng 3+5 để hứa tổng thời gian.
Chờ bổ sung phải nêu phần thiếu, người xử lý và mốc cập nhật; quá hạn kiểm tra/gửi lệnh hoặc chờ duyệt chưa có mốc cập nhật thì ESCALATED theo POL-09. Không coi escalation là tự duyệt hay tự hoàn tiền.
Ghi rõ đang xác minh/đã duyệt/đã gửi/đã nhận; Payment REFUND hoặc nút thành công không tự chứng minh ngân hàng đã trả.
Lệnh pending giữ Reserved; chưa rõ thất bại thì không giải phóng để lập lệnh trùng.
Tiền đến sau expiry/hủy là hồ sơ chưa phân bổ mới, trả 100% sau xác minh, không mở lại đơn hoặc thu phí hủy lần nữa.

### Exceptions

Pending chưa đủ cọc/đơn hết hạn: Target bằng khoản đã nhận chưa phân bổ, F=0.
Không có receipt xác nhận thu: không có cơ sở tính số hoàn; chỉ khi xác nhận không còn tiền thực thu đủ điều kiện ở mọi nhóm (P0=C0=E0=U0=0) thì refund=0.
P0=0 riêng lẻ không loại quyền hoàn tiền dịch vụ/phí chưa cung cấp đủ điều kiện hoặc tiền chưa phân bổ còn giữ.
Sau check-in hoặc checkout: có thể đối soát thu thừa sau Bill và hồ sơ riêng C0/E0/U0 đủ điều kiện theo COMMON; đêm bỏ sớm/dịch vụ đã dùng cần quyết định POL-09.
Không áp bảng hủy phòng trước check-in hoặc tự hứa hoàn đêm chưa ở. Khoản phí đã được hoàn phải được phản ánh một lần trong Bill/ledger điều chỉnh, không đồng thời tạo refund thu thừa cho cùng khoản.
Nếu khách sạn không cung cấp được lưu trú trước check-in: A13; phần dịch vụ đã thực hiện vẫn tách riêng.
Hủy dịch vụ chưa bắt đầu và được nhân viên xác nhận theo POL-08: hoàn tiền trả trước của dịch vụ đó, không trừ F phòng lần nữa.
Phí sớm/muộn theo POL-02: E0 gồm phần chưa cung cấp và thuế đã thu tương ứng; ưu tiên thu khi cung cấp. Phần đã cung cấp không tự hoàn, thiếu bằng chứng phân bổ thì chuyển nhân viên.
Amendment giảm nghĩa vụ cọc đã có hiệu lực: hoàn Excess_deposit được khách chọn, F=0, không áp bảng r; không hoàn hơn phần cọc thực còn giữ hoặc tính trùng hồ sơ hủy phòng.

### Examples

G=1700000, D_req=510000, hủy d=2:
- P0=510000: F=255000, Target_room=255000.
- Trả trước toàn bộ phòng và thuế, P0=1870000: F=255000, Target_room=1615000.
- P0=600000: F=255000, Target_room=345000.
- P0=300000 nhưng booking còn pending rồi hết hạn: F=0, hoàn khoản chưa phân bổ 300000.
Với Target=255000 đã hoàn 100000, còn 155000; nếu 155000 đang Reserved thì không lập thêm lệnh.
Sau khi Completed=255000, yêu cầu lặp có số còn hoàn bằng 0; không tính lại phí từ số dư sau hoàn.
Ca kiểm tra số lẻ, D_req=P0=510001 và r=50%: H=255001, F=255000, Target_room=255001;
không làm tròn cả H lẫn F lên rồi vượt quá tiền thực giữ.
P0=510000, E0=280500 từ early fee chưa cung cấp, C0=U0=0, d=2: F=255000, Target=535500; không giữ 50% E0 và không cộng thuế lần nữa.
Một Breakfast Set chưa cung cấp đã thu 180000 + thuế 18000, được xác nhận hủy: C0=198000; hoàn 198000 nếu chưa có Completed/Reserved, không chỉ 180000.

### Source observations and implementation status

O5: code có REFUND và các lựa chọn bảo lưu khác draft; chỉ tính DEPOSIT và có fallback.
Chưa có refund-case snapshot, khóa chống hoàn đồng thời, ledger phân bổ và theo dõi tiền ngân hàng về theo contract này.
Không dùng quy trình hiện tại để tự đảm bảo cap/Target hoặc SLA. Cần reconcile/duyệt thủ công trước thao tác demo.

## POL-06 Child & Extra Guest Policy

**Policy ID:** POL-06  
**Policy name:** Child & Extra Guest Policy  
**Version:** 0.1.1  
**Status:** approved  
**Scope:** Sức chứa và người chịu trách nhiệm trong booking giả lập; không thêm quyền lợi dịch vụ.  
**Source type:** AI_GENERATED_SYNTHETIC  
**Approval status:** approved

### Rule

Giả định A08: người đại diện >=18 tuổi tại ngày check-in; người dưới 18 cần người giám hộ đi cùng.
Mỗi người kể cả trẻ sơ sinh tính một chỗ. Trong capacity, tiền phòng tính theo phòng/đêm;
v0.1 không thêm phụ thu theo tuổi hoặc người, không tạo giường phụ.
Không cộng số chỗ ngủ suy đoán từ tiện nghi và không tăng capacity để khớp mobile/knowledge cũ.

### Conditions

Nhóm kê khai tổng guestCount, nhân viên kiểm tra tuổi/giám hộ thủ công bằng dữ liệu demo tối thiểu.
Khi đặt, đánh giá tuổi theo ngày check-in dự kiến của booking; khi tiếp nhận kiểm tra lại theo ngày check-in thực tế tại UTC+07:00.
Tuổi là số năm tròn theo ngày sinh; đổi ngày qua amendment phải kiểm tra lại. Không lấy tuổi ở ngày tạo booking để từ chối người đủ 18 tại ngày nhận phòng.
Không tự suy ra tư cách giám hộ, cho phép người chưa đủ tuổi tự lưu trú, hoặc ngoại lệ pháp lý từ quan hệ tên/họ; thiếu bằng chứng cần nhân viên xác nhận.
Giữ đúng hạng và capacity của nguồn được xác nhận cho booking.
Số trẻ không tạo quyền ăn sáng, minibar hay dịch vụ miễn phí; dịch vụ theo đơn vị catalogue và POL-08.
Không đưa tuổi/ngày sinh/giấy tờ thực vào chat hoặc corpus.

### Exceptions

Vượt capacity: chọn/tách phòng khác theo availability và báo giá, không thu phí để hợp thức hóa vượt chỗ.
Không có người đại diện đủ điều kiện: chưa xác nhận theo draft; quản lý có thể xem phương án giám hộ có bằng chứng,
không tự bỏ điều kiện an toàn. Không có ngoại lệ tự động thêm giường/khách.
Yêu cầu đặc biệt ngoài dữ liệu cần nhân viên trả lời, không suy ra chính sách trẻ em từ schema guestCount.

### Examples

Theo seed: Standard/Deluxe/VIP capacity 2, Suite capacity 3.
Hai người lớn + một trẻ, kể cả sơ sinh: không đủ sức chứa Standard; đủ điều kiện capacity của Suite,
nhưng chưa khẳng định còn phòng. Một người lớn + một trẻ ở Standard không phát sinh phụ thu người;
Breakfast Set vẫn tính riêng theo person nếu được đặt.
Sinh 05/12/2008, đặt 22/11/2026 khi 17 tuổi, check-in 10/12/2026 khi đã 18: đạt điều kiện tuổi của draft, vẫn phải đạt điều kiện khác.
Nếu đổi ngày nhận phòng thực tế về 04/12/2026, người đó vẫn 17 tuổi: cần người giám hộ đủ căn cứ, không dùng kết quả đánh giá ngày 10/12 thay thế.

### Source observations and implementation status

O1/O2/O9: guestCount/capacity có sẵn; không có độ tuổi/giám hộ/extra-bed model.
Search có lọc capacity; không coi đó là chứng minh tất cả create/walk-in paths đã kiểm tra tương tự.
Knowledge cũ nói Suite 4 là xung đột nguồn ngoài draft này, chưa được sửa hoặc approved.

## POL-07 Pet Policy

**Policy ID:** POL-07  
**Policy name:** Pet Policy  
**Version:** 0.1.0  
**Status:** approved  
**Scope:** Yêu cầu mang động vật vào lưu trú theo kịch bản giả lập.  
**Source type:** AI_GENERATED_SYNTHETIC  
**Approval status:** approved

### Rule

Giả định A11: mặc định không tiếp nhận thú cưng trong booking thông thường.
Không đưa “pet-friendly”, pet sitting, khu pet hoặc phụ phí pet vào catalogue khi chưa có nguồn.
Khách cần nêu yêu cầu trước khi đặt; chưa có chấp thuận thì không xác nhận khả năng tiếp nhận.

### Conditions

Yêu cầu đặc biệt, gồm động vật hỗ trợ, được quản lý xem xét riêng trước xác nhận booking.
Nếu chấp thuận, điều kiện phải ghi cùng booking/policy version; không tự suy ra áp dụng cho mọi khách.
Đây là quy tắc nội bộ hư cấu, không phải tuyên bố đã đáp ứng nghĩa vụ pháp lý của cơ sở thực tế.

### Exceptions

Không có ngoại lệ tự động theo kích thước/loài hoặc đóng thêm tiền.
Nếu không được chấp thuận, khách chọn không đặt hoặc hủy theo POL-04/POL-05.
Nếu khách sạn đã xác nhận nhầm khả năng tiếp nhận rồi không thực hiện được, xem A13/POL-09;
không giữ phí như lỗi khách mà chưa đối soát. Không tự đặt phí vệ sinh/hư hại pet.

### Examples

Mang mèo nhỏ và hỏi “trả thêm là được không?”: chưa có quyền tiếp nhận hoặc biểu phí để thu.
Yêu cầu động vật hỗ trợ trước đặt: chuyển quản lý, không trả lời tự động “đã được chấp nhận”.
Đã có điều kiện ngoại lệ cho một booking không đồng nghĩa các booking khác được hưởng.

### Source observations and implementation status

O1: không có pet/exception model; không thấy workflow duyệt ngoại lệ pet trong phạm vi code khảo sát.
Nội dung policy đã được người dùng phê duyệt cho Academic Demo; xử lý vẫn là quy trình thủ công đề xuất, chưa có xác nhận vận hành.

## POL-08 Service Usage Policy

**Policy ID:** POL-08  
**Policy name:** Service Usage Policy  
**Version:** 0.1.1  
**Status:** approved  
**Scope:** Chỉ dịch vụ có trong catalogue seed đang được nhóm dùng và được xác nhận active khi nhận yêu cầu.  
**Source type:** AI_GENERATED_SYNTHETIC  
**Approval status:** approved

### Rule

Giả định A09: đặt qua luồng có quyền với đúng booking/room, quantity nguyên dương và unit/giá được xác nhận.
Yêu cầu trong kỳ lưu trú cần CHECKED_IN; yêu cầu trước check-in như Airport Transfer xử lý thủ công riêng,
không hứa đặt được trên widget/luồng in-stay.
Chỉ tính tiền các dòng đã được chấp nhận, có giá áp dụng; NULL/không rõ không được tự coi là 0 hoặc đổi quantity thành 1.

### Conditions

Dùng đúng unit: Breakfast Set ID 1 theo person; Airport Transfer ID 2 theo trip;
Express Laundry 3kg ID 3 theo package. Gói 3kg không đồng nghĩa đơn giá mỗi Kg.
S phản ánh dòng đã đưa vào hóa đơn; không gộp cả ServiceRequest lẫn ServiceUsage của cùng lần dùng để tính hai lần.
Trạng thái inactive hoặc chưa rõ active/giá: chưa xác nhận cung cấp. Tên “Express”, “45 mins”, “Full Day”
không tự xác nhận giờ mở cửa hoặc thời hạn đáp ứng; nhân viên xác nhận chi tiết trước đặt.

### Exceptions

Được xác nhận hủy trước bắt đầu: không thu/hoàn phần trả trước của dịch vụ đó, tách khỏi phí hủy phòng.
Khoản hoàn C0 gồm phần tiền dịch vụ và thuế đã thu tương ứng; ưu tiên thu khi cung cấp, phân bổ theo COMMON. Phần chưa cung cấp của dịch vụ đã bắt đầu phải được nhân viên xác minh, không tự suy tỷ lệ.
Đã bắt đầu hoặc đã hoàn thành: không tự áp miễn phí/hoàn toàn bộ; nhân viên đối soát mức đã thực hiện và khiếu nại POL-09.
Dịch vụ ngoài catalogue hoặc yêu cầu riêng: chưa có báo giá, không tạo tên/mức phí mới qua AI.
Không mặc định room rate gồm ăn sáng, minibar hoặc các gói welcome; quyền lợi voucher/loyalty chỉ dùng khi có bằng chứng riêng và không trừ hai lần.

### Examples

Hai package laundry theo giá seed 120000/package: trước thuế 240000, thuế demo 24000, tổng 264000;
không diễn giải là hai Kg. Hai Breakfast Set: 360000 trước thuế, không tự giảm giá theo tuổi.
Đặt dịch vụ với quantity=0 hoặc active không rõ: chưa nhận yêu cầu, không tự sửa thành một đơn hợp lệ.

### Source observations and implementation status

O1/O7/O9: có catalogue, request và usage; một số đường gọi hiện fallback quantity/giá hoặc chưa cùng guard.
Đề xuất CHECKED_IN, hủy trước bắt đầu, không tính đôi và đối soát trả trước chưa được bảo đảm trên tất cả endpoint.
Không dùng buffet/nước/Kg từ knowledge cũ thay danh tính service của seed.

## POL-09 Complaint Policy

**Policy ID:** POL-09  
**Policy name:** Complaint Policy  
**Version:** 0.1.1  
**Status:** approved  
**Scope:** Khiếu nại dịch vụ, sai tiền, tiếp nhận phòng, ngoại lệ và phản biện quyết định trong demo.  
**Source type:** AI_GENERATED_SYNTHETIC  
**Approval status:** approved

### Rule

Giả định A10: ghi nhận qua nhân viên/nhóm phụ trách demo. complaint_received_at là mốc nhận phản ánh có dấu thời gian;
xác nhận tiếp nhận <=24 giờ liên tục và hướng xử lý <=3 ngày làm việc từ mốc đó, kể cả hồ sơ còn thiếu.
information_completed_at là lúc có đủ thông tin tối thiểu và quyền xem vụ việc; kết luận ban đầu <=7 ngày làm việc từ mốc đủ thông tin này.
Nếu cần lâu hơn, thông báo lý do/mốc cập nhật; không coi im lặng là đồng ý hoàn tiền.
Vấn đề an toàn cần báo nhân viên ngay, không chờ SLA; không giả có hotline/kênh khẩn cấp đã triển khai.

### Conditions

Chỉ thu thông tin tối thiểu cần cho vụ việc trong kênh nghiệp vụ đã xác minh, không gửi giấy tờ/thông tin thanh toán vào chat RAG.
Nhân viên kiểm tra hóa đơn/receipt, phiên bản và dữ kiện; không lấy câu trả lời AI làm bằng chứng quyết định.
Checklist tối thiểu: (1) định danh vụ việc/booking liên quan và phiên bản áp dụng nếu có; (2) quyền người yêu cầu và kênh phản hồi được xác minh;
(3) nội dung sự việc, thời điểm, yêu cầu xử lý và chứng cứ tối thiểu theo loại vụ việc; (4) với tiền: receipt, event time, phân bổ phí/thuế/phần đã cung cấp và lịch sử hoàn/lệnh đang xử lý;
(5) chỉ khi cần gửi hoàn: kênh nhận hoàn đã xác minh trong màn hình nghiệp vụ. Mục không liên quan ghi không áp dụng, không đòi dữ liệu thừa.
Nhân viên tiếp nhận được nhóm chỉ định xác nhận checklist và ghi information_completed_at khi bộ tối thiểu lần đầu đủ, cùng người xác nhận và dấu vết.
Thời điểm hệ thống nhận phản ánh, thời điểm bộ tối thiểu đủ và processing_at được lưu riêng theo N1; không dời mốc đủ thông tin chỉ vì nhân viên xử lý chậm.
Chưa xác minh được mốc đủ thông tin: ghi cần đối soát, không tự backdate. Nhóm phải chỉ định vai trò tiếp nhận, người duyệt tiền và người giải quyết bất đồng; tài liệu không tự điền tên.
Hồ sơ thiếu ở WAITING_INFORMATION: ghi phần thiếu, người phụ trách và mốc cập nhật đã thông báo. Ack 24 giờ và phản hồi 3 ngày từ complaint_received_at vẫn áp dụng; mốc 7 ngày chỉ bắt đầu khi đủ checklist.
Trong phản hồi 3 ngày phải nêu phần thiếu cụ thể. Không reset information_completed_at bằng cách yêu cầu lại thông tin không cần thiết.
Bất đồng chuyển người review khác/quản lý, giữ dấu vết lý do, không tự điền tên người hoặc coi vai trò đã được bổ nhiệm.
Quá SLA, quá mốc cập nhật đã thông báo hoặc chờ duyệt mà chưa có mốc cập nhật: chuyển ESCALATED, báo lý do/người xử lý/mốc tiếp theo. Không tự tạo quyết định bồi thường.

### Exceptions

Sai khoản thu: sửa/hoàn phần được xác minh và duyệt, không cộng khoản bồi thường không có căn cứ.
Khách sạn không cung ứng: A13. Rời sớm vì lý do cá nhân: không tự hoàn các đêm đã xác nhận; quản lý có thể duyệt ngoại lệ có lý do.
Quyền lợi bù khác cần thỏa thuận riêng; không tự cấp dịch vụ/voucher/loyalty mới.
Sau quyết định hoàn, thời hạn gửi hoàn tính theo POL-05, không nhầm 7 ngày xử lý complaint là hạn ngân hàng trả tiền.
Kiểm tra hồ sơ, kết luận ban đầu, phê duyệt tiền và ngân hàng thực hiện là các giai đoạn riêng. Chưa có thời hạn tổng hoặc SLA phê duyệt/ngân hàng; phải nói rõ đang chờ giai đoạn nào, không cộng các SLA để hứa ngày tiền về.

### Examples

Khách phản ánh bị thu service hai lần: nhân viên đối chiếu cùng lần sử dụng trước khi xác định số sai.
Yêu cầu hoàn sau khi đã check-in vì không dùng hết kỳ nghỉ: hồ sơ ngoại lệ, không chạy bảng r trước check-in.
Qua 7 ngày làm việc kể từ information_completed_at chưa có kết luận: chuyển review/escalation, không tự chốt số bồi thường.
Nhận thứ Sáu 04/12/2026 16:00, đủ thông tin thứ Hai 07/12: xác nhận trước 05/12 16:00;
hướng xử lý hết 09/12; kết luận ban đầu hết 16/12 theo lịch giả lập A01.

### Source observations and implementation status

Schema có audit_log nhưng không có complaint case/SLA/escalation model được thấy trong phạm vi khảo sát.
Chưa có kênh và người phụ trách được chỉ định; các SLA là giả định mới cho quy trình thủ công, không là tính năng app.

## POL-10 Privacy Policy

**Policy ID:** POL-10  
**Policy name:** Privacy Policy  
**Version:** 0.1.1  
**Status:** approved  
**Scope:** Thu thập/sử dụng/lưu giữ dữ liệu của môi trường Academic Demo, gồm bản sao và logs.  
**Source type:** AI_GENERATED_SYNTHETIC  
**Approval status:** approved

### Rule

Giả định A12: chỉ nhập dữ liệu cá nhân và giao dịch giả lập; không dùng danh tính hoặc booking thực để demo.
Đối với FAQ/corpus/model/log trợ lý, không đưa JWT, credential, giấy tờ, liên hệ, hồ sơ khách,
giao dịch hoặc hội thoại cá nhân vào nguồn công khai. Giá/chính sách tĩnh không kèm record khách.
Dữ liệu riêng chỉ xem trong màn hình nghiệp vụ có kiểm tra quyền, không suy quyền từ mã booking/email/SĐT trong chat.

### Conditions

Đề xuất chỉ thu trường cần cho mục đích đặt/lưu trú trong luồng có bảo vệ; thông báo mục đích và phạm vi dùng trong demo.
Không tái dùng dữ liệu cho marketing/chia sẻ bên thứ ba nếu chưa có đồng ý và review riêng.
Các hạn dưới là giả định synthetic A12, áp dụng thủ công; không có automation đã được chứng minh:

| Loại bản lưu | Hạn tối đa và expected behavior |
| --- | --- |
| Log gốc đã làm sạch | 14 ngày liên tục từ log_created_at, không reset theo lúc sao chép |
| Backup chứa log | Cùng hạn log_created_at + 14 ngày của từng log; trước hạn phải loại log đó hoặc xóa cả bản backup nếu không tách được. Backup chứa nhiều log theo hạn sớm nhất của log còn bên trong |
| DB/snapshot/backup demo không chứa log | Ngày kết thúc đợt demo được nhóm ghi nhận + 30 ngày lịch, hết ngày địa phương; chưa chốt ngày kết thúc thì chưa có lịch xóa cụ thể, không tự tuyên bố đã tuân thủ |
| Bản sao tạm phục vụ khôi phục | Không quá 24 giờ liên tục từ lúc tạo và không vượt hạn gốc sớm nhất của dữ liệu bên trong. Bản đưa vào dùng tiếp giữ tuổi/hạn gốc, không được coi là dữ liệu mới |

Nếu bản lưu chứa nhiều loại, áp hạn sớm nhất; không dùng hạn backup 30 ngày để kéo dài log quá 14 ngày.
Trước khi khôi phục phải kiểm tra dấu vết đã xóa/hết hạn; không đưa log hết hạn trở lại. Bản sao khôi phục còn tồn tại thì chưa được báo xóa hoàn toàn.
Nhóm phải kiểm kê cả bản sao trong thư mục backup và bản xuất; không tuyên bố “đã xóa hết” chỉ vì xóa một row.
Yêu cầu xem/sửa/xóa qua nhóm dự án, xác minh người yêu cầu, thông báo kết quả hoặc phần còn phải xử lý; dùng cơ chế POL-09.
Không hứa thời hạn pháp lý, mã hóa, tự động xóa hoặc ngân hàng đã bảo mật khi chưa có bằng chứng.

### Exceptions

Nếu nhập nhầm dữ liệu thật hoặc lộ secret: dừng dùng/chia sẻ phần dữ liệu đó, chuyển người phụ trách xử lý,
không sao chép vào policy, ví dụ hoặc log để “chứng minh”. Không dùng yêu cầu xóa chưa xác minh để xóa dữ liệu người khác.
Giữ dữ liệu ngoài thời hạn chỉ khi nhóm xác nhận lý do cụ thể và phạm vi tối thiểu; ghi ngày kết thúc gia hạn và lịch xem lại,
không dùng ngoại lệ để tuyên bố mọi bản sao mặc nhiên được lưu vô thời hạn.
Ngoại lệ phải chỉ rõ loại/bản sao/record và người có trách nhiệm; nếu giữ log quá 14 ngày phải ghi đây là ngoại lệ giữ log, không âm thầm áp hạn của backup. Khi chưa hoàn tất xóa mọi bản sao, báo đang giữ theo ngoại lệ hoặc còn phần việc.

### Examples

Khách dán thông tin cá nhân vào câu hỏi policy: yêu cầu dùng luồng bảo vệ, không đưa vào FAQ hoặc ví dụ training.
Kiểm thử quyền dùng hai tài khoản giả lập; không xuất danh sách khách thật cho reviewer.
Một backup chưa được xử lý: trạng thái yêu cầu xóa vẫn còn phần việc, không trả “đã xóa hoàn toàn”.
Log tạo 01/12/2026 10:00: log gốc và mọi backup chứa nó hết hạn không muộn hơn 15/12 10:00, trừ ngoại lệ ghi riêng.
Bản khôi phục tạo 14/12 18:00 chứa log đó: hạn là 15/12 10:00, sớm hơn hạn 24 giờ 15/12 18:00; sao chép không reset tuổi log.

### Source observations and implementation status

O1/O2/O5/O10: có trường nhạy cảm trong DTO/DB; có nhánh kiểm tra tài khoản, nhưng audit chỉ đọc code,
không chứng minh toàn bộ ownership, log masking hoặc retention đã đạt.
Không thấy workflow privacy/retention đầy đủ trong phạm vi khảo sát. Chính sách này chưa là cam kết compliance của sản phẩm.

## GAPS Implementation and source conflicts

Các dòng dưới là giới hạn đã quan sát hoặc chưa được chứng minh, không sửa code để che khác biệt.

| ID | Policy liên quan | Khác biệt cần nhóm quyết định/triển khai trước khi áp dụng |
| --- | --- | --- |
| G01 | Tất cả | Không có policy/version binding hoặc approval cho booking; không áp hồi tố. Nội dung đã được người dùng phê duyệt; file vẫn ngoài allowlist, hiệu lực từ 22/11/2026. Cần publisher/fact review riêng, không tự indexing. |
| G02 | POL-01/03 | Hai key deposit config; biên expiry isAfter và job một phút khác deadline chính xác. Draft đã quy định D=0, tiền thiếu/đến muộn, amendment và receipts nhưng backend chưa được chứng minh thi hành các guard/quote/event time đó. |
| G03 | POL-01/02/06 | Tuổi/giám hộ, capacity trên mọi đường tạo, giờ sớm/muộn và availability theo giờ chưa được bảo đảm. Không có extra-bed/age/pet metadata. |
| G04 | POL-03 | settleCheckout có thể nhận amount được cung cấp rồi gán PAID/CHECKED_OUT. Cần kiểm chứng/chặn thanh toán thiếu và ánh xạ folio/net total, không chỉ tin state. |
| G05 | POL-04/05 | Calculator dùng ngày xử lý/LocalDate hệ thống, chưa có received_at theo timezone và policy snapshot. No-show/early departure target cần quy trình riêng. |
| G06 | POL-05 | CREDIT_VOUCHER/LOYALTY_POINTS hiện bảo lưu 100% khác draft tiền thật. Fallback depositRequired không phải receipt; chưa có Target/Reserved/idempotency/refund completion contract. |
| G07 | POL-08 | Luồng services chưa có cùng bộ guard/giá/quantity; hủy chưa bắt đầu, prearrival orders, không tính hai lần và refund service chưa được xác minh end-to-end. |
| G08 | POL-07/09/10 | Pet exceptions, complaint SLA/escalation và privacy/retention là quy trình đề xuất; chưa có người/kênh được chỉ định hoặc automation. |
| G09 | POL-06/08 | Knowledge cũ khác seed về Suite, danh tính service, unit và tiện nghi. Không sửa tài liệu cũ trong task; các nguồn chưa thể gộp thành một corpus được duyệt. |
| G10 | POL-03/05/08 | Seed ghi legacy loyalty chưa giải quyết. Không tự hứa giảm giá/đổi điểm hoặc dùng model tự phê duyệt nội dung; các ví dụ không áp quyền lợi loyalty. |
| G11 | Toàn tài liệu | M4 về publication vẫn mở: section quá dài, phụ thuộc COMMON, synthetic allowlist và schema/vocabulary/renderer chưa chuẩn bị cho toàn bộ policy. Bản sửa này không tạo corpus, không khắc phục ingestion bằng cách xóa qualifiers hoặc đổi nhãn synthetic. |

## CHECKS Consistency specification

Đây là các tình huống kiểm tra tài liệu và phép tính bằng số giả lập; không phải test runtime,
Gold Dataset hay approval. Các mốc giờ đều A01, ngày đến 10/12/2026; B=850000,
G=1700000, A_room=0, D_req=510000, E0=0 nếu không ghi khác. Timestamp trong ca có số tiền cuối cùng giả định đã có chứng cứ hợp lệ theo N1; không suy từ processing time.

| Case | Input | Expected theo draft |
| --- | --- | --- |
| C01 | Hủy 07/12 23:59, P0=510000 | d=3, F=0, Target_room=510000 |
| C02 | Hủy 08/12 00:00, P0=510000 | d=2, F=255000, Target_room=255000 |
| C03 | Hủy 09/12, P0=510000 | d=1, F=255000, Target_room=255000 |
| C04 | Hủy 10/12 trước check-in, P0=510000 | d=0, F=510000, Target_room=0 |
| C05 | Hủy 11/12 nhưng chưa check-in, P0=510000 | d=-1, F=510000, không thêm phạt |
| C06 | Đã xác minh không còn tiền thực thu đủ điều kiện, P0=C0=E0=U0=0 | Hoàn 0; thiếu receipt nhưng state CONFIRMED thì review, không dùng depositRequired thay receipt |
| C07 | Pending trả 300000, chưa đủ 510000 tới deadline | Hết giữ chỗ; khoản chưa phân bổ hoàn 300000, F=0 |
| C08 | Tiền đủ đến đúng phút thứ 15 hoặc sau đó | Không tự xác nhận lại; đối soát hoàn khoản chưa phân bổ, không phạt hủy đã-confirmed |
| C09 | Hủy d=2, P0=1870000 | F=255000; Target_room=1615000 |
| C10 | Hủy d=2, P0=600000 | F=255000; Target_room=345000, không giữ cả khoản vượt cọc |
| C11 | G=1700000, giảm phòng 100000, S=360000, P=480000 | D_req=480000; Tax=206000; Bill=2166000; còn thu=1686000 |
| C12 | Target freeze=255000, Completed=100000, Reserved=0 | Có thể lập lệnh 155000; không tính lại F |
| C13 | Cùng quyết định, Completed=255000 | Không hoàn thêm |
| C14 | Target=255000, Completed=100000, Reserved=155000 | Không lập thêm lệnh; pending không bị coi là completed |
| C15 | Không biết receipt/phiên bản policy | Chưa tính tiền cuối cùng; review thủ công, không chọn policy có lợi hơn |
| C16 | Nhận 05:59 | Cần thêm đêm trước theo báo giá; không cộng thêm phí early cho cùng phần giờ |
| C17 | Nhận 06:00 | Phí 425000 trước thuế |
| C18 | Nhận 09:59 | Phí 425000 trước thuế |
| C19 | Nhận 10:00 | Phí 255000 trước thuế |
| C20 | Nhận 13:59 | Phí 255000 trước thuế |
| C21 | Nhận 14:00 | Phí early=0 |
| C22 | Trả 12:00 | Phí late=0 |
| C23 | Trả 12:01 hoặc 15:00 | Phí 255000 trước thuế |
| C24 | Trả 15:01 hoặc 18:00 | Phí 425000 trước thuế |
| C25 | Trả 18:01, được duyệt đêm thêm | Chỉ giá đêm thêm; không cộng thêm 50% late |
| C26 | Không có phòng cho sớm/muộn hoặc thiếu đơn giá | Không hứa availability hoặc số phí cuối; giờ chuẩn/thỏa thuận thủ công |
| C27 | Hai người lớn + một sơ sinh, Standard capacity 2 | Không đủ capacity; không thu phụ phí để vượt 2 |
| C28 | Hai người lớn + một trẻ, Suite capacity 3 | Đạt capacity; còn phải xác minh phòng, giám hộ và giá |
| C29 | Một người lớn + trẻ, Standard đủ capacity | Không phụ thu người trong draft; không tự tặng Breakfast Set |
| C30 | Hai laundry package giá 120000/package | S=240000; Tax=24000; tổng 264000, không gọi là 2 Kg |
| C31 | quantity=0, giá NULL hoặc active chưa rõ | Chưa nhận yêu cầu; không dùng fallback 1/0 để xác nhận |
| C32 | Airport Transfer trước check-in | Nhân viên xử lý riêng; không hứa widget đặt được hoặc miễn phí |
| C33 | Pet chưa được chấp thuận | Chưa xác nhận tiếp nhận; đóng thêm tiền không tạo quyền |
| C34 | Khách sạn không cung cấp phòng trước check-in, P0=510000 | A13: hoàn phần phòng 510000, F=0; service đã dùng tách riêng |
| C35 | Đã check-in rồi trả sớm | Không chạy bảng r; không thêm phí hủy; review đêm chưa dùng theo POL-09 |
| C36 | G=850000, A_room=850000, S=E=0 | R=D_req=0; Tax=85000, Bill=85000; không tự tạo giao dịch 0 hoặc hứa miễn thuế |
| C37 | Checkout trả ít hơn số còn phải thu | Không xác nhận PAID/CHECKED_OUT theo draft; G04 là khoảng trống code |
| C38 | Giảm giá hoặc cọc đã tính một lần | Không trừ lại lần nữa khi trình bày folio |
| C39 | Hồ sơ hủy có service đã dùng và tiền service chưa dùng | Tách ledger; không hoàn khoản đã dùng tự động, không tính phí hủy phòng lên C0 |
| C40 | Yêu cầu hoàn lặp, chuyển khoản mới tới sau quyết định | Giữ Target cũ cho case cũ; khoản mới là case chưa phân bổ, không thu F lần hai |
| C41 | Đã có late-arrival agreement còn hiệu lực qua nửa đêm | Không tự áp no-show trái thỏa thuận |
| C42 | Complaint quá 7 ngày làm việc từ information_completed_at chưa kết luận | Escalation/update; không tự chốt số bồi thường |
| C43 | Còn backup chưa được xử lý khi yêu cầu xóa | Không tuyên bố đã xóa toàn bộ; không tự xóa dữ liệu trong task này |
| C44 | Booking không có binding v0.1 | Không áp draft hồi tố hoặc tự đổi lựa chọn cash/voucher/points hiện có |
| C45 | Ca số học R=1 VND, G=1, A_room=S=E=0 | D_req=0, Tax=0, Bill=1; xác nhận thủ công, không tạo chuyển khoản 0; không phải giá catalogue đề xuất |
| C46 | Ca số lẻ D_req=P0=510001, r=50% | H=255001, F=255000, Target_room=255001; khớp thứ tự làm tròn calculator |
| C47 | Complaint nhận 04/12/2026 16:00, đủ thông tin 07/12/2026 | Ack 05/12 16:00; hướng xử lý hết 09/12; kết luận ban đầu hết 16/12 |
| C48 | Người đại diện đúng 18 tuổi / mới 17 tuổi tại ngày check-in, không có giám hộ | 18 đạt điều kiện tuổi; 17 chưa được xác nhận theo draft |
| C49 | Refund được duyệt thứ Sáu 04/12/2026 | Mục tiêu gửi lệnh hết thứ Sáu 11/12; không phải 5 ngày lịch hoặc bảo đảm ngân hàng đã trả |
| C50 | P0=510000, C0=180000 đã đủ điều kiện, U0=1000, d=2 | H=255000, F=255000, Target=436000; không trừ dịch vụ đã dùng lần hai khỏi C0 |
| C51 | P0=0, C0=180000 đủ điều kiện, U0=1000 | D_eff=H=F=0, Target=181000; không đồng nhất tiền phòng bằng 0 với tổng tiền hoàn bằng 0 |
| C52 | Hủy hợp lệ d=2, P0=510000, E0=280500 chưa cung cấp, C0=U0=0 | F=255000, Target=535500; không áp r lên E0 hoặc cộng thuế lần hai |
| C53 | Sau check-in, early fee 255000 + thuế 25500; phần chưa cung cấp được xác nhận 170000 + thuế 17000 | Hồ sơ phí riêng E0=187000, F=0; phần đã cung cấp 93500 không tự hoàn, không tự thêm P0 |
| C54 | Đã thu phí nhưng không rõ phần cung cấp hoặc thuế phân bổ | Chuyển nhân viên, chưa báo số hoàn; không tự chia đều theo giờ |
| C55 | Một Breakfast Set chưa cung cấp, đã thu 180000 + thuế 18000 và được duyệt hủy | C0=198000; không cộng thêm thuế hoặc áp F phòng |
| C56 | Cùng phần receipt early fee xuất hiện trong P0 và E0 / hai refund case | Phát hiện mapping trùng, dừng tính/chuyển đối soát; không cộng cả hai |
| C57 | Amendment G_new=2550000, A_room_new=0, D_held=510000 | D_new=765000, Topup=255000; chỉ có hiệu lực khi đạt các guard quote |
| C58 | Quote 10:00–10:15, đã bổ sung 100000 nhưng chưa acceptance khi hết hạn | Bỏ amendment; booking/cọc gốc không đổi; hoàn 100000 chưa phân bổ, F=0 |
| C59 | Đã acceptance, Topup cần 255000 nhưng chỉ nhận 254999 đúng hạn | Chưa đủ; hết hạn chỉ bỏ amendment, hoàn khoản bổ sung chưa áp dụng, không hủy gốc |
| C60 | Quote hết 10:15, acceptance 10:10 và đủ Topup 10:14:59, khả năng cung ứng được xác nhận | Amendment có hiệu lực một lần; áp giá/ngày/D_new đã chốt |
| C61 | Acceptance hoặc event đủ Topup đúng 10:15 | Quá hạn quote; không tự áp amendment hoặc phạt/hủy gốc |
| C62 | Giảm G_new=850000, D_held=510000, khách chọn hoàn cọc dư khi chấp nhận quote | D_new=255000, Excess_deposit=255000, Topup=0; hoàn 255000 F=0 theo cap receipt |
| C63 | Cùng ca C62 nhưng khách chọn giữ dư làm ứng trước | Giữ tổng 510000 cho Bill mới, cap cọc hủy là D_new=255000; không coi toàn bộ 510000 là phí hủy |
| C64 | Giảm G_new=850000, A_room_new=850000, D_held=510000 | D_new=0, Excess_deposit=510000, Tax=85000, Bill=85000 nếu S=E=0; nhân viên xác nhận lựa chọn dư, không tạo chuyển khoản 0 |
| C65 | Hủy gốc khi quote tăng cọc chưa có hiệu lực | Chấm dứt quote; tính hủy trên ngày/D_req gốc, không dùng D_new hoặc thu hai F |
| C66 | Amendment tăng đã có hiệu lực, ngày đến vẫn 10/12, D_new=P0=765000, hủy 08/12 | d=2, H=382500, F=382500, Target_room=382500 |
| C67 | T_expire 10:15, payment_event_at đáng tin 10:14:59, processing_at 10:15:02 | Không gắn lỗi trễ cho khách; nhân viên đối soát availability/trạng thái, không tự khôi phục hoặc cấp trùng phòng |
| C68 | Cancellation hợp lệ nhận 07/12 23:59, xử lý 08/12 09:00 | d=3, r=100%; không dùng ngày xử lý |
| C69 | Không có event timestamp đáng tin hoặc hai nguồn xung đột | Xử lý thủ công, không dùng processing time hoặc chọn mốc có lợi cho một bên |
| C70 | Sinh 05/12/2008, đặt 22/11/2026, nhận thực tế 10/12/2026 | 17 lúc đặt, 18 lúc nhận: đạt điều kiện tuổi; vẫn kiểm tra điều kiện khác |
| C71 | Cùng người C70 nhưng nhận thực tế 04/12/2026 | Vẫn 17 tuổi, cần giám hộ có căn cứ; không dùng tuổi của lịch nhận cũ |
| C72 | Tạo 11/12/2026, ngày đến 10/12/2026 | Từ chối booking thông thường, không nhận cọc rồi mới áp no-show |
| C73 | Tạo và đến 11/12/2026, lúc 15:00 hoặc 23:00 | Cùng ngày đều cần nhân viên xác nhận; 23:00 thêm thỏa thuận muộn, không suy cutoff/24h reception |
| C74 | Complaint nhận 04/12 16:00, còn thiếu checklist | WAITING_INFORMATION; ack trước 05/12 16:00, hướng xử lý hết 09/12; chưa khởi mốc 7 ngày |
| C75 | Refund đủ checklist, kiểm tra xong nhưng PENDING_APPROVAL | Không tự approved; chưa bắt đầu 5 ngày gửi lệnh, không hứa tổng 3+5 hoặc ngày ngân hàng trả; cần cập nhật/escalation |
| C76 | Log tạo 01/12/2026 10:00, backup sao ngày 10/12 | Cả gốc/backup hết hạn 15/12 10:00 nếu không có ngoại lệ riêng; sao chép không reset tuổi |
| C77 | Bản khôi phục tạo 14/12/2026 18:00 chứa log C76 | Hạn 15/12 10:00, sớm hơn hạn 24 giờ; không báo xóa hết nếu bản đó còn |
| C78 | Demo kết thúc 10/12/2026, backup không chứa log | Hạn mặc định hết ngày 09/01/2027; backup có log vẫn chịu hạn log sớm hơn |
| C79 | P0=C0=U0=0, E0=280500 đủ điều kiện, chưa Completed/Reserved | Hồ sơ phí hoàn 280500, F=0; không suy P0=0 thì refund=0 |
| C80 | D_held=210000 sau loại 300000 đã Reserved, D_new=255000 | Topup=45000; không dùng lại 300000 đang dành cho hoàn để báo đã đủ cọc |
| C81 | Khách chấp nhận revision cũ, quote đã thay bằng revision mới | Chưa đủ acceptance cho quote mới; booking gốc giữ nguyên, không tự dùng đồng ý cũ |

## REVIEW Independent critique

Các ghi nhận dưới đây thuộc các lượt review bản 0.1.0-draft; giữ nguyên như lịch sử, không là approval cho bản sửa 0.1.1-draft.
Source identity bản trước: synthetic:pbl6-academic-demo/hotel-policies-v0.1.0; bản sửa giữ document_id và dùng source_ref/version mới ở front matter.
Ngày 22/11/2026: một agent AI khác đã đọc độc lập bản nháp và đối chiếu source; không sửa file hoặc truy cập DB.
Không thấy Critical; bản đầu đủ 10 nhóm/metadata, 29 liên kết tồn tại và 44 case khi đó nhất quán.
Hai REQUIRED đã được xử lý: nhánh cọc làm tròn về 0 dùng D_req=0; SLA complaint có mốc nhận và mốc đủ thông tin riêng.
Đã làm rõ P0 gồm thuế phòng đã thu, C0 lọc đúng một lần, r là tỷ lệ số, và H làm tròn trước/F là phần còn lại.
Đã thêm ca cọc dương làm tròn về 0, số lẻ VND, SLA qua cuối tuần, tuổi đúng 18 và ledger nhiều nhóm (C45–C50).
Lượt review lại xác nhận hai REQUIRED trên đã được xử lý và C45–C50 đúng; phát hiện thêm câu P0=0 bị diễn đạt thành tổng refund=0.
Đã sửa điều kiện thành P0=C0=U0=0 và thêm C51: không còn tiền phòng vẫn có thể hoàn dịch vụ/tiền chưa phân bổ.
Reviewer đã đọc lại thay đổi cuối: C51 đúng, không còn REQUIRED/CRITICAL từ lượt phản biện này.
Kiểm tra bằng script Python chạy qua stdin: 200 assertions đạt, gồm metadata/10 policy, 51 ID tình huống,
29 liên kết nội bộ, hash hai nguồn SQL, công thức tiền, mốc giờ, lịch SLA và capacity/tuổi.
Script chỉ kiểm tra tài liệu và mô hình số học của draft; không gọi implementation để coi policy là đã được backend hỗ trợ.
Kiểm tra tham chiếu và phép tính được thực hiện offline; đây là review consistency của AI,
không phải human semantic approval, Gold Dataset, oracle nghiệp vụ hoặc bằng chứng runtime đã hỗ trợ.

### Revision closure — 0.1.1-draft, 22/11/2026

Theo yêu cầu sửa của người dùng sau semantic audit NEEDS_REVISION: M1 có E0/thuế/phần chưa cung cấp và chống tính trùng;
M2 có quote amendment/Topup/cọc dư và bảo toàn booking gốc; M3 có admission ngày quá khứ/cùng ngày.
N1 phân biệt event/processing time; N2 checklist, vai trò và trạng thái/SLA từng giai đoạn; N3 tuổi tại check-in; N4 retention theo từng bản lưu.
Đây là closure ở mức quy tắc draft và kiểm tra nội bộ, chưa có human semantic approval, runtime enforcement hoặc independent gold.
M4 publication vẫn mở (G11); không tạo corpus, không chạy ingestion và không sửa schema/vocabulary/renderer trong lượt này.
Kiểm tra nội bộ bằng Python stdlib qua stdin (python -): 307 assertions đạt về metadata/10 nhóm/81 ID tình huống,
29 liên kết, hash nguồn, công thức tiền, cap hoàn, amendment, timestamp, tuổi, admission, SLA và retention.
Đây là kiểm tra tài liệu/mô hình số học; không chạy backend/tests runtime, không xác nhận semantic approval hoặc đã đóng D1 acceptance.

## DECISIONS Project review required

- Người dùng đã phê duyệt nội dung A01–A17 và chi tiết N1–N4 cho Academic Demo; vẫn cần chốt ngày hiệu lực và phân công người xử lý nghiệp vụ, không tự gán authority khách sạn thực tế.
- Chọn cách gắn policy version/received_at/ledger phân bổ và trường hợp booking lịch sử không có binding.
- Giải quyết G02/G04/G06 trước demo tiền thật: cấu hình cọc, thiếu tiền, fallback, lựa chọn bảo lưu và cap/idempotency.
- Chốt các phí và quy trình thủ công mới; người chịu trách nhiệm pet, complaint, privacy và ngày kết thúc dataset.
- Đối chiếu knowledge cũ, catalogue và loyalty; không tự duyệt hoặc indexing bản nháp này.


## APPROVAL User content approval — 22/11/2026

Người phê duyệt: user (người dùng đã yêu cầu rõ trong hội thoại: “tôi đồng ý và phê duyệt tất cả policy, hãy đánh dấu đã approved đi”).
Phạm vi: nội dung POL-01–POL-10 và bản publication tương ứng cho khách sạn hư cấu PBL6 Academic Demo. Giữ AI_GENERATED_SYNTHETIC/synthetic=true.
Ngày duyệt: 2026-11-22, Asia/Ho_Chi_Minh. Chưa chốt effective_from/effective_to; approval không tự có hiệu lực cho booking hoặc kích hoạt RAG.
Chuẩn hóa version 0.1.1-draft → 0.1.1 và POL-07 0.1.0-draft → 0.1.0 chỉ ghi nhận trạng thái duyệt, không sửa quy tắc nghiệp vụ.
Các ghi chú REVIEW trước đây giữ nguyên như lịch sử tại thời điểm đó; không còn là trạng thái approval hiện tại.
Không phê duyệt thay fact catalog, Gold Dataset, runtime enforcement, quyền dùng dữ liệu khách sạn thực tế hoặc D1 acceptance.


## ACTIVATION — 22/11/2026

Theo yêu cầu kích hoạt: effective_from=2026-11-22 cho tài liệu gốc và 10 publication; không áp hồi tố, không đổi quy tắc nghiệp vụ. Approval nội dung của user được giữ; nhãn AI_GENERATED_SYNTHETIC không đổi. Các ghi nhận trước activation về ngày hiệu lực trống là lịch sử. Chưa ingestion/indexing, chưa phê duyệt facts/Gold và chưa nghiệm thu D1.
