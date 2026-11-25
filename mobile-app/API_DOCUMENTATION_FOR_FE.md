# TÀI LIỆU HƯỚNG DẪN TÍCH HỢP TOÀN BỘ API DÀNH CHO FRONTEND TEAM

**Dự án:** Hệ thống Quản lý Khách sạn & Đặt phòng Trực tuyến (PBL6)  
**Công nghệ Backend:** Spring Boot 3, Spring Security (JWT), MySQL  
**Base URL:** `http://localhost:9090`  
**Cập nhật lần cuối:** 02/10/2026 (Phiên bản đầy đủ 57 APIs)

---

## MỤC LỤC

1. [Quy chuẩn Kết nối Chung](#1-quy-chuẩn-kết-nối-chung)
2. [Tài khoản Thử nghiệm Mẫu](#2-tài-khoản-thử-nghiệm-mẫu)
3. [Sơ đồ Luồng Nghiệp vụ Giao diện (UI Flows)](#3-sơ-đồ-luồng-nghiệp-vụ-giao-diện)
4. [Phân hệ Xác thực & Tài khoản (`/api/auth`)](#4-phân-hệ-xác-thực--tài-khoản)
5. [Phân hệ Khách hàng & Công khai (Public & Customer)](#5-phân-hệ-khách-hàng--công-khai)
   - 5.1. [Danh mục & Tra cứu Phòng trống (`/api/public/rooms`)](#51-danh-mục--tra-cứu-phòng-trống)
   - 5.2. [Khuyến mãi & Mã giảm giá Voucher (`/api/public/vouchers`)](#52-khuyến-mãi--mã-giảm-giá-voucher)
   - 5.3. [Đặt phòng Trực tuyến & Thanh toán VietQR (`/api/public/bookings`)](#53-đặt-phòng-trực-tuyến--thanh-toán-vietqr)
   - 5.4. [Dịch vụ Lưu trú & Hóa đơn Trực tiếp Live Folio (`/services`, `/folio`)](#54-dịch-vụ-lưu-trú--hóa-đơn-trực-tiếp-live-folio)
   - 5.5. [Tra cứu & Lịch sử Đặt phòng (`/lookup`, `/api/customer/bookings`)](#55-tra-cứu--lịch-sử-đặt-phòng)
6. [Phân hệ Lễ tân & Thu ngân (Staff Operations)](#6-phân-hệ-lễ-tân--thu-ngân)
   - 6.1. [Đặt phòng Tại Quầy cho Khách Vãng lai & Check-in ngay (Walk-in)](#61-đặt-phòng-tại-quầy-walk-in--check-in-ngay)
   - 6.2. [Quản lý Ca Thu Ngân (`/api/staff/cashier-shifts`)](#62-quản-lý-ca-thu-ngân)
   - 6.3. [Xác nhận Cọc, Check-in, Order Dịch vụ, Settle Check-out](#63-nghiệp-vụ-lưu-trú--thanh-toán)
7. [Phân hệ Quản trị viên (Admin & Manager)](#7-phân-hệ-quản-trị-viên-admin--manager)
   - 7.1. [Quản lý Tài khoản & Audit Log (`/api/admin/accounts`)](#71-quản-lý-tài-khoản--audit-log)
   - 7.2. [Quản lý Phòng & Loại phòng (`/api/admin/rooms`, `/room-types`)](#72-quản-lý-phòng--loại-phòng)
   - 7.3. [Quản lý Dịch vụ (`/api/admin/services`)](#73-quản-lý-dịch-vụ)
   - 7.4. [Quản lý Ca làm việc & Lịch phân ca (`/shifts`, `/schedules`)](#74-quản-lý-ca-làm-việc--lịch-phân-ca)
   - 7.5. [Quản lý Voucher Khuyến mãi (`/api/admin/vouchers`)](#75-quản-lý-voucher-khuyến-mãi)
8. [Quy ước Mã Lỗi HTTP & Xử lý Giao diện](#8-quy-ước-mã-lỗi-http--xử-lý-giao-diện)

---

## 1. QUY CHUẨN KẾT NỐI CHUNG

- **Base URL:** `http://localhost:9090`
- **Content-Type Mặc định:** `application/json`
- **Authentication Header:** Với các API yêu cầu đăng nhập, Frontend đính kèm Bearer Token:
  ```http
  Authorization: Bearer <jwt_token>
  ```
- **Cấu trúc Response Thống nhất (`ApiResponse<T>`):**
  ```json
  {
    "success": true,
    "message": "Thông báo thân thiện hiển thị cho người dùng",
    "data": { ... },
    "timestamp": "2026-10-02T17:00:00"
  }
  ```

---

## 2. TÀI KHOẢN THỬ NGHIỆM MẪU (TEST ACCOUNTS)

Mật khẩu mặc định của tất cả các tài khoản thử nghiệm: **`123456`**

| Username | Role | Mục đích thử nghiệm |
| :--- | :--- | :--- |
| `admin` | `ROLE_ADMIN` | Quản trị toàn hệ thống (Tài khoản, Phòng, Dịch vụ, Ca trực, Voucher) |
| `manager` | `ROLE_MANAGER` | Quản lý khách sạn, duyệt giảm giá, theo dõi doanh thu |
| `receptionist` | `ROLE_RECEPTIONIST` | Lễ tân: Đặt phòng tại quầy (Walk-in), Check-in, Duyệt cọc, Hủy đơn |
| `cashier` | `ROLE_CASHIER` | Thu ngân: Mở/Đóng ca thu ngân, Xem Live Folio, Quyết toán Check-out |
| `housekeeper` | `ROLE_HOUSEKEEPING` | Buồng phòng: Cập nhật phòng sạch, kiểm tra minibar phát sinh |
| `customer1` | `ROLE_CUSTOMER` | Khách hàng thành viên (SĐT: `0901234567`) |

---

## 3. SƠ ĐỒ LUỒNG NGHIỆP VỤ GIAO DIỆN

### Luồng 1: Khách hàng Đặt phòng Online & VietQR
```
[Trang chủ] ──> [Tìm phòng trống] ──> [Chọn phòng & Nhập thông tin + Voucher]
     │
     ▼
[POST /api/public/bookings]
     │
     ├─► Nhận bookingCode & qrInfo (URL ảnh VietQR + Số tiền cọc)
     │
     ▼
[Màn hình Chờ chuyển khoản] ── (Polling GET /payment-status mỗi 3s)
     │
     ├─► Khách quét mã VietQR và nạp cọc thành công
     │
     ▼
[Hiển thị Xác nhận thành công & Mã đặt phòng]
```

### Luồng 2: Lễ tân Đặt phòng Tại Quầy (Walk-in Booking) & Check-in Ngay
```
[Lễ tân mở Ca thu ngân đầu ngày] (POST /api/staff/cashier-shifts/open)
     │
     ▼
[Khách vãng lai đến quầy hỏi phòng]
     │
     ▼
[Lễ tân chọn Phòng trống + Nhập CCCD, Họ tên, SĐT]
     │
     ▼
[Nhập tiền khách đưa tại quầy: Tiền mặt CASH hoặc Chuyển khoản]
     │
     ▼
[POST /api/staff/bookings/walk-in] (checkInImmediately = true)
     │
     ├─► Tự động: Tạo Booking + Gắn tiền vào Ca Thu Ngân + Chuyển phòng sang OCCUPIED
     │
     ▼
[In phiếu nhận phòng & Trao chìa khóa cho khách]
```

---

## 4. PHÂN HỆ XÁC THỰC & TÀI KHOẢN (`/api/auth`)

### 4.1. Đăng ký tài khoản Khách hàng
- **Endpoint:** `POST /api/auth/register`
- **Quyền:** Public
- **Request Body:**
  ```json
  {
    "username": "nguyenvana",
    "password": "Password123@",
    "fullName": "Nguyễn Văn A",
    "phone": "0987654321",
    "email": "vana@gmail.com"
  }
  ```
- **Response `data`:** Thông tin tài khoản đã tạo (`AccountResponse`).

### 4.2. Đăng nhập
- **Endpoint:** `POST /api/auth/login`
- **Quyền:** Public
- **Request Body:**
  ```json
  {
    "username": "receptionist",
    "password": "123456"
  }
  ```
- **Response `data`:**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "type": "Bearer",
    "username": "receptionist",
    "fullName": "Lễ tân Minh Trang",
    "role": "ROLE_RECEPTIONIST"
  }
  ```
  > *FE lưu `token` vào `localStorage` và chuyển trang theo `role` tương ứng.*

### 4.3. Lấy thông tin tài khoản đang đăng nhập
- **Endpoint:** `GET /api/auth/me`
- **Quyền:** Bắt buộc Header `Authorization: Bearer <token>`
- **Response `data`:** Chi tiết tài khoản cá nhân, họ tên, email, sđt, quyền hạn.

---

## 5. PHÂN HỆ KHÁCH HÀNG & CÔNG KHAI

### 5.1. Danh mục & Tra cứu Phòng trống

#### A. Lấy danh sách tất cả các loại phòng
- **Endpoint:** `GET /api/public/rooms/room-types`
- **Endpoint chi tiết:** `GET /api/public/rooms/room-types/{id}`
- **Response `data`:** Mảng danh sách loại phòng (`roomTypeId`, `typeName`, `capacity`, `basePrice`, `amenities`, `description`).

#### B. Tìm kiếm phòng còn trống
- **Cách 1 (Query Params):** `GET /api/public/rooms/available?checkInDate=2026-10-05&checkOutDate=2026-10-07&guestCount=2&roomTypeId=1`
- **Cách 2 (Request Body):** `POST /api/public/rooms/available`
  ```json
  {
    "checkInDate": "2026-10-05",
    "checkOutDate": "2026-10-07",
    "guestCount": 2,
    "roomTypeId": 1,
    "minPrice": 500000,
    "maxPrice": 2000000
  }
  ```
- **Response `data`:** Danh sách phòng khả dụng kèm số đêm tính trước và số tiền cọc dự tính 30%.

---

### 5.2. Khuyến mãi & Mã giảm giá Voucher

#### A. Xem danh sách voucher đang mở
- **Endpoint:** `GET /api/public/vouchers`
- **Response `data`:** Danh sách voucher ưu đãi đang còn hiệu lực và chưa vượt quá số lượt dùng.

#### B. Kiểm tra và tính số tiền giảm của Voucher
- **Endpoint:** `POST /api/public/vouchers/apply`
- **Request Body:**
  ```json
  {
    "voucherCode": "PBL6WELCOME",
    "orderAmount": 1500000
  }
  ```
- **Response `data`:**
  ```json
  {
    "voucherCode": "PBL6WELCOME",
    "voucherName": "Ưu đãi chào mừng 10%",
    "discountAmount": 150000,
    "finalAmount": 1350000,
    "message": "Áp dụng voucher thành công!"
  }
  ```

---

### 5.3. Đặt phòng Trực tuyến & Thanh toán VietQR

#### A. Khởi tạo đơn đặt phòng Online
- **Endpoint:** `POST /api/public/bookings`
- **Request Body:**
  ```json
  {
    "roomId": 1,
    "checkInDate": "2026-10-10",
    "checkOutDate": "2026-10-12",
    "guestCount": 2,
    "fullName": "Lê Hoàng Long",
    "phone": "0912345678",
    "email": "hoanglong@gmail.com",
    "idNumber": "048201009988",
    "idType": "CCCD",
    "nationality": "Vietnam",
    "voucherCode": "PBL6WELCOME",
    "note": "Khách cần phòng yên tĩnh trên cao"
  }
  ```
- **Response `data`:**
  ```json
  {
    "bookingId": 12,
    "bookingCode": "BK-20261002-A9F1",
    "status": "PENDING_DEPOSIT",
    "totalRoomCharge": 2000000,
    "depositRequired": 600000,
    "depositPaid": 0,
    "qrInfo": {
      "qrDataUrl": "https://img.vietqr.io/image/MB-090123456789-compact2.png?amount=600000&addInfo=BK20261002A9F1&accountName=KHACH%20SAN%20PBL6",
      "bankId": "MB",
      "accountNo": "090123456789",
      "accountName": "KHACH SAN PBL6",
      "amount": 600000,
      "transferContent": "BK20261002A9F1"
    }
  }
  ```

#### B. Polling kiểm tra trạng thái nộp cọc
- **Endpoint:** `GET /api/public/bookings/{bookingCode}/payment-status`
- **Cơ chế:** Frontend gọi mỗi 3 giây một lần khi đang hiển thị mã QR.
- **Response `data`:**
  ```json
  {
    "bookingCode": "BK-20261002-A9F1",
    "bookingStatus": "CONFIRMED",
    "isPaid": true,
    "depositAmount": 600000,
    "paidAt": "2026-10-02T17:15:30",
    "message": "Đã thanh toán tiền cọc thành công!"
  }
  ```

#### C. Giả lập nạp cọc thành công (Dành riêng cho Demo / Thuyết trình)
- **Endpoint:** `POST /api/public/bookings/{bookingCode}/simulate-deposit`

---

### 5.4. Dịch vụ Lưu trú & Hóa đơn Trực tiếp Live Folio

#### A. Xem menu dịch vụ khách sạn
- **Endpoint:** `GET /api/public/services` hoặc `GET /api/customer/billing/services`

#### B. Gọi món / Đặt dịch vụ vào phòng
- **Endpoint:** `POST /api/public/services/order` hoặc `POST /api/customer/billing/services/order`
- **Request Body:**
  ```json
  {
    "bookingCode": "BK-20261002-A9F1",
    "serviceId": 3,
    "quantity": 2,
    "note": "Giao lúc 19h tối"
  }
  ```

#### C. Xem bảng kê chi phí thời gian thực (Live Folio)
- **Endpoint:** `GET /api/public/bookings/{bookingCode}/folio` hoặc `GET /api/customer/billing/bookings/{bookingCode}/folio`
- **Response `data`:** Chi tiết tiền phòng, các dịch vụ đã dùng, thuế VAT 10%, tiền cọc đã trừ và số tiền còn lại phải thanh toán (`finalBalance`).

---

### 5.5. Tra cứu & Lịch sử Đặt phòng

#### A. Tra cứu nhanh cho Khách vãng lai (Bằng SĐT)
- **Danh sách theo SĐT:** `GET /api/public/history/lookup?phone=0912345678`
- **Chi tiết đơn:** `GET /api/public/history/lookup/{bookingCode}`

#### B. Lịch sử cho Khách hàng Thành viên (Đã đăng nhập)
- **Danh sách đơn của tôi:** `GET /api/customer/bookings/my-bookings`
- **Lịch sử tổng hợp:** `GET /api/customer/bookings/history`
- **Chi tiết đơn quá khứ:** `GET /api/customer/bookings/history/{bookingCode}`

---

## 6. PHÂN HỆ LỄ TÂN & THU NGÂN (STAFF OPERATIONS)

> **Lưu ý:** Tất cả API trong phân hệ này bắt buộc Header:  
> `Authorization: Bearer <token_nhan_vien>` (Role: `RECEPTIONIST`, `CASHIER`, `MANAGER`, `ADMIN`)

---

### 6.1. ĐẶT PHÒNG TẠI QUẦY (WALK-IN) & CHECK-IN NGAY ⭐

Dành riêng cho Lễ tân tiếp đón khách vãng lai bước vào khách sạn:
- **Endpoint:** `POST /api/staff/bookings/walk-in`
- **Request Body:**
  ```json
  {
    "roomId": 101,
    "checkInDate": "2026-10-02",
    "checkOutDate": "2026-10-04",
    "guestCount": 2,
    "fullName": "Trần Thị Bích",
    "phone": "0988665544",
    "idNumber": "048202008899",
    "idType": "CCCD",
    "nationality": "Vietnam",
    "amountPaid": 500000,
    "paymentMethod": "CASH",
    "checkInImmediately": true,
    "voucherCode": "",
    "note": "Khách nhận phòng ngay tại quầy"
  }
  ```
- **Hệ thống tự động xử lý:**
  1. Kiểm tra phòng trống, chặn trùng lịch.
  2. Nếu thu tiền mặt `CASH`, kiểm tra Lễ tân đã mở ca thu ngân chưa.
  3. Tạo hồ sơ `Customer`.
  4. Tạo đơn `source = "WALK_IN"`, trạng thái `CHECKED_IN`.
  5. Đổi trạng thái phòng sang `OCCUPIED`.
  6. Tạo hóa đơn `DRAFT` và lưu phiếu thu `Payment` vào đúng ca trực thu ngân.

---

### 6.2. Quản lý Ca Thu Ngân (`/api/staff/cashier-shifts`)

#### A. Mở ca đầu ngày
- **Endpoint:** `POST /api/staff/cashier-shifts/open`
- **Request Body:**
  ```json
  {
    "scheduleId": 1,
    "openingCash": 1000000
  }
  ```
  *(scheduleId có thể để null nếu không gắn lịch trực)*

#### B. Lấy ca trực hiện tại của bản thân
- **Endpoint:** `GET /api/staff/cashier-shifts/me`
- **Response `data`:** Chi tiết ca trực đang `OPEN`, số tiền mở ca, thời gian bắt đầu.

#### C. Đóng ca & Bàn giao két tiền
- **Endpoint:** `POST /api/staff/cashier-shifts/{id}/close`
- **Request Body:**
  ```json
  {
    "closingCashActual": 3500000,
    "receivedBy": 3,
    "handoverNote": "Đã kiểm đếm đủ tiền mặt và bàn giao cho ca tối"
  }
  ```

---

### 6.3. Nghiệp vụ Lưu trú & Thanh toán

| Method | Endpoint | Mục đích |
| :--- | :--- | :--- |
| `POST` | `/api/staff/bookings/{bookingCode}/confirm-deposit` | Duyệt cọc bằng tay khi khách chuyển khoản trực tiếp |
| `POST` | `/api/staff/bookings/{bookingCode}/cancel` | Nhân viên hủy đơn đặt phòng |
| `POST` | `/api/staff/billing/bookings/{bookingCode}/check-in` | Check-in đón khách (Phòng đổi sang `OCCUPIED`) |
| `POST` | `/api/staff/billing/bookings/{bookingCode}/order-service` | Ghi nhận dịch vụ phát sinh vào hóa đơn phòng |
| `GET` | `/api/staff/billing/bookings/{bookingCode}/folio` | Xem chi tiết toàn bộ hóa đơn phòng khách |
| `POST` | `/api/staff/billing/bookings/{bookingCode}/settle-and-checkout` | **Tất toán hóa đơn & Check-out** (Phòng đổi sang `CLEANING`) |
| `POST` | `/api/staff/billing/bookings/{bookingCode}/cancel-with-refund` | Hủy đơn và tự động tính hoàn tiền cọc theo chính sách ngày |

#### Request Body mẫu: Tất toán & Check-out
`POST /api/staff/billing/bookings/{bookingCode}/settle-and-checkout`
```json
{
  "paymentMethod": "CASH",
  "cashierShiftId": 1,
  "discountAmount": 0,
  "note": "Khách thanh toán đủ tiền mặt khi check-out"
}
```

---

## 7. PHÂN HỆ QUẢN TRỊ VIÊN (ADMIN & MANAGER)

> **Lưu ý:** Yêu cầu Header `Authorization: Bearer <token>` với vai trò `ROLE_ADMIN` hoặc `ROLE_MANAGER`.

### 7.1. Quản lý Tài khoản & Audit Log (`/api/admin`)
- **GET** `/api/admin/accounts` -> Lấy danh sách tất cả tài khoản nhân viên.
- **POST** `/api/admin/accounts` -> Tạo tài khoản nhân viên mới:
  ```json
  {
    "username": "receptionist2",
    "password": "Password123@",
    "fullName": "Trần Văn Bình",
    "email": "binh@hotel.com",
    "phone": "0981122334",
    "role": "ROLE_RECEPTIONIST"
  }
  ```
- **GET** `/api/admin/audit-logs` -> Truy vấn nhật ký thao tác hệ thống của nhân viên.

### 7.2. Quản lý Phòng & Loại phòng
- **POST** `/api/admin/room-types` | **PUT** `/api/admin/room-types/{id}`:
  ```json
  {
    "typeName": "VIP Ocean Suite",
    "capacity": 4,
    "basePrice": 2500000,
    "amenities": "Wifi, Bồn tắm, Ban công biển, Minibar",
    "description": "Phòng VIP cao cấp view biển trực diện"
  }
  ```
- **POST** `/api/admin/rooms` | **PUT** `/api/admin/rooms/{id}`:
  ```json
  {
    "roomNumber": "501",
    "roomTypeId": 2,
    "floor": 5,
    "status": "AVAILABLE",
    "note": "Phòng mới sửa chữa"
  }
  ```
- **PATCH** `/api/admin/rooms/{id}/status?status=CLEANING` -> Đổi nhanh trạng thái phòng (`AVAILABLE`, `OCCUPIED`, `CLEANING`, `MAINTENANCE`).

### 7.3. Quản lý Dịch vụ (`/api/admin/services`)
- **POST** `/api/admin/services` | **PUT** `/api/admin/services/{id}`:
  ```json
  {
    "categoryId": 1,
    "serviceName": "Giặt ủi cao cấp",
    "unitPrice": 50000,
    "unit": "Bộ",
    "isActive": true
  }
  ```

### 7.4. Quản lý Ca làm việc & Lịch phân ca
- **GET** `/api/admin/shifts` | **POST** `/api/admin/shifts` | **PUT** `/api/admin/shifts/{id}` | **DELETE** `/api/admin/shifts/{id}`:
  ```json
  {
    "startTime": "06:00:00",
    "endTime": "14:00:00"
  }
  ```
- **GET** `/api/admin/schedules?workDate=2026-10-05` -> Xem lịch trực theo ngày.
- **POST** `/api/admin/schedules`:
  ```json
  {
    "accountId": 2,
    "shiftId": 1,
    "workDate": "2026-10-05"
  }
  ```
- **DELETE** `/api/admin/schedules/{id}` -> Hủy phân ca.

### 7.5. Quản lý Voucher Khuyến mãi (`/api/admin/vouchers`)
- **GET** `/api/admin/vouchers` -> Xem tất cả voucher và số lượt đã dùng.
- **POST** `/api/admin/vouchers`:
  ```json
  {
    "code": "SUMMER2026",
    "voucherName": "Giảm giá hè 15%",
    "discountType": "PERCENTAGE",
    "discountValue": 15,
    "maxDiscountAmount": 300000,
    "minOrderAmount": 1000000,
    "startDate": "2026-06-01",
    "endDate": "2026-08-31",
    "usageLimit": 100
  }
  ```
- **PATCH** `/api/admin/vouchers/{voucherId}/toggle` -> Bật / Tắt kích hoạt voucher.

---

## 8. QUY ƯỚC MÃ LỖI HTTP & XỬ LÝ GIAO DIỆN

Khi Backend trả về lỗi, Status Code sẽ khác `200` và body luôn chứa message giải thích chi tiết:

```json
{
  "success": false,
  "message": "Phòng 101 hiện đang không khả dụng để đặt. Vui lòng chọn phòng khác!",
  "data": null,
  "timestamp": "2026-10-02T17:20:00"
}
```

### Hướng dẫn Xử lý trên Frontend:

| Mã HTTP | Tên lỗi | Cách xử lý trên Frontend |
| :--- | :--- | :--- |
| **`400`** | **Bad Request** | Dữ liệu gửi lên không hợp lệ (Trùng lịch đặt phòng, ngày trả phòng trước ngày nhận phòng, voucher chưa đạt giá trị...). **FE hiển thị Toast đỏ thông báo nội dung từ `response.data.message`.** |
| **`401`** | **Unauthorized** | Token chưa được gửi hoặc đã hết hạn. **FE xóa Token trong `localStorage` và chuyển hướng người dùng về trang Đăng nhập.** |
| **`403`** | **Forbidden** | Tài khoản không đủ quyền (Ví dụ: Khách hàng cố gọi API của Lễ tân). **FE hiển thị Alert: "Bạn không có quyền thực hiện chức năng này".** |
| **`404`** | **Not Found** | Không tìm thấy mã đơn đặt phòng, phòng hoặc mã voucher. **FE hiển thị thông báo "Dữ liệu không tồn tại".** |
| **`500`** | **Server Error** | Lỗi nội bộ hệ thống. **FE hiển thị thông báo: "Hệ thống đang bận, vui lòng thử lại sau".** |
