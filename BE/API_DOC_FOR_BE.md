# PBL6 Backend Core Reference & API Registry

## System Tech Stack & Conventions

- Framework: Spring Boot (Java 17+), Spring Security (JWT), Spring Data JPA, Lombok, MySQL.
- Base URL: http://localhost:9090 | Base Package: com.example.pbl6
- Uniform API Response: ApiResponse<T> { success: boolean, message: String, data: T, timestamp: LocalDateTime }
- Authorization Roles: ROLE_ADMIN, ROLE_MANAGER, ROLE_RECEPTIONIST, ROLE_CASHIER, ROLE_HOUSEKEEPING, ROLE_CUSTOMER.
- User Context Extraction: CustomUserDetails wrapping Account via Spring Security
- Layering Strategy: Entity -> Repository -> Service / ServiceImpl -> DTO -> RestController.

## Domain Model Summary

- account(account_id, username, password_hash, full_name, email, phone, role, status, last_login)
- customer(customer_id, full_name, id_type, id_number, id_issue_date, id_issue_place, phone, email, nationality)
- room_type(room_type_id, type_name, capacity, base_price, amenities, description)
- room(room_id, room_number, room_type_id, floor, status, note)
- shift(shift_id, start_time, end_time)
- work_schedule(schedule_id, account_id, shift_id, work_date)
- cashier_shift(cashier_shift_id, account_id, schedule_id, start_time, end_time, opening_cash, closing_cash_actual, status, received_by, handover_note)
- booking(booking_id, booking_code, customer_id, created_by, check_in_date, check_out_date, guest_count, status, deposit_required, source, note, cancel_reason, canceled_by, canceled_at)
- booking_room(booking_room_id, booking_id, room_id, planned_checkin, planned_checkout, status, actual_checkin, actual_checkout, price_applied)
- service_category(category_id, category_name)
- service(service_id, category_id, service_name, unit_price, unit, is_active)
- service_usage(usage_id, booking_id, service_id, invoice_id, quantity, unit_price_applied, discount_amount, total_price, status, recorded_by, used_at)
- invoice(invoice_id, invoice_number, booking_id, room_charge, service_charge, tax_amount, discount_amount, discount_approved_by, deposit_applied, total_amount, status, cancel_reason, canceled_by, canceled_at, issued_by, issued_at)
- payment(payment_id, booking_id, invoice_id, cashier_shift_id, type, method, amount, received_by, approved_by, note, paid_at)
- audit_log(log_id, account_id, module_name, action_type, target_table, target_id, old_value, new_value, ip_address, logged_at)

## API Endpoint Matrix

### 1. Authentication & Account Management

- **POST /api/auth/login** -> Login & return JWT Token [IMPLEMENTED]
- **POST /api/auth/register** -> Register CUSTOMER account [IMPLEMENTED]
- **GET /api/admin/accounts** -> List system accounts [IMPLEMENTED]
- **POST /api/admin/accounts** -> Admin create account (Receptionist/Cashier/Manager) [IMPLEMENTED]
- **GET /api/admin/audit-logs** -> Query audit logs [IMPLEMENTED]

### 2. Public / Guest Room & Booking Flow

- **GET /api/public/rooms/room-types** -> Retrieve all room types [IMPLEMENTED]
- **GET /api/public/rooms/available** -> Search free rooms [IMPLEMENTED]
- **GET /api/public/vouchers** -> Retrieve active promo vouchers [IMPLEMENTED]
- **POST /api/public/vouchers/apply** -> Validate and calculate voucher discount [IMPLEMENTED]
- **POST /api/public/bookings** -> Reservation & VietQR payment URL [IMPLEMENTED]
- **GET /api/public/bookings/{bookingCode}/payment-status** -> Polling deposit payment [IMPLEMENTED]
- **POST /api/public/bookings/{bookingCode}/simulate-deposit** -> Demo mock deposit receipt [IMPLEMENTED]
- **GET /api/public/services** -> Get room service menu [IMPLEMENTED]
- **POST /api/public/services/order** -> Order room service [IMPLEMENTED]
- **GET /api/public/bookings/{bookingCode}/folio** -> Real-time Live Folio stay statement [IMPLEMENTED]
- **GET /api/public/history/lookup** -> Guest phone lookup [IMPLEMENTED]
- **GET /api/customer/bookings/history** -> Authenticated customer history [IMPLEMENTED]

### 3. Staff Operations & Cashier Shifts

- **POST /api/staff/cashier-shifts/open** -> Open drawer shift [IMPLEMENTED]
- **POST /api/staff/cashier-shifts/{id}/close** -> Close drawer shift [IMPLEMENTED]
- **GET /api/staff/cashier-shifts/me** -> Active cashier drawer details [IMPLEMENTED]
- **POST /api/staff/bookings/{bookingCode}/confirm-deposit** -> Manual deposit approval [IMPLEMENTED]
- **POST /api/staff/billing/bookings/{bookingCode}/check-in** -> Guest check-in [IMPLEMENTED]
- **POST /api/staff/billing/bookings/{bookingCode}/order-service** -> Record room charge service [IMPLEMENTED]
- **GET /api/staff/billing/bookings/{bookingCode}/folio** -> Detailed folio overview [IMPLEMENTED]
- **POST /api/staff/billing/bookings/{bookingCode}/settle-and-checkout** -> Final payment & checkout [IMPLEMENTED]
- **POST /api/staff/billing/bookings/{bookingCode}/cancel-with-refund** -> Cancel & calculate refund [IMPLEMENTED]

### 4. Admin Management CRUD

- **POST /api/admin/room-types** | **PUT /api/admin/room-types/{id}** -> Room Type CRUD [IMPLEMENTED]
- **POST /api/admin/rooms** | **PUT /api/admin/rooms/{id}** -> Room CRUD [IMPLEMENTED]
- **PATCH /api/admin/rooms/{id}/status** -> Update status [IMPLEMENTED]
- **POST /api/admin/services** | **PUT /api/admin/services/{id}** -> Service CRUD [IMPLEMENTED]
- **GET | POST | PUT | DELETE /api/admin/shifts** -> Shift CRUD [IMPLEMENTED]
- **GET | POST | DELETE /api/admin/schedules** -> Work schedule CRUD [IMPLEMENTED]GET|POST
  |DELETE /api/admin/schedules -> Work schedule CRUD [IMPLEMENTED]
