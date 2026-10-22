-- ====================================================================
-- HOTEL MANAGEMENT DATABASE SCHEMA (V2 COMPLETE - 26 TABLES)
-- ====================================================================

CREATE DATABASE IF NOT EXISTS hotel_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hotel_management;

-- ====================================================================
-- 1. BẢNG DANH MỤC & ĐỘC LẬP (CẤP 0)
-- ====================================================================

CREATE TABLE IF NOT EXISTS role (
    role_id INT AUTO_INCREMENT PRIMARY KEY,
    role_code VARCHAR(50) NOT NULL UNIQUE COMMENT 'ROLE_ADMIN | ROLE_MANAGER | ROLE_RECEPTIONIST | ROLE_HOUSEKEEPING | ROLE_MAINTENANCE | ROLE_SERVICE_STAFF | ROLE_CUSTOMER',
    role_name VARCHAR(100) NOT NULL,
    description TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS room_type (
    room_type_id INT AUTO_INCREMENT PRIMARY KEY,
    type_name VARCHAR(100) NOT NULL,
    capacity INT,
    base_price DECIMAL(15, 2),
    amenities TEXT,
    description TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS service_category (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shift (
    shift_id INT AUTO_INCREMENT PRIMARY KEY,
    start_time TIME,
    end_time TIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS loyalty_tier (
    tier_id INT AUTO_INCREMENT PRIMARY KEY,
    tier_code VARCHAR(50) NOT NULL UNIQUE COMMENT 'SEASHELL | STARFISH | CORAL | PEARL',
    tier_name VARCHAR(100) NOT NULL,
    tier_level INT NOT NULL UNIQUE COMMENT '1 to 4',
    min_score DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    description TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- 2. BẢNG PHỤ THUỘC CẤP 1 (TÀI KHOẢN, PHÒNG, DỊCH VỤ, TIỆN ÍCH)
-- ====================================================================

CREATE TABLE IF NOT EXISTS account (
    account_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    role_id INT NOT NULL,
    status VARCHAR(50),
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_account_role FOREIGN KEY (role_id) REFERENCES role(role_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer (
    customer_id INT AUTO_INCREMENT PRIMARY KEY,
    account_id INT NULL UNIQUE COMMENT 'nullable, unique, login account (ROLE_CUSTOMER)',
    full_name VARCHAR(100) NOT NULL,
    id_type VARCHAR(50),
    id_number VARCHAR(50),
    id_issue_date DATE,
    id_issue_place VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    nationality VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_customer_account FOREIGN KEY (account_id) REFERENCES account(account_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS room (
    room_id INT AUTO_INCREMENT PRIMARY KEY,
    room_number VARCHAR(20) NOT NULL UNIQUE,
    room_type_id INT,
    floor INT,
    status VARCHAR(50),
    note TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (room_type_id) REFERENCES room_type(room_type_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS service (
    service_id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT,
    service_name VARCHAR(100) NOT NULL,
    unit_price DECIMAL(15, 2),
    unit VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (category_id) REFERENCES service_category(category_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS work_schedule (
    schedule_id INT AUTO_INCREMENT PRIMARY KEY,
    account_id INT,
    shift_id INT,
    work_date DATE,
    FOREIGN KEY (account_id) REFERENCES account(account_id) ON DELETE CASCADE,
    FOREIGN KEY (shift_id) REFERENCES shift(shift_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_loyalty (
    customer_id INT PRIMARY KEY COMMENT '1:1 with customer',
    tier_id INT NOT NULL,
    total_stay_days INT DEFAULT 0,
    total_spent DECIMAL(15, 2) DEFAULT 0.00,
    total_score DECIMAL(10, 2) DEFAULT 0.00,
    tier_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customer(customer_id) ON DELETE CASCADE,
    FOREIGN KEY (tier_id) REFERENCES loyalty_tier(tier_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tier_benefit (
    tier_benefit_id INT AUTO_INCREMENT PRIMARY KEY,
    tier_id INT NOT NULL,
    service_id INT NULL COMMENT 'nullable, for FREE_SERVICE',
    room_type_id INT NULL COMMENT 'nullable, FREE_NIGHT up to this room type',
    benefit_type VARCHAR(50) NOT NULL COMMENT 'ROOM_DISCOUNT | FREE_SERVICE | FREE_NIGHT',
    benefit_name VARCHAR(150) NOT NULL,
    discount_percent DECIMAL(5, 2) NULL COMMENT 'for ROOM_DISCOUNT',
    quota INT NULL COMMENT 'uses per period, null = unlimited',
    period_type VARCHAR(50) NULL COMMENT 'MONTH | YEAR',
    is_active BOOLEAN DEFAULT TRUE,
    description TEXT,
    FOREIGN KEY (tier_id) REFERENCES loyalty_tier(tier_id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES service(service_id) ON DELETE SET NULL,
    FOREIGN KEY (room_type_id) REFERENCES room_type(room_type_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS voucher (
    voucher_id INT AUTO_INCREMENT PRIMARY KEY,
    created_by INT NULL COMMENT 'account, admin',
    voucher_code VARCHAR(50) NOT NULL UNIQUE,
    voucher_name VARCHAR(150) NOT NULL,
    description TEXT,
    discount_type VARCHAR(50) NOT NULL COMMENT 'PERCENT | FIXED',
    discount_value DECIMAL(15, 2) NOT NULL,
    max_discount_amount DECIMAL(15, 2) NULL COMMENT 'cap for PERCENT, nullable',
    min_order_amount DECIMAL(15, 2) DEFAULT 0.00,
    usage_limit INT NULL COMMENT 'total uses, null = unlimited',
    usage_limit_per_customer INT NULL,
    valid_from DATETIME NULL,
    valid_to DATETIME NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_voucher_created_by FOREIGN KEY (created_by) REFERENCES account(account_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- 3. BẢNG PHỤ THUỘC CẤP 2 (THIẾT BỊ, CA THU NGÂN, ĐẶT PHÒNG)
-- ====================================================================

CREATE TABLE IF NOT EXISTS equipment (
    equipment_id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT NULL COMMENT 'nullable, null = common area',
    equipment_name VARCHAR(100) NOT NULL,
    serial_number VARCHAR(100),
    status VARCHAR(50) DEFAULT 'WORKING' COMMENT 'WORKING | BROKEN | UNDER_REPAIR | RETIRED',
    note TEXT,
    FOREIGN KEY (room_id) REFERENCES room(room_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cashier_shift (
    cashier_shift_id INT AUTO_INCREMENT PRIMARY KEY,
    account_id INT NOT NULL COMMENT 'operator',
    schedule_id INT,
    start_time DATETIME,
    end_time DATETIME,
    opening_cash DECIMAL(15, 2),
    closing_cash_actual DECIMAL(15, 2),
    status VARCHAR(50),
    received_by INT COMMENT 'account taking handover',
    handover_note TEXT,
    FOREIGN KEY (account_id) REFERENCES account(account_id) ON DELETE RESTRICT,
    FOREIGN KEY (schedule_id) REFERENCES work_schedule(schedule_id) ON DELETE SET NULL,
    FOREIGN KEY (received_by) REFERENCES account(account_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS booking (
    booking_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_code VARCHAR(50) UNIQUE,
    customer_id INT NOT NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- 4. BẢNG PHỤ THUỘC CẤP 3 (BẢO TRÌ, PHÒNG ĐẶT, HÓA ĐƠN)
-- ====================================================================

CREATE TABLE IF NOT EXISTS maintenance_request (
    request_id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT NOT NULL,
    equipment_id INT NULL,
    reported_by INT NOT NULL COMMENT 'account',
    assigned_to INT NULL COMMENT 'account, maintenance staff',
    confirmed_by INT NULL COMMENT 'account confirming completion',
    title VARCHAR(200) NOT NULL,
    description TEXT,
    priority VARCHAR(50) DEFAULT 'MEDIUM' COMMENT 'LOW | MEDIUM | HIGH | URGENT',
    status VARCHAR(50) DEFAULT 'OPEN' COMMENT 'OPEN | IN_PROGRESS | DONE | CONFIRMED | CANCELED',
    resolution_note TEXT,
    reported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME NULL,
    completed_at DATETIME NULL,
    confirmed_at DATETIME NULL,
    FOREIGN KEY (room_id) REFERENCES room(room_id) ON DELETE RESTRICT,
    FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id) ON DELETE SET NULL,
    FOREIGN KEY (reported_by) REFERENCES account(account_id) ON DELETE RESTRICT,
    FOREIGN KEY (assigned_to) REFERENCES account(account_id) ON DELETE SET NULL,
    FOREIGN KEY (confirmed_by) REFERENCES account(account_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS booking_room (
    booking_room_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    room_id INT NOT NULL,
    planned_checkin DATE,
    planned_checkout DATE,
    status VARCHAR(50),
    actual_checkin DATETIME,
    actual_checkout DATETIME,
    price_applied DECIMAL(15, 2),
    FOREIGN KEY (booking_id) REFERENCES booking(booking_id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES room(room_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoice (
    invoice_id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE,
    booking_id INT NOT NULL,
    issued_by INT,
    discount_approved_by INT,
    canceled_by INT,
    room_charge DECIMAL(15, 2),
    service_charge DECIMAL(15, 2),
    tax_amount DECIMAL(15, 2),
    discount_amount DECIMAL(15, 2),
    deposit_applied DECIMAL(15, 2),
    total_amount DECIMAL(15, 2),
    status VARCHAR(50),
    cancel_reason TEXT,
    canceled_at DATETIME,
    issued_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES booking(booking_id) ON DELETE CASCADE,
    FOREIGN KEY (discount_approved_by) REFERENCES account(account_id) ON DELETE SET NULL,
    FOREIGN KEY (canceled_by) REFERENCES account(account_id) ON DELETE SET NULL,
    FOREIGN KEY (issued_by) REFERENCES account(account_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- 5. BẢNG PHỤ THUỘC CẤP 4 (THANH TOÁN, DỊCH VỤ, VOUCHER, LOYALTY)
-- ====================================================================

CREATE TABLE IF NOT EXISTS service_usage (
    usage_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    service_id INT NOT NULL,
    invoice_id INT NULL COMMENT 'nullable until invoiced',
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    invoice_id INT NULL COMMENT 'nullable for deposits',
    cashier_shift_id INT,
    type VARCHAR(50) COMMENT 'DEPOSIT | PAYMENT | REFUND',
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS service_request (
    service_request_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    room_id INT NOT NULL,
    service_id INT NOT NULL,
    customer_id INT NOT NULL COMMENT 'guest who made the request',
    assigned_to INT NULL COMMENT 'account, service staff handling it',
    invoice_id INT NULL COMMENT 'nullable until invoiced',
    quantity INT DEFAULT 1,
    fee_amount DECIMAL(15, 2) NOT NULL COMMENT 'fee charged for this request, VND',
    status VARCHAR(50) DEFAULT 'PENDING' COMMENT 'PENDING | IN_PROGRESS | COMPLETED | CANCELED',
    note TEXT,
    requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME NULL,
    FOREIGN KEY (booking_id) REFERENCES booking(booking_id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES room(room_id) ON DELETE RESTRICT,
    FOREIGN KEY (service_id) REFERENCES service(service_id) ON DELETE RESTRICT,
    FOREIGN KEY (customer_id) REFERENCES customer(customer_id) ON DELETE RESTRICT,
    FOREIGN KEY (assigned_to) REFERENCES account(account_id) ON DELETE SET NULL,
    FOREIGN KEY (invoice_id) REFERENCES invoice(invoice_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS voucher_redemption (
    redemption_id INT AUTO_INCREMENT PRIMARY KEY,
    voucher_id INT NOT NULL,
    customer_id INT NOT NULL,
    booking_id INT NOT NULL,
    invoice_id INT NULL COMMENT 'nullable until invoiced',
    discount_applied DECIMAL(15, 2) NOT NULL COMMENT 'VND',
    redeemed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (voucher_id) REFERENCES voucher(voucher_id) ON DELETE RESTRICT,
    FOREIGN KEY (customer_id) REFERENCES customer(customer_id) ON DELETE RESTRICT,
    FOREIGN KEY (booking_id) REFERENCES booking(booking_id) ON DELETE CASCADE,
    FOREIGN KEY (invoice_id) REFERENCES invoice(invoice_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS loyalty_transaction (
    txn_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    invoice_id INT NULL UNIQUE COMMENT 'nullable, unique, null for manual ADJUST',
    created_by INT NULL COMMENT 'account, nullable for system',
    txn_type VARCHAR(50) NOT NULL COMMENT 'EARN | ADJUST',
    stay_days INT DEFAULT 0,
    amount_spent DECIMAL(15, 2) DEFAULT 0.00,
    score_earned DECIMAL(10, 2) DEFAULT 0.00,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customer(customer_id) ON DELETE CASCADE,
    FOREIGN KEY (invoice_id) REFERENCES invoice(invoice_id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES account(account_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS benefit_redemption (
    redemption_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    tier_benefit_id INT NOT NULL,
    booking_id INT NULL,
    invoice_id INT NULL,
    service_usage_id INT NULL COMMENT 'nullable, for FREE_SERVICE',
    approved_by INT NULL COMMENT 'account, nullable',
    value_amount DECIMAL(15, 2) NOT NULL COMMENT 'VND discounted or waived',
    note TEXT,
    redeemed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customer(customer_id) ON DELETE RESTRICT,
    FOREIGN KEY (tier_benefit_id) REFERENCES tier_benefit(tier_benefit_id) ON DELETE RESTRICT,
    FOREIGN KEY (booking_id) REFERENCES booking(booking_id) ON DELETE SET NULL,
    FOREIGN KEY (invoice_id) REFERENCES invoice(invoice_id) ON DELETE SET NULL,
    FOREIGN KEY (service_usage_id) REFERENCES service_usage(usage_id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES account(account_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
