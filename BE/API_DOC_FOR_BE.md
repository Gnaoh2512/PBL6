# PBL6 Backend Core Reference & API Registry (V3 - Schema and Routes Audited)

## System Tech Stack & Conventions

- **Framework:** Spring Boot 3 (Java 21), Spring Security 6 (JWT), Spring Data JPA, Lombok, MySQL.
- **Base URL:** `http://localhost:9090` | **Base Package:** `com.example.pbl6`
- **Uniform API Response:** `ApiResponse<T> { success: boolean, message: String, data: T, timestamp: LocalDateTime }`
- **Authorization Roles:** `ROLE_ADMIN`, `ROLE_MANAGER`, `ROLE_RECEPTIONIST`, `ROLE_HOUSEKEEPING`, `ROLE_MAINTENANCE`, `ROLE_SERVICE_STAFF`, `ROLE_CUSTOMER`.
- **User Context Extraction:** `CustomUserDetails` wrapping `Account` via Spring Security.
- **Layering Strategy:** Entity -> Repository -> Service / ServiceImpl -> DTO -> RestController.

---

## Domain Model Summary (26 Tables Complete)

- **role**: `(role_id, role_code, role_name, description)`
- **account**: `(account_id, username, password_hash, full_name, email, phone, role_id, status, last_login, created_at, updated_at)`
- **customer**: `(customer_id, account_id, full_name, id_type, id_number, id_issue_date, id_issue_place, phone, email, nationality, created_at, updated_at)`
- **room_type**: `(room_type_id, type_name, capacity, base_price, amenities, description)`
- **room**: `(room_id, room_number, room_type_id, floor, status, note, updated_at)`
- **equipment**: `(equipment_id, room_id, equipment_name, serial_number, status, note)`
- **maintenance_request**: `(request_id, room_id, equipment_id, reported_by, assigned_to, confirmed_by, title, description, priority, status, resolution_note, reported_at, started_at, completed_at, confirmed_at)`
- **shift**: `(shift_id, start_time, end_time)`
- **work_schedule**: `(schedule_id, account_id, shift_id, work_date)`
- **cashier_shift**: `(cashier_shift_id, account_id, schedule_id, start_time, end_time, opening_cash, closing_cash_actual, status, received_by, handover_note)`
- **booking**: `(booking_id, booking_code, customer_id, created_by, check_in_date, check_out_date, guest_count, status, deposit_required, source, note, cancel_reason, canceled_by, canceled_at, created_at, updated_at)`
- **booking_room**: `(booking_room_id, booking_id, room_id, planned_checkin, planned_checkout, status, actual_checkin, actual_checkout, price_applied)`
- **service_category**: `(category_id, category_name)`
- **service**: `(service_id, category_id, service_name, unit_price, unit, is_active)`
- **service_request**: `(service_request_id, booking_id, room_id, service_id, customer_id, assigned_to, invoice_id, quantity, fee_amount, status, note, requested_at, completed_at)`
- **service_usage**: `(usage_id, booking_id, service_id, invoice_id, quantity, unit_price_applied, discount_amount, total_price, status, recorded_by, used_at)`
- **voucher**: `(voucher_id, created_by, voucher_code, voucher_name, description, discount_type, discount_value, max_discount_amount, min_order_amount, usage_limit, usage_limit_per_customer, valid_from, valid_to, is_active, created_at)`
- **voucher_redemption**: `(redemption_id, voucher_id, customer_id, booking_id, invoice_id, discount_applied, redeemed_at)`
- **loyalty_tier**: `(tier_id, tier_code, tier_name, tier_level, min_score, description)`
- **customer_loyalty**: `(customer_id, tier_id, total_stay_days, total_spent, total_score, tier_updated_at, joined_at, updated_at)`
- **loyalty_transaction**: `(txn_id, customer_id, invoice_id, created_by, txn_type, stay_days, amount_spent, score_earned, note, created_at)`
- **tier_benefit**: `(tier_benefit_id, tier_id, service_id, room_type_id, benefit_type, benefit_name, discount_percent, quota, period_type, is_active, description)`
- **benefit_redemption**: `(redemption_id, customer_id, tier_benefit_id, booking_id, invoice_id, service_usage_id, approved_by, value_amount, note, redeemed_at)`
- **invoice**: `(invoice_id, invoice_number, booking_id, room_charge, service_charge, tax_amount, discount_amount, discount_approved_by, deposit_applied, total_amount, status, cancel_reason, canceled_by, canceled_at, issued_by, issued_at, updated_at)`
- **payment**: `(payment_id, booking_id, invoice_id, cashier_shift_id, type, method, amount, received_by, approved_by, note, paid_at)`
- **audit_log**: `(log_id, account_id, module_name, action_type, target_table, target_id, old_value, new_value, ip_address, logged_at)`

---

## Complete API Registry Matrix (84 API Mappings)

Routes and access roles below are audited from Spring controller mappings and `@PreAuthorize`. All routes require a bearer token unless marked public. Customer booking routes also enforce booking ownership in the service layer. Use the role string returned by the API, including its `ROLE_` prefix.

### 1. Authentication & Profile (`/api/auth`)
- **POST** `/api/auth/register` -> Register customer account
- **POST** `/api/auth/login` -> Login & receive JWT Token
- **GET**  `/api/auth/me` -> Get authenticated user profile

### 2. Public / Guest Room, Voucher & Booking Flow (`/api/public`)
- **GET**  `/api/public/rooms/room-types` -> Retrieve all room types
- **GET**  `/api/public/rooms/room-types/{id}` -> Get room type details
- **GET**  `/api/public/rooms/available` -> Search free rooms (Query parameters)
- **POST** `/api/public/rooms/available` -> Search free rooms (Body request)
- **GET**  `/api/public/vouchers` -> Retrieve active promo vouchers
- **POST** `/api/public/vouchers/apply` -> Validate & calculate discount amount
- **POST** `/api/public/bookings` -> Create reservation & get VietQR deposit link
- **GET**  `/api/public/bookings/{bookingCode}` -> Query booking details by code
- **GET**  `/api/public/bookings/{bookingCode}/payment-status` -> Real-time polling deposit payment
- **POST** `/api/public/bookings/sepay-webhook` -> Inbound webhook for bank transfer
- **POST** `/api/public/bookings/{bookingCode}/simulate-deposit` -> Mock deposit for demo
- **GET**  `/api/public/services` -> View active service catalog
- **POST** `/api/public/services/order` -> Order in-stay room service
- **GET**  `/api/public/bookings/{bookingCode}/folio` -> Real-time live folio statement
- **POST** `/api/public/bookings/{bookingCode}/simulate-settlement` -> Mock settlement for demo
- **GET**  `/api/public/history/lookup` -> Lookup booking history by guest phone
- **GET**  `/api/public/history/lookup/{bookingCode}` -> Detailed guest history lookup

### 3. Authenticated Customer Portal (`/api/customer`)
- **GET**  `/api/customer/bookings/my-bookings` -> List bookings belonging to current user
- **GET**  `/api/customer/bookings/history` -> Summary list of booking history
- **GET**  `/api/customer/bookings/history/{bookingCode}` -> Detailed booking history
- **POST** `/api/customer/bookings/{bookingCode}/cancel` -> [MỚI] Khách hàng tự hủy đơn với chính sách linh hoạt (Hoàn tiền / Voucher / Điểm thưởng)
- **GET**  `/api/customer/billing/services` -> View service catalog
- **POST** `/api/customer/billing/services/order` -> Order room service
- **GET**  `/api/customer/billing/bookings/{bookingCode}/folio` -> View personal live folio
- **POST** `/api/customer/service-requests` -> [MỚI] Create in-stay service request
- **GET**  `/api/customer/service-requests/my-requests` -> [MỚI] View personal service requests
- **POST** `/api/customer/service-requests/{id}/cancel` -> [MỚI] Cancel pending service request
- **GET**  `/api/customer/loyalty/profile` -> [MỚI] View membership tier, score & progress
- **GET**  `/api/customer/loyalty/transactions` -> [MỚI] View point earning history
- **GET**  `/api/customer/loyalty/benefits` -> [MỚI] View available tier perks & remaining quotas

### 4. Staff Operations & Cashier Shifts (`/api/staff`)
- **GET**  `/api/staff/bookings` -> [MỚI] Danh sách đơn đặt phòng (hỗ trợ lọc status=PENDING_DEPOSIT, CONFIRMED... hoặc từ khóa)
- **GET**  `/api/staff/bookings/{bookingCode}` -> [MỚI] Chi tiết đơn đặt phòng theo mã
- **POST** `/api/staff/bookings/walk-in` -> Walk-in reservation, cash receipt & instant check-in
- **POST** `/api/staff/bookings/{bookingCode}/confirm-deposit` -> Lễ tân duyệt tiền cọc thủ công (dành cho Demo & tại quầy)
- **POST** `/api/staff/bookings/{bookingCode}/cancel` -> Cancel booking by staff
- **POST** `/api/staff/billing/bookings/{bookingCode}/check-in` -> Check-in guest (Room -> OCCUPIED)
- **POST** `/api/staff/billing/bookings/{bookingCode}/order-service` -> Record extra room service
- **GET**  `/api/staff/billing/bookings/{bookingCode}/folio` -> View complete stay statement
- **POST** `/api/staff/billing/bookings/{bookingCode}/settle-and-checkout` -> Settle payment & checkout (Triggers auto-earn Loyalty points)
- **POST** `/api/staff/billing/bookings/{bookingCode}/cancel-with-refund` -> [NÂNG CẤP] Cancel with calculated refund or flexible credit (Cash/Voucher/Loyalty)
- **GET**  `/api/staff/service-requests` -> [MỚI] List service requests by status/room
- **POST** `/api/staff/service-requests/{id}/assign` -> [MỚI] Assign staff to service request
- **POST** `/api/staff/service-requests/{id}/complete` -> [MỚI] Complete service request & bill to invoice
- **POST** `/api/staff/maintenance/report` -> [MỚI] Report facility breakdown (auto-lock room if HIGH/URGENT)
- **GET**  `/api/staff/maintenance/requests` -> [MỚI] List maintenance requests
- **POST** `/api/staff/maintenance/requests/{id}/assign` -> [MỚI] Assign technician to maintenance task
- **POST** `/api/staff/maintenance/requests/{id}/complete` -> [MỚI] Technician completes repair
- **POST** `/api/staff/maintenance/requests/{id}/confirm` -> [MỚI] Confirm repair & auto-release room to CLEANING

### 5. Admin & Management CRUD (`/api/admin`)
- **GET**    `/api/admin/accounts` -> List all system accounts
- **POST**   `/api/admin/accounts` -> Create staff account
- **GET**    `/api/admin/audit-logs` -> Query audit activity logs
- **POST**   `/api/admin/room-types` -> Create room type
- **PUT**    `/api/admin/room-types/{id}` -> Update room type
- **POST**   `/api/admin/rooms` -> Create room
- **PUT**    `/api/admin/rooms/{id}` -> Update room details
- **PATCH**  `/api/admin/rooms/{id}/status` -> Fast update room status (AVAILABLE/CLEANING/MAINTENANCE)
- **POST**   `/api/admin/services` -> Create hotel service
- **PUT**    `/api/admin/services/{id}` -> Update hotel service
- **GET**    `/api/admin/shifts` -> List all shifts
- **POST**   `/api/admin/shifts` -> Create work shift
- **PUT**    `/api/admin/shifts/{id}` -> Update work shift
- **DELETE** `/api/admin/shifts/{id}` -> Delete work shift
- **GET**    `/api/admin/schedules` -> List work schedules
- **POST**   `/api/admin/schedules` -> Assign work schedule to employee
- **DELETE** `/api/admin/schedules/{id}` -> Delete work schedule
- **GET**    `/api/admin/vouchers` -> List all promotional vouchers
- **GET**    `/api/admin/equipment` -> [MỚI] List equipment (filter by room or status)
- **GET**    `/api/admin/equipment/{id}` -> [MỚI] Get equipment details
- **POST**   `/api/admin/equipment` -> [MỚI] Create equipment
- **PUT**    `/api/admin/equipment/{id}` -> [MỚI] Update equipment
- **DELETE** `/api/admin/equipment/{id}` -> [MỚI] Retire equipment
- **GET**    `/api/admin/loyalty/tiers` -> [MỚI] List loyalty tier configurations
- **POST**   `/api/admin/loyalty/adjust-points` -> [MỚI] Manually adjust member points

---

## 6. Chính Sách Hủy Đặt Phòng & Hoàn Cọc Linh Hoạt (Flexible Cancellation)

Hệ thống hỗ trợ 3 hình thức xử lý khi khách hàng hoặc nhân viên hủy phòng:

| Phương thức (`refundOption`) | Tỷ lệ hoàn | Cách thức hoàn trả | Giá trị cộng thêm cho khách sạn & khách hàng |
| :--- | :---: | :--- | :--- |
| **`CASH_REFUND`** | 100% / 50% / 0% | Chuyển khoản ngân hàng theo bậc thang thời gian ($\ge 3$ ngày: 100%, 1-2 ngày: 50%, sát giờ: 0%) | Theo đúng chính sách hoàn tiền truyền thống |
| **`CREDIT_VOUCHER`** | **100%** | Phát hành mã Voucher lưu trú cá nhân (`VCH-RF-{bookingCode}`) thời hạn 6 tháng | Khách không bị mất cọc, khách sạn giữ chân được khách quay lại |
| **`LOYALTY_POINTS`** | **100%** | Quy đổi 100% cọc thành điểm thưởng hội viên Coastal Bay Club (`100.000đ = 1.0 điểm`) | Khách nâng hạng thẻ, nhận ưu đãi hội viên cao cấp |

### 6.1. Endpoint Khách Hàng Tự Hủy Phòng
- **URL**: `POST /api/customer/bookings/{bookingCode}/cancel`
- **Quyền hạn**: `ROLE_CUSTOMER` (hệ thống tự động kiểm tra khách hàng chỉ được hủy đơn của chính mình)

### 6.2. Endpoint Lễ Tân / Quản Lý Hủy Phòng
- **URL**: `POST /api/staff/billing/bookings/{bookingCode}/cancel-with-refund`
- **Quyền hạn**: `ROLE_RECEPTIONIST`, `ROLE_MANAGER`, `ROLE_ADMIN`

### 6.3. Request Body (`CancelBookingRequest`)
```json
{
  "reason": "Khách hàng có lịch công tác đột xuất",
  "refundOption": "CREDIT_VOUCHER" // "CASH_REFUND" | "CREDIT_VOUCHER" | "LOYALTY_POINTS"
}
```

### 6.4. Response (`CancellationRefundResponse`)
```json
{
  "status": 200,
  "message": "Hủy đơn đặt phòng thành công. Đã bảo lưu 100% tiền cọc (1000000đ) thành Voucher ưu đãi mã [VCH-RF-BK-20261022-8392] có thời hạn sử dụng 6 tháng.",
  "data": {
    "bookingCode": "BK-20261022-8392",
    "depositPaid": 1000000.00,
    "refundPercentage": 100,
    "refundAmount": 1000000.00,
    "penaltyFee": 0.00,
    "refundOption": "CREDIT_VOUCHER",
    "creditVoucherCode": "VCH-RF-BK-20261022-8392",
    "loyaltyPointsCredited": 0.00,
    "status": "CANCELED"
  }
}
```

### Controller route audit and access summary (22/10/2026)

The inventory below reflects the 84 API mappings currently declared by the controllers (the SPA forwarding route is excluded). Method-level role rules are enforced in addition to the global authenticated-by-default policy.

| Group | Route coverage | Access |
| :--- | :--- | :--- |
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` | register/login public; `/me` authenticated |
| Public rooms | `GET /api/public/rooms/room-types`, `GET /room-types/{id}`, `GET/POST /available` | Public |
| Public vouchers | `GET /api/public/vouchers`, `POST /apply` | Public |
| Public bookings/history | `POST /api/public/bookings`, `GET /{bookingCode}`, `GET /{bookingCode}/payment-status`, `POST /sepay-webhook`, `POST /{bookingCode}/simulate-deposit`, `GET /api/public/history/lookup[/{bookingCode}]` | Public; webhook has service-level validation |
| Public service/folio | `GET /api/public/services`, `POST /services/order`, `GET /bookings/{bookingCode}/folio`, `POST /bookings/{bookingCode}/simulate-settlement` | Public; simulation endpoints are demo helpers |
| Customer bookings | `GET /api/customer/bookings/my-bookings`, `GET /history`, `GET /history/{bookingCode}`, `POST /{bookingCode}/cancel` | Authenticated; service checks ownership |
| Customer billing | `GET /api/customer/billing/services`, `POST /services/order`, `GET /bookings/{bookingCode}/folio` | CUSTOMER |
| Customer loyalty/requests | loyalty `GET /profile`, `/transactions`, `/benefits`; requests `POST /api/customer/service-requests`, `GET /my-requests`, `POST /{id}/cancel` | CUSTOMER or ADMIN |
| Staff bookings | `GET /api/staff/bookings[/{bookingCode}]`, `POST /walk-in`, `POST /{bookingCode}/confirm-deposit`, `POST /{bookingCode}/cancel` | RECEPTIONIST, MANAGER, ADMIN |
| Staff billing | `POST /api/staff/billing/bookings/{bookingCode}/check-in`, `/order-service`, `/settle-and-checkout`, `/cancel-with-refund`; `GET .../folio` | RECEPTIONIST, MANAGER, ADMIN |
| Cashier shifts | `POST /api/staff/cashier-shifts/open`, `POST /{id}/close`, `GET /me` | ADMIN, MANAGER, RECEPTIONIST |
| Service requests | `GET /api/staff/service-requests`, `POST /{id}/assign`, `POST /{id}/complete` | SERVICE_STAFF, RECEPTIONIST, MANAGER, ADMIN |
| Maintenance | `GET /api/staff/maintenance/equipment`, `POST /report`, `GET /requests`, `POST /requests/{id}/assign`, `/complete`, `/confirm` | Per-operation rules: reporting HOUSEKEEPING/RECEPTIONIST/MANAGER/ADMIN; list MAINTENANCE/HOUSEKEEPING/RECEPTIONIST/MANAGER/ADMIN; assign MAINTENANCE/MANAGER/ADMIN; complete MAINTENANCE/MANAGER/ADMIN; confirm RECEPTIONIST/MANAGER/ADMIN |
| Admin accounts/audit | `GET/POST /api/admin/accounts`, `GET /api/admin/audit-logs` | ADMIN |
| Admin rooms | `GET /api/admin/rooms`, `POST/PUT /room-types[/{id}]`, `POST/PUT /rooms[/{id}]`, `PATCH /rooms/{id}/status` | List/status also RECEPTIONIST/HOUSEKEEPING; mutations ADMIN/MANAGER |
| Admin services/shifts/schedules/vouchers/equipment/loyalty | services `GET/POST/PUT`; shifts `GET/POST/PUT/DELETE`; schedules `GET/POST/DELETE`; vouchers `GET/POST/PATCH /{id}/toggle`; equipment `GET/GET{id}/POST/PUT/DELETE`; loyalty tiers `GET`, adjust-points `POST` | ADMIN/MANAGER, except accounts/audit as above |

Legacy `ROLE_CASHIER` accounts are reassigned to `ROLE_RECEPTIONIST` at startup, and the retired role is removed. Treat simulated deposit/settlement routes as development/demo flows, not payment provider confirmation.
