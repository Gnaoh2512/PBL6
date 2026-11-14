# 🏨 Hướng Dẫn Sử Dụng - Azure Bay Hotel App

Chào mừng bạn đến với ứng dụng đặt phòng khách sạn **Azure Bay Hotel**. Tài liệu này hướng dẫn cách cài đặt, khởi chạy và sử dụng các tính năng của ứng dụng.

---

## 1. Yêu cầu hệ thống & Cài đặt

- **Node.js**: Phiên bản 18+ trở lên.
- **Expo CLI**: Đã được tích hợp sẵn qua lệnh `npx`.
- **Thiết bị thật**: Ứng dụng **Expo Go** trên iOS/Android để quét mã QR chạy app.

### Cách khởi chạy dự án:
1. Mở Terminal / Command Prompt.
2. Di chuyển vào thư mục dự án:
   ```bash
   cd hotel-booking-app
   ```
3. Cài đặt các thư viện (nếu chưa cài):
   ```bash
   npm install
   ```
4. Chạy ứng dụng:
   ```bash
   npm start
   ```
5. Khi menu Expo hiện ra, bạn có thể:
   - Bấm phím **`w`**: Để mở ứng dụng trực tiếp trên trình duyệt Web.
   - Bấm phím **`a`**: Để mở trên máy ảo Android (nếu đã cài Android Studio).
   - **Quét mã QR**: Dùng ứng dụng Camera (iOS) hoặc Expo Go (Android) quét mã QR trên màn hình để chạy trên điện thoại thật.

---

## 2. Tài khoản thử nghiệm (Demo)

Ứng dụng hiện đang sử dụng dữ liệu giả lập (Mock Data). Bạn có thể đăng nhập ngay bằng tài khoản sau:
- **Email**: `khach@example.com`
- **Mật khẩu**: `123456`

*(Bạn cũng có thể sang tab "Đăng ký" trên màn hình đăng nhập để tạo một tài khoản ảo mới phục vụ mục đích test).*

---

## 3. Hướng dẫn các tính năng chính

### A. Đăng nhập / Đăng ký
- Khi mở app, bạn sẽ được yêu cầu đăng nhập. 
- Nếu chưa có tài khoản, hãy chuyển qua tab **Đăng ký**, điền Họ Tên, Email, Số điện thoại và Mật khẩu. 
- Hệ thống có validate dữ liệu (Ví dụ: Email phải đúng định dạng, mật khẩu phải từ 6 ký tự).

### B. Màn hình Trang Chủ (Home)
- Nơi hiển thị hình ảnh tổng quan của khách sạn Azure Bay.
- Bạn có thể xem các thông tin quan trọng như:
  - Giờ Check-in / Check-out.
  - Danh sách các tiện ích nổi bật của khách sạn (Hồ bơi, WiFi, Spa...).
  - Địa chỉ và tọa độ bản đồ.

### C. Màn hình Các loại phòng (Rooms)
- Danh sách 5 loại phòng từ Tiêu chuẩn (Standard) đến Tổng thống (Presidential Suite).
- Nhấp vào nút **"Xem phòng"** trên bất kỳ thẻ phòng nào để xem chi tiết.

### D. Xem chi tiết & Đặt phòng
1. Tại màn hình chi tiết, bạn có thể vuốt qua lại để xem hình ảnh phòng.
2. **Chọn ngày:** Nhấn vào "Check-in" và "Check-out" để chọn ngày trên lịch.
3. **Kiểm tra phòng trống:** Bấm nút "Kiểm tra phòng trống".
4. Nếu còn phòng, nút "Đặt phòng ngay" sẽ xuất hiện.
5. **Điền form đặt phòng:** Kiểm tra thông tin cá nhân, chọn số lượng khách và ghi chú đặc biệt (nếu có).
6. Bấm "Xác nhận đặt phòng". Ứng dụng sẽ chuyển sang màn hình thành công kèm Mã Đặt Phòng.

### E. Lịch sử đặt phòng (My Bookings)
- Quản lý các đơn đặt phòng của bạn.
- Hiển thị đầy đủ trạng thái: *Chờ xác nhận, Đã xác nhận, Hoàn thành, Đã hủy*.
- Đối với các đơn đang ở trạng thái **"Chờ xác nhận"**, bạn có thể bấm nút **Hủy đặt phòng** ở dưới cùng thẻ thông tin.

### F. Liên hệ & Thông tin (Contact)
- Nơi hiển thị các phương thức liên lạc.
- Các nút tương tác thông minh (Bấm gọi điện, gửi email, mở bản đồ hướng dẫn).
- Khu vực Hỏi - Đáp (FAQ) giải đáp thắc mắc cơ bản của khách hàng.

---

## 4. Ghi chú cho Nhà Phát Triển
- Dữ liệu hiện tại nằm trong thư mục `src/data/mockData.ts`.
- Mọi logic xử lý đặt phòng nằm trong thư mục `src/services/` và lưu trữ trạng thái qua thư viện `Zustand` (`src/store/`).
- Khi sẵn sàng, cấu hình Firebase có thể được bật tại file `src/services/firebase.ts`.
