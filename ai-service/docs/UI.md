# Bố cục widget trợ lý

Trạng thái cập nhật 2026-11-19: widget FAQ đã triển khai tại [AssistantWidget.jsx](../../FE/src/components/assistant/AssistantWidget.jsx), bật opt-in và đặt ở góc dưới bên phải. Có kiểm thử component/browser lịch sử trong [PROCESS.md](PROCESS.md). Tài liệu này giữ đặc tả giao diện toàn phạm vi; thẻ phòng/giá/dịch vụ/booking và các nhánh business tools là yêu cầu tương lai, chưa có trong D1.

## Vị trí và phạm vi

- Desktop: launcher cố định bên phải 24px và phía dưới 24px; panel mở phía trên, cùng mép phải.
- Kích thước panel: rộng 380px, cao tối đa 560px; giới hạn theo viewport thực tế, đã được áp dụng trong CSS. Kiểm tra browser desktop/mobile lịch sử được ghi trong PROCESS. Bàn phím mềm trên thiết bị thật chưa được kiểm tra.
- Mobile: khoảng cách 16px cộng safe-area; panel theo chiều rộng viewport trừ hai lề, chiều cao theo dynamic viewport và bàn phím.
- Đề xuất hiển thị trên trang khách/public và portal khách hàng; ẩn ở admin/staff để giữ phạm vi hỗ trợ khách.
- Gắn widget một lần trong AuthProvider/Router ở App.jsx, bên cạnh Routes; không gắn lại tại từng page.
- Dùng z-index theo lớp UI hiện có; dialog nghiệp vụ phải nổi trên widget. Không che nút đặt phòng, cookie banner nếu có hoặc toast.

## Bố cục panel

```text
┌─────────────────────────────────┐
│ Trợ lý khách sạn        Thu gọn │
│ Hỗ trợ tra cứu thông tin        │
├─────────────────────────────────┤
│ FAQ              Chính sách     │
│ Tìm phòng        Giá phòng      │
│ Dịch vụ          Booking của tôi│
├─────────────────────────────────┤
│ Khách: câu hỏi                  │
│ Trợ lý: câu trả lời             │
│ [Thẻ phòng/dịch vụ/booking]     │
│ Nguồn: tên tài liệu · phiên bản │
├─────────────────────────────────┤
│ Nhập câu hỏi...           Gửi   │
└─────────────────────────────────┘
                     [Nút trợ lý]
```

Không hiển thị diagram, điểm cosine, tên tool hoặc provider cho khách. Nguồn ở mockup là placeholder mô tả giao diện, không phải nội dung khách sạn thật.

## Trạng thái theo chức năng

| Tình huống | Hành vi |
| --- | --- |
| Chưa có hội thoại | Lời chào ngắn và sáu nút gợi ý |
| Đang xử lý | Có trạng thái chờ; tránh gửi trùng; có thể hủy/chờ timeout |
| Thiếu ngày nhận/trả hoặc số khách | Hỏi lại, chỉ tìm theo điều kiện khách xác nhận |
| Không có phòng phù hợp | Thông báo rỗng, gợi ý người dùng đổi bộ lọc; không tự nới điều kiện |
| Giá | Thẻ hiển thị kỳ ở, currency, đơn vị và khoản bao gồm từ backend; phân biệt giá dự kiến với giá đã xác nhận |
| Booking khi chưa login | Nút tới trang đăng nhập; không yêu cầu nhập SĐT/email để vượt phân quyền |
| Booking sau login | Chỉ hiển thị booking chủ tài khoản; nút xem chi tiết tới route hợp lệ đã có |
| Không đủ tài liệu/nguồn mâu thuẫn | Nói rõ thiếu căn cứ; gợi ý kênh liên hệ nếu có cấu hình thật |
| AI/API lỗi | Thông báo thử lại và link tìm kiếm/trang nghiệp vụ thông thường; không trả nội dung giả |
| Logout/đổi account | Hủy request cũ, xóa tin nhắn riêng và không render phản hồi đến muộn |

## Hội thoại và dữ liệu

- Không lưu nội dung booking vào localStorage/sessionStorage. Không thay cơ chế auth hiện có trong nhiệm vụ làm widget.
- Conversation ID do server phát và ràng buộc phiên; client không được tự cấp danh tính cho hội thoại.
- Sau login, hỏi người dùng gửi lại yêu cầu riêng; không tự phát lại nội dung nhạy cảm đang chờ.
- Mọi giá, ID booking và link action lấy từ kết quả server đã kiểm tra. Link trích dẫn chỉ tới nguồn cho phép; không render HTML thô.
- Nút đặt/hủy dẫn đến màn hình nghiệp vụ, không thực thi hành động chỉ bằng một câu chat ở bản đầu.

## Tiêu chí nghiệm thu UI

- Launcher/panel luôn bám góc dưới bên phải; không tràn viewport trên desktop/mobile.
- Tab/focus, nhãn truy cập, aria-expanded, Escape, trả focus về launcher; trạng thái chờ được thông báo phù hợp cho screen reader.
- Không tự kéo scroll xuống khi khách đang đọc tin cũ; hỗ trợ cuộn danh sách tin nhắn và bàn phím mobile.
- Đổi route không sinh widget trùng hoặc làm rò tin nhắn giữa các account.
- Kiểm tra ảnh chụp desktop/mobile và các trạng thái guest/member/error trước khi báo UI hoàn thành.
