# HƯỚNG DẪN THIẾT KẾ GIAO DIỆN & LỘ TRÌNH TÍCH HỢP (PBL6)

Tài liệu này định hướng cách xây dựng 14 màn hình giao diện (UI) dựa trên 57 API của dự án quản lý khách sạn. 

---

## PHẦN 1: LỘ TRÌNH PHÁT TRIỂN (NÊN LÀM GIAO DIỆN NÀO TRƯỚC?)

Để việc ghép nối API diễn ra suôn sẻ, tránh bị lỗi logic dây chuyền, bạn nên phát triển giao diện theo thứ tự ưu tiên sau:

### 🥇 Giai đoạn 1: Nền tảng Xác thực (Làm đầu tiên)
Bạn phải có "chìa khóa" thì mới vào nhà được. Hãy làm **Giao diện Đăng nhập** trước tiên.
- Hoàn thiện form đăng nhập, gọi API `POST /api/auth/login`.
- Xử lý lưu `token` vào `localStorage`.
- Viết logic điều hướng: Dựa vào `role` để chuyển sang trang Public, Staff hoặc Admin.

### 🥈 Giai đoạn 2: Luồng Khách hàng Công khai (Public)
Luồng này dễ làm vì không cần truyền Token phức tạp, và là bộ mặt của hệ thống.
1. **Trang chủ & Danh mục phòng:** Gọi API lấy loại phòng và tìm phòng trống.
2. **Trang Đặt phòng Online:** Làm form điền thông tin và áp dụng Voucher.
3. **Màn hình Thanh toán QR:** Tích hợp logic gọi API lặp lại (Polling) mỗi 3s để kiểm tra trạng thái cọc.

### 🥉 Giai đoạn 3: Luồng Nghiệp vụ Lễ tân (Staff)
Đây là phần cốt lõi của Backend, cần test kỹ.
1. **Quản lý Ca thu ngân:** Mở ca/Đóng ca. (Bắt buộc phải mở ca thì mới nhận tiền đặt phòng Walk-in được).
2. **Sơ đồ phòng (Lưới màu):** Hiển thị trực quan trạng thái phòng (Xanh, Đỏ, Vàng...).
3. **Đặt phòng tại quầy (Walk-in):** Giao diện cho lễ tân xử lý check-in ngay.
4. **Hóa đơn Live Folio & Check-out:** Giao diện thêm dịch vụ và thanh toán cuối cùng.

### 🏅 Giai đoạn 4: Luồng Quản trị viên (Admin - Làm cuối cùng)
Phần này chủ yếu là các bảng (Table) và form (Thêm/Sửa/Xóa - CRUD). Khá lặp đi lặp lại nên có thể để cuối.
- Quản lý Tài khoản, Phòng, Dịch vụ, Lịch làm việc, Voucher.

---

## PHẦN 2: CHI TIẾT THIẾT KẾ 14 GIAO DIỆN

### I. PHÂN HỆ CHUNG & XÁC THỰC
1. **Trang Đăng ký (`/register`):** 
   - *UI:* Form gồm Username, Password, Họ tên, SĐT, Email.
   - *Lưu ý API:* Gọi `POST /api/auth/register`, thành công thì báo Toast xanh và chuyển về Login.
2. **Trang Đăng nhập (`/login`):** 
   - *UI:* Form cơ bản (Username, Password).
   - *Lưu ý API:* Gắn token vào localStorage. Phân quyền điều hướng (RBAC) dựa trên `data.role`.

### II. PHÂN HỆ KHÁCH HÀNG (PUBLIC)
3. **Trang chủ & Tìm phòng:**
   - *UI:* Thanh tìm kiếm ngang (Check-in, Check-out, Số người, Loại phòng). Lưới danh sách thẻ phòng.
   - *Lưu ý API:* Dùng `GET /api/public/rooms/room-types` để đổ dữ liệu vào bộ lọc. Dùng `POST /api/public/rooms/available` để hiển thị kết quả.
4. **Trang Đặt phòng & QR Code:**
   - *UI:* Chia 2 cột. Trái: Form thông tin + Nhập Voucher. Phải: Bill tạm tính + Nút "Thanh toán". Khi bấm thanh toán, hiện Modal chứa ảnh QR.
   - *Lưu ý API:* **Quan trọng:** Phải dùng `setInterval` gọi `GET /payment-status` mỗi 3s. Nếu `isPaid: true` thì dừng vòng lặp, hiện thông báo thành công.
5. **Trang Dịch vụ & Folio (Cho khách đang ở):**
   - *UI:* Danh sách món ăn (kèm nút + / -). Bảng tính tiền tổng (Folio).
6. **Trang Lịch sử & Tra cứu:**
   - *UI:* Ô nhập SĐT tra cứu đơn, danh sách bảng trạng thái đơn hàng.

### III. PHÂN HỆ LỄ TÂN & THU NGÂN (STAFF)
*Bắt buộc: Đính kèm Header `Authorization: Bearer <token>`.*

7. **Giao diện Quản lý Ca trực:**
   - *UI:* Màn hình nhập số tiền đầu ca và cuối ca.
   - *Lưu ý API:* Hệ thống bắt buộc phải mở ca (`POST /api/staff/cashier-shifts/open`) thì các nghiệp vụ thu tiền mới hoạt động.
8. **Giao diện Lễ tân Đặt phòng Walk-in:**
   - *UI:* Form thông tin khách + Form thu tiền tại quầy.
   - *Lưu ý API:* Phải truyền cờ `checkInImmediately: true` để phòng tự động chuyển sang Đang sử dụng (Occupied).
9. **Màn hình Sơ đồ phòng & Quyết toán:**
   - *UI:* Lưới dạng Grid/Card, màu sắc theo trạng thái. Click vào phòng mở ra Modal thao tác (Check-in, Thêm dịch vụ, Trả phòng).
   - *Lưu ý API:* Sử dụng đúng các Endpoint trong nhóm `POST /api/staff/billing/bookings/...`

### IV. PHÂN HỆ QUẢN TRỊ VIÊN (ADMIN)
*(Thiết kế chung cho cả 5 trang này: Sử dụng Sidebar bên trái, nội dung bên phải là Bảng (Table), Thanh tìm kiếm và Nút "Thêm mới" mở ra Modal form).*

10. **Quản lý Tài khoản & Nhật ký (Audit Log)**
11. **Quản lý Phòng & Loại phòng:** (Có nút gạt/đổi nhanh trạng thái Clean/Maintenance).
12. **Quản lý Dịch vụ (Menu đồ ăn, giặt ủi...)**
13. **Phân ca & Lịch làm việc:** Dạng bảng Calendar.
14. **Quản lý Voucher:** Nút gạt Bật/Tắt trạng thái hoạt động của Voucher.

---

## PHẦN 3: CHECKLIST QUAN TRỌNG KHI KẾT NỐI API

- [ ] **Bắt Lỗi (Global Error Handling):** Hãy viết một hàm dùng chung (VD: dùng Axios Interceptor). Nếu API trả về mã `400` -> Bật Toast màu đỏ hiển thị `response.data.message`. Nếu trả về `401` -> Ép đăng xuất, văng ra trang Login.
- [ ] **Mật khẩu test:** Đừng quên mật khẩu mặc định của mọi tài khoản là `123456` và các tài khoản test như `admin`, `receptionist`, `customer1`.
- [ ] **Định dạng dữ liệu:** Kiểm tra kỹ định dạng ngày tháng `YYYY-MM-DD` trước khi gửi lên API (ví dụ: `2026-10-05`).