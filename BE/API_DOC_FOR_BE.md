# PBL6 Backend Core Reference & API Registry

## System Tech Stack & Conventions

- **Framework:** Spring Boot 3 (Java 21), Spring Security 6 (JWT), Spring Data JPA, Lombok, MySQL.
- **Base URL:** `http://localhost:9090` | **Base Package:** `com.example.pbl6`
- **Uniform API Response:** `ApiResponse<T> { success: boolean, message: String, data: T, timestamp: LocalDateTime }`
- **Authorization Roles:** `ROLE_ADMIN`, `ROLE_MANAGER`, `ROLE_RECEPTIONIST`, `ROLE_CASHIER`, `ROLE_HOUSEKEEPING`, `ROLE_CUSTOMER`.
- **User Context Extraction:** `CustomUserDetails` wrapping `Account` via Spring Security.
- **Layering Strategy:** Entity -> Repository -> Service / ServiceImpl -> DTO -> RestController.

---

## Domain Model Summary

- **account**: `(account_id, username, password_hash, full_name, email, phone, role, status, last_login, created_at, updated_at)`
- **customer**: `(customer_id, full_name, id_type, id_number, id_issue_date, id_issue_place, phone, email, nationality, created_at, updated_at)`
- **room_type**: `(room_type_id, type_name, capacity, base_price, amenities, description, created_at, updated_at)`
- **room**: `(room_id, room_number, room_type_id, floor, status, note, created_at, updated_at)`
- **shift**: `(shift_id, start_time, end_time, created_at, updated_at)`
- **work_schedule**: `(schedule_id, account_id, shift_id, work_date, created_at, updated_at)`
- **cashier_shift**: `(cashier_shift_id, account_id, schedule_id, start_time, end_time, opening_cash, closing_cash_actual, status, received_by, handover_note, created_at, updated_at)`
- **booking**: `(booking_id, booking_code, customer_id, created_by, check_in_date, check_out_date, guest_count, status, deposit_required, source, note, cancel_reason, canceled_by, canceled_at, created_at, updated_at)`
- **booking_room**: `(booking_room_id, booking_id, room_id, planned_checkin, planned_checkout, status, actual_checkin, actual_checkout, price_applied, created_at, updated_at)`
- **service_category**: `(category_id, category_name)`
- **service**: `(service_id, category_id, service_name, unit_price, unit, is_active, created_at, updated_at)`
- **service_usage**: `(usage_id, booking_id, service_id, invoice_id, quantity, unit_price_applied, discount_amount, total_price, status, recorded_by, used_at, created_at, updated_at)`
- **voucher**: `(voucher_id, code, voucher_name, discount_type, discount_value, max_discount_amount, min_order_amount, start_date, end_date, usage_limit, times_used, is_active, created_at, updated_at)`
- **invoice**: `(invoice_id, invoice_number, booking_id, room_charge, service_charge, tax_amount, discount_amount, discount_approved_by, deposit_applied, total_amount, status, cancel_reason, canceled_by, canceled_at, issued_by, issued_at, created_at, updated_at)`
- **payment**: `(payment_id, booking_id, invoice_id, cashier_shift_id, type, method, amount, received_by, approved_by, note, paid_at)`
- **audit_log**: `(log_id, account_id, module_name, action_type, target_table, target_id, old_value, new_value, ip_address, logged_at)`

---

## Complete API Registry Matrix (57 Endpoints)

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
- **GET**  `/api/customer/billing/services` -> View service catalog
- **POST** `/api/customer/billing/services/order` -> Order room service
- **GET**  `/api/customer/billing/bookings/{bookingCode}/folio` -> View personal live folio

### 4. Staff Operations & Cashier Shifts (`/api/staff`)
- **POST** `/api/staff/cashier-shifts/open` -> Open daily drawer shift (record initial cash)
- **POST** `/api/staff/cashier-shifts/{id}/close` -> Close drawer shift (record actual cash & handover)
- **GET**  `/api/staff/cashier-shifts/me` -> Get active shift of current staff
- **POST** `/api/staff/bookings/walk-in` -> Walk-in reservation, cash receipt & instant check-in
- **POST** `/api/staff/bookings/{bookingCode}/confirm-deposit` -> Manual deposit verification
- **POST** `/api/staff/bookings/{bookingCode}/cancel` -> Cancel booking by staff
- **POST** `/api/staff/billing/bookings/{bookingCode}/check-in` -> Check-in guest (Room -> OCCUPIED)
- **POST** `/api/staff/billing/bookings/{bookingCode}/order-service` -> Record extra room service
- **GET**  `/api/staff/billing/bookings/{bookingCode}/folio` -> View complete stay statement
- **POST** `/api/staff/billing/bookings/{bookingCode}/settle-and-checkout` -> Settle payment & checkout (Room -> CLEANING)
- **POST** `/api/staff/billing/bookings/{bookingCode}/cancel-with-refund` -> Cancel with calculated refund

### 5. Admin & Management CRUD (`/api/admin`)
- **GET**    `/api/admin/accounts` -> List all system accounts
- **POST**   `/api/admin/accounts` -> Create staff account (Receptionist/Cashier/Manager)
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
- **GET**    `/api/admin/schedules` -> List work schedules (Optional filter by workDate)
- **POST**   `/api/admin/schedules` -> Assign work schedule to employee
- **DELETE** `/api/admin/schedules/{id}` -> Delete work schedule
- **GET**    `/api/admin/vouchers` -> List all promotional vouchers
- **POST**   `/api/admin/vouchers` -> Create new promo voucher
- **PATCH**  `/api/admin/vouchers/{voucherId}/toggle` -> Toggle voucher active status
