-- =====================================================================
-- PBL6 HOTEL MANAGEMENT - CLEAN INSTALL SCHEMA (V4 FINAL)
-- Integrates Room Cleaning Requests, Shift Schedules, Loyalty V3 & Triggers.
--
-- DESTRUCTIVE: DROP DATABASE permanently deletes existing database.
-- Requires MySQL 8.0.16+ (enforced CHECK constraints).
-- =====================================================================

DROP DATABASE IF EXISTS hotel_management;
CREATE DATABASE hotel_management
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;
USE hotel_management;

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
    shift_name VARCHAR(50) NOT NULL COMMENT 'MORNING | AFTERNOON | NIGHT | FULL_DAY',
    start_time TIME NOT NULL,
    end_time TIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS loyalty_tier (
    tier_id INT AUTO_INCREMENT PRIMARY KEY,
    tier_code VARCHAR(50) NOT NULL UNIQUE COMMENT 'SEASHELL | STARFISH | CORAL | PEARL',
    tier_name VARCHAR(100) NOT NULL,
    tier_level INT NOT NULL UNIQUE COMMENT '1 to 4',
    min_score DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    description TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS account (
    account_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    role_id INT NOT NULL,
    status VARCHAR(50) DEFAULT 'ACTIVE',
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
    status VARCHAR(50) DEFAULT 'AVAILABLE',
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
    account_id INT NOT NULL,
    shift_id INT NOT NULL,
    work_date DATE NOT NULL,
    status VARCHAR(30) DEFAULT 'SCHEDULED' COMMENT 'SCHEDULED | COMPLETED | ABSENT | OFF',
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES account(account_id) ON DELETE CASCADE,
    FOREIGN KEY (shift_id) REFERENCES shift(shift_id) ON DELETE CASCADE,
    CONSTRAINT uq_staff_work_date UNIQUE (account_id, work_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_log (
    log_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    account_id INT,
    module_name VARCHAR(100),
    action_type VARCHAR(50),
    target_table VARCHAR(100),
    target_id BIGINT,
    old_value TEXT,
    new_value TEXT,
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
    period_type VARCHAR(50) NULL COMMENT 'DAY | MONTH | YEAR (calendar quota period)',
    is_active BOOLEAN DEFAULT TRUE,
    description TEXT,
    FOREIGN KEY (tier_id) REFERENCES loyalty_tier(tier_id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES service(service_id) ON DELETE SET NULL,
    FOREIGN KEY (room_type_id) REFERENCES room_type(room_type_id) ON DELETE SET NULL,
    CONSTRAINT uq_tier_benefit_name UNIQUE (tier_id, benefit_name),
    CONSTRAINT ck_tb_period_type CHECK (period_type IS NULL OR period_type IN ('DAY','MONTH','YEAR')),
    CONSTRAINT ck_tb_quota_period CHECK (quota IS NULL OR (quota > 0 AND period_type IS NOT NULL)),
    CONSTRAINT ck_tb_benefit_type CHECK (benefit_type IN ('ROOM_DISCOUNT','FREE_SERVICE','FREE_NIGHT')),
    CONSTRAINT ck_tb_discount CHECK (benefit_type <> 'ROOM_DISCOUNT' OR (discount_percent IS NOT NULL AND discount_percent > 0 AND discount_percent <= 100))
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
    status VARCHAR(50) DEFAULT 'OPEN',
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
    status VARCHAR(50) DEFAULT 'PENDING' COMMENT 'PENDING | CONFIRMED | CHECKED_IN | CHECKED_OUT | CANCELED',
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

CREATE TABLE IF NOT EXISTS roomcleaning_request (
    request_id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT NOT NULL,
    reported_by INT NOT NULL COMMENT 'account',
    assigned_to INT NULL COMMENT 'account, housekeeping staff',
    confirmed_by INT NULL COMMENT 'account confirming completion',
    title VARCHAR(200) NOT NULL DEFAULT 'Yêu cầu dọn phòng',
    description TEXT,
    priority VARCHAR(50) DEFAULT 'MEDIUM' COMMENT 'LOW | MEDIUM | HIGH | URGENT',
    status VARCHAR(50) DEFAULT 'OPEN' COMMENT 'OPEN | IN_PROGRESS | DONE | CONFIRMED | CANCELED',
    note TEXT,
    reported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME NULL,
    completed_at DATETIME NULL,
    confirmed_at DATETIME NULL,
    FOREIGN KEY (room_id) REFERENCES room(room_id) ON DELETE RESTRICT,
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
    method VARCHAR(50) COMMENT 'CASH | CARD | BANK_TRANSFER | VIETQR',
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
    status VARCHAR(50) DEFAULT 'PENDING' COMMENT 'PENDING | DELIVERING | COMPLETED | CANCELED',
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
    status VARCHAR(20) NOT NULL DEFAULT 'APPLIED' COMMENT 'APPLIED | VOIDED',
    period_start DATE NULL COMMENT 'first day of quota period; set by trigger',
    voided_at DATETIME NULL,
    voided_by INT NULL COMMENT 'account who cancelled the redemption',
    void_reason VARCHAR(255) NULL,
    benefit_type VARCHAR(50) NULL COMMENT 'copied from tier_benefit by trigger',
    room_discount_booking_id INT GENERATED ALWAYS AS (
        IF(status = 'APPLIED' AND benefit_type = 'ROOM_DISCOUNT', booking_id, NULL)
    ) VIRTUAL,
    FOREIGN KEY (customer_id) REFERENCES customer(customer_id) ON DELETE RESTRICT,
    FOREIGN KEY (tier_benefit_id) REFERENCES tier_benefit(tier_benefit_id) ON DELETE RESTRICT,
    FOREIGN KEY (booking_id) REFERENCES booking(booking_id) ON DELETE SET NULL,
    FOREIGN KEY (invoice_id) REFERENCES invoice(invoice_id) ON DELETE SET NULL,
    FOREIGN KEY (service_usage_id) REFERENCES service_usage(usage_id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES account(account_id) ON DELETE SET NULL,
    CONSTRAINT fk_redemption_voided_by FOREIGN KEY (voided_by) REFERENCES account(account_id) ON DELETE SET NULL,
    CONSTRAINT ck_redemption_status CHECK (status IN ('APPLIED','VOIDED')),
    CONSTRAINT uq_one_room_discount_per_booking UNIQUE (room_discount_booking_id),
    INDEX idx_redemption_quota (customer_id, tier_benefit_id, status, period_start),
    INDEX idx_redemption_booking (booking_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS benefit_usage_counter (
    customer_id INT NOT NULL,
    tier_benefit_id INT NOT NULL,
    period_start DATE NOT NULL,
    used_count INT NOT NULL DEFAULT 0,
    PRIMARY KEY (customer_id, tier_benefit_id, period_start),
    CONSTRAINT fk_buc_customer FOREIGN KEY (customer_id)
        REFERENCES customer(customer_id) ON DELETE CASCADE,
    CONSTRAINT fk_buc_benefit FOREIGN KEY (tier_benefit_id)
        REFERENCES tier_benefit(tier_benefit_id) ON DELETE CASCADE,
    CONSTRAINT ck_buc_used_count CHECK (used_count >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- TRIGGERS & VIEWS
-- =====================================================================

DELIMITER $$

-- Loyalty Benefit Triggers
DROP TRIGGER IF EXISTS trg_benefit_redemption_bi$$
CREATE TRIGGER trg_benefit_redemption_bi BEFORE INSERT ON benefit_redemption
FOR EACH ROW
BEGIN
    DECLARE v_at DATETIME;
    DECLARE v_type VARCHAR(50);
    DECLARE v_quota INT;
    DECLARE v_period VARCHAR(50);
    DECLARE v_active TINYINT(1);
    DECLARE v_service INT;
    DECLARE v_room_type INT;
    DECLARE v_benefit_level INT;
    DECLARE v_customer_level INT;
    DECLARE v_used INT;

    SET v_at = COALESCE(NEW.redeemed_at, NOW());
    SET NEW.redeemed_at = v_at;
    IF NEW.status IS NULL THEN SET NEW.status = 'APPLIED'; END IF;

    SELECT tb.benefit_type, tb.quota, tb.period_type, tb.is_active, tb.service_id, tb.room_type_id, bt.tier_level
      INTO v_type, v_quota, v_period, v_active, v_service, v_room_type, v_benefit_level
      FROM tier_benefit tb
      JOIN loyalty_tier bt ON bt.tier_id = tb.tier_id
     WHERE tb.tier_benefit_id = NEW.tier_benefit_id;
    SET NEW.benefit_type = v_type;

    IF NEW.status = 'APPLIED' THEN
        SELECT lt.tier_level INTO v_customer_level
          FROM customer_loyalty cl JOIN loyalty_tier lt ON lt.tier_id = cl.tier_id
         WHERE cl.customer_id = NEW.customer_id;

        IF v_customer_level IS NULL THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Khách hàng chưa có hồ sơ thành viên (customer_loyalty)';
        END IF;
        IF v_type IS NULL THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Đặc quyền không tồn tại';
        END IF;
        IF v_active IS NULL OR v_active = 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Đặc quyền này hiện đang tạm ngưng';
        END IF;
        IF v_customer_level < v_benefit_level THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Hạng thành viên hiện tại chưa đủ để dùng đặc quyền này';
        END IF;
        IF v_type = 'FREE_SERVICE' AND v_service IS NULL THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Đặc quyền miễn phí dịch vụ chưa được gắn với dịch vụ cụ thể';
        END IF;
        IF v_type = 'FREE_NIGHT' AND v_room_type IS NULL THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Đặc quyền đêm miễn phí chưa được gắn với loại phòng';
        END IF;

        SET NEW.period_start = CASE v_period
            WHEN 'DAY'   THEN DATE(v_at)
            WHEN 'MONTH' THEN DATE_SUB(DATE(v_at), INTERVAL DAYOFMONTH(v_at) - 1 DAY)
            WHEN 'YEAR'  THEN MAKEDATE(YEAR(v_at), 1)
            ELSE NULL END;

        IF v_quota IS NOT NULL THEN
            INSERT INTO benefit_usage_counter (customer_id, tier_benefit_id, period_start, used_count)
            VALUES (NEW.customer_id, NEW.tier_benefit_id, NEW.period_start, 1)
            ON DUPLICATE KEY UPDATE used_count = used_count + 1;

            SELECT used_count INTO v_used FROM benefit_usage_counter
             WHERE customer_id = NEW.customer_id AND tier_benefit_id = NEW.tier_benefit_id
               AND period_start = NEW.period_start;
            IF v_used > v_quota THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Đã hết lượt sử dụng đặc quyền này trong kỳ hiện tại';
            END IF;
        END IF;
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_benefit_redemption_bu$$
CREATE TRIGGER trg_benefit_redemption_bu BEFORE UPDATE ON benefit_redemption
FOR EACH ROW
BEGIN
    IF OLD.status = 'VOIDED' AND NEW.status = 'APPLIED' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Không thể khôi phục lượt đã hủy, hãy tạo lượt sử dụng mới';
    END IF;
    IF OLD.status = 'APPLIED' AND NEW.status = 'VOIDED' THEN
        IF NEW.voided_at IS NULL THEN SET NEW.voided_at = NOW(); END IF;
        UPDATE benefit_usage_counter
           SET used_count = GREATEST(used_count - 1, 0)
         WHERE customer_id = OLD.customer_id AND tier_benefit_id = OLD.tier_benefit_id
           AND period_start = OLD.period_start;
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_benefit_redemption_ad$$
CREATE TRIGGER trg_benefit_redemption_ad AFTER DELETE ON benefit_redemption
FOR EACH ROW
BEGIN
    IF OLD.status = 'APPLIED' AND OLD.period_start IS NOT NULL THEN
        UPDATE benefit_usage_counter
           SET used_count = GREATEST(used_count - 1, 0)
         WHERE customer_id = OLD.customer_id AND tier_benefit_id = OLD.tier_benefit_id
           AND period_start = OLD.period_start;
    END IF;
END$$

-- Role Enforcement Triggers for Assignments
DROP TRIGGER IF EXISTS trg_roomcleaning_assigned_bi$$
CREATE TRIGGER trg_roomcleaning_assigned_bi BEFORE INSERT ON roomcleaning_request
FOR EACH ROW
BEGIN
    DECLARE v_role_code VARCHAR(50);
    IF NEW.assigned_to IS NOT NULL THEN
        SELECT r.role_code INTO v_role_code FROM account a JOIN role r ON a.role_id = r.role_id WHERE a.account_id = NEW.assigned_to;
        IF v_role_code IS NULL OR v_role_code != 'ROLE_HOUSEKEEPING' THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Chỉ được gán nhân viên Dọn phòng (ROLE_HOUSEKEEPING)';
        END IF;
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_roomcleaning_assigned_bu$$
CREATE TRIGGER trg_roomcleaning_assigned_bu BEFORE UPDATE ON roomcleaning_request
FOR EACH ROW
BEGIN
    DECLARE v_role_code VARCHAR(50);
    IF NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS NULL OR NEW.assigned_to != OLD.assigned_to) THEN
        SELECT r.role_code INTO v_role_code FROM account a JOIN role r ON a.role_id = r.role_id WHERE a.account_id = NEW.assigned_to;
        IF v_role_code IS NULL OR v_role_code != 'ROLE_HOUSEKEEPING' THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Chỉ được gán nhân viên Dọn phòng (ROLE_HOUSEKEEPING)';
        END IF;
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_maintenance_assigned_bi$$
CREATE TRIGGER trg_maintenance_assigned_bi BEFORE INSERT ON maintenance_request
FOR EACH ROW
BEGIN
    DECLARE v_role_code VARCHAR(50);
    IF NEW.assigned_to IS NOT NULL THEN
        SELECT r.role_code INTO v_role_code FROM account a JOIN role r ON a.role_id = r.role_id WHERE a.account_id = NEW.assigned_to;
        IF v_role_code IS NULL OR v_role_code != 'ROLE_MAINTENANCE' THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Chỉ được gán nhân viên Bảo trì (ROLE_MAINTENANCE)';
        END IF;
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_maintenance_assigned_bu$$
CREATE TRIGGER trg_maintenance_assigned_bu BEFORE UPDATE ON maintenance_request
FOR EACH ROW
BEGIN
    DECLARE v_role_code VARCHAR(50);
    IF NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS NULL OR NEW.assigned_to != OLD.assigned_to) THEN
        SELECT r.role_code INTO v_role_code FROM account a JOIN role r ON a.role_id = r.role_id WHERE a.account_id = NEW.assigned_to;
        IF v_role_code IS NULL OR v_role_code != 'ROLE_MAINTENANCE' THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Chỉ được gán nhân viên Bảo trì (ROLE_MAINTENANCE)';
        END IF;
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_service_assigned_bi$$
CREATE TRIGGER trg_service_assigned_bi BEFORE INSERT ON service_request
FOR EACH ROW
BEGIN
    DECLARE v_role_code VARCHAR(50);
    IF NEW.assigned_to IS NOT NULL THEN
        SELECT r.role_code INTO v_role_code FROM account a JOIN role r ON a.role_id = r.role_id WHERE a.account_id = NEW.assigned_to;
        IF v_role_code IS NULL OR v_role_code != 'ROLE_SERVICE_STAFF' THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Chỉ được gán nhân viên Phục vụ (ROLE_SERVICE_STAFF)';
        END IF;
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_service_assigned_bu$$
CREATE TRIGGER trg_service_assigned_bu BEFORE UPDATE ON service_request
FOR EACH ROW
BEGIN
    DECLARE v_role_code VARCHAR(50);
    IF NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS NULL OR NEW.assigned_to != OLD.assigned_to) THEN
        SELECT r.role_code INTO v_role_code FROM account a JOIN role r ON a.role_id = r.role_id WHERE a.account_id = NEW.assigned_to;
        IF v_role_code IS NULL OR v_role_code != 'ROLE_SERVICE_STAFF' THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Chỉ được gán nhân viên Phục vụ (ROLE_SERVICE_STAFF)';
        END IF;
    END IF;
END$$

DELIMITER ;

-- View View Customer Benefits
CREATE OR REPLACE VIEW v_customer_benefit_availability AS
SELECT
    cl.customer_id,
    tb.tier_benefit_id,
    tb.benefit_type,
    tb.benefit_name,
    tb.discount_percent,
    tb.service_id,
    tb.room_type_id,
    tb.quota,
    tb.period_type,
    p.period_start,
    COALESCE(u.used, 0) AS used_in_period,
    CASE WHEN tb.quota IS NULL THEN NULL ELSE GREATEST(tb.quota - COALESCE(u.used, 0), 0) END AS remaining,
    CASE WHEN tb.quota IS NULL OR COALESCE(u.used, 0) < tb.quota THEN 1 ELSE 0 END AS can_use_now
FROM customer_loyalty cl
JOIN loyalty_tier ct ON ct.tier_id = cl.tier_id
JOIN loyalty_tier bt ON bt.tier_level <= ct.tier_level
JOIN tier_benefit tb ON tb.tier_id = bt.tier_id AND tb.is_active = 1
JOIN (SELECT tier_benefit_id,
             CASE period_type
                 WHEN 'DAY'   THEN CURDATE()
                 WHEN 'MONTH' THEN DATE_SUB(CURDATE(), INTERVAL DAYOFMONTH(CURDATE()) - 1 DAY)
                 WHEN 'YEAR'  THEN MAKEDATE(YEAR(CURDATE()), 1)
                 ELSE NULL END AS period_start
      FROM tier_benefit) p ON p.tier_benefit_id = tb.tier_benefit_id
LEFT JOIN (SELECT customer_id, tier_benefit_id, period_start, COUNT(*) AS used
           FROM benefit_redemption WHERE status = 'APPLIED'
           GROUP BY customer_id, tier_benefit_id, period_start) u
       ON u.customer_id = cl.customer_id
      AND u.tier_benefit_id = tb.tier_benefit_id
      AND (u.period_start <=> p.period_start);