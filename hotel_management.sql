CREATE DATABASE IF NOT EXISTS hotel_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hotel_management;

-- ==========================================
-- 1. TẠO CÁC BẢNG DANH MỤC & ĐỘC LẬP TRƯỚC
-- ==========================================

CREATE TABLE IF NOT EXISTS account (
    account_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    role VARCHAR(50),
    status VARCHAR(50),
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer (
    customer_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    id_type VARCHAR(50),
    id_number VARCHAR(50),
    id_issue_date DATE,
    id_issue_place VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    nationality VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS room_type (
    room_type_id INT AUTO_INCREMENT PRIMARY KEY,
    type_name VARCHAR(100) NOT NULL,
    capacity INT,
    base_price DECIMAL(15, 2),
    amenities TEXT,
    description TEXT
);

CREATE TABLE IF NOT EXISTS service_category (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS shift (
    shift_id INT AUTO_INCREMENT PRIMARY KEY,
    start_time TIME,
    end_time TIME
);

-- ==========================================
-- 2. TẠO CÁC BẢNG PHỤ THUỘC CẤP 1
-- ==========================================

CREATE TABLE IF NOT EXISTS room (
    room_id INT AUTO_INCREMENT PRIMARY KEY,
    room_number VARCHAR(20) NOT NULL UNIQUE,
    room_type_id INT,
    floor INT,
    status VARCHAR(50),
    note TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (room_type_id) REFERENCES room_type(room_type_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS service (
    service_id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT,
    service_name VARCHAR(100) NOT NULL,
    unit_price DECIMAL(15, 2),
    unit VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (category_id) REFERENCES service_category(category_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS work_schedule (
    schedule_id INT AUTO_INCREMENT PRIMARY KEY,
    account_id INT,
    shift_id INT,
    work_date DATE,
    FOREIGN KEY (account_id) REFERENCES account(account_id) ON DELETE CASCADE,
    FOREIGN KEY (shift_id) REFERENCES shift(shift_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_log (
    log_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    account_id INT,
    module_name VARCHAR(100),
    action_type VARCHAR(50),
    target_table VARCHAR(100),
    target_id BIGINT,
    old_value JSON,
    new_value JSON,
    ip_address VARCHAR(45),
    logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES account(account_id) ON DELETE SET NULL
);

-- ==========================================
-- 3. TẠO CÁC BẢNG PHỤ THUỘC CẤP 2 (NGHIỆP VỤ)
-- ==========================================

CREATE TABLE IF NOT EXISTS cashier_shift (
    cashier_shift_id INT AUTO_INCREMENT PRIMARY KEY,
    account_id INT,
    schedule_id INT,
    start_time DATETIME,
    end_time DATETIME,
    opening_cash DECIMAL(15, 2),
    closing_cash_actual DECIMAL(15, 2),
    status VARCHAR(50),
    received_by INT,
    handover_note TEXT,
    FOREIGN KEY (account_id) REFERENCES account(account_id) ON DELETE RESTRICT,
    FOREIGN KEY (schedule_id) REFERENCES work_schedule(schedule_id) ON DELETE SET NULL,
    FOREIGN KEY (received_by) REFERENCES account(account_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS booking (
    booking_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_code VARCHAR(50) UNIQUE,
    customer_id INT,
    created_by INT,
    check_in_date DATE,
    check_out_date DATE,
    guest_count INT,
    status VARCHAR(50),
    deposit_required DECIMAL(15, 2),
    source VARCHAR(50),
    note TEXT,
    cancel_reason TEXT,
    canceled_by INT,
    canceled_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customer(customer_id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES account(account_id) ON DELETE SET NULL,
    FOREIGN KEY (canceled_by) REFERENCES account(account_id) ON DELETE SET NULL
);

-- ==========================================
-- 4. TẠO CÁC BẢNG PHỤ THUỘC CẤP 3 (HÓA ĐƠN & DỊCH VỤ)
-- ==========================================

CREATE TABLE IF NOT EXISTS booking_room (
    booking_room_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT,
    room_id INT,
    planned_checkin DATE,
    planned_checkout DATE,
    status VARCHAR(50),
    actual_checkin DATETIME,
    actual_checkout DATETIME,
    price_applied DECIMAL(15, 2),
    FOREIGN KEY (booking_id) REFERENCES booking(booking_id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES room(room_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS invoice (
    invoice_id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE,
    booking_id INT,
    room_charge DECIMAL(15, 2),
    service_charge DECIMAL(15, 2),
    tax_amount DECIMAL(15, 2),
    discount_amount DECIMAL(15, 2),
    discount_approved_by INT,
    deposit_applied DECIMAL(15, 2),
    total_amount DECIMAL(15, 2),
    status VARCHAR(50),
    cancel_reason TEXT,
    canceled_by INT,
    canceled_at DATETIME,
    issued_by INT,
    issued_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES booking(booking_id) ON DELETE CASCADE,
    FOREIGN KEY (discount_approved_by) REFERENCES account(account_id) ON DELETE SET NULL,
    FOREIGN KEY (canceled_by) REFERENCES account(account_id) ON DELETE SET NULL,
    FOREIGN KEY (issued_by) REFERENCES account(account_id) ON DELETE SET NULL
);

-- ==========================================
-- 5. TẠO CÁC BẢNG PHỤ THUỘC CẤP 4 (THANH TOÁN & CHI TIẾT SỬ DỤNG)
-- ==========================================

CREATE TABLE IF NOT EXISTS service_usage (
    usage_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT,
    service_id INT,
    invoice_id INT,
    quantity INT,
    unit_price_applied DECIMAL(15, 2),
    discount_amount DECIMAL(15, 2),
    total_price DECIMAL(15, 2),
    status VARCHAR(50),
    recorded_by INT,
    used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES booking(booking_id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES service(service_id) ON DELETE RESTRICT,
    FOREIGN KEY (invoice_id) REFERENCES invoice(invoice_id) ON DELETE SET NULL,
    FOREIGN KEY (recorded_by) REFERENCES account(account_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS payment (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT,
    invoice_id INT,
    cashier_shift_id INT,
    type VARCHAR(50),
    method VARCHAR(50),
    amount DECIMAL(15, 2),
    received_by INT,
    approved_by INT,
    note TEXT,
    paid_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES booking(booking_id) ON DELETE CASCADE,
    FOREIGN KEY (invoice_id) REFERENCES invoice(invoice_id) ON DELETE CASCADE,
    FOREIGN KEY (cashier_shift_id) REFERENCES cashier_shift(cashier_shift_id) ON DELETE SET NULL,
    FOREIGN KEY (received_by) REFERENCES account(account_id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES account(account_id) ON DELETE SET NULL
);
