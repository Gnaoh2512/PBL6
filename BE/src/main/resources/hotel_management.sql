-- ====================================================================
-- HOTEL MANAGEMENT DATABASE SCHEMA & SEED DATA (V2 COMPLETE - 26 TABLES)
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

-- ====================================================================
-- 6. DỮ LIỆU MẪU BAN ĐẦU (SEED DATA CHO HỆ THỐNG)
-- ====================================================================

-- 6.1. Roles
INSERT INTO role (role_code, role_name, description) VALUES
('ROLE_ADMIN', 'Quản trị viên hệ thống', 'Toàn quyền cấu hình và quản trị hệ thống khách sạn'),
('ROLE_MANAGER', 'Quản lý khách sạn', 'Quản lý vận hành toàn diện, phê duyệt chiết khấu, giám sát báo cáo'),
('ROLE_RECEPTIONIST', 'Nhân viên lễ tân', 'Xử lý đặt phòng, check-in, check-out, thanh toán và thu cọc'),
('ROLE_HOUSEKEEPING', 'Nhân viên buồng phòng', 'Dọn dẹp phòng, kiểm tra buồng phòng và cập nhật tình trạng phòng'),
('ROLE_MAINTENANCE', 'Nhân viên kỹ thuật & bảo trì', 'Tiếp nhận và xử lý sửa chữa trang thiết bị, bảo trì phòng'),
('ROLE_SERVICE_STAFF', 'Nhân viên phục vụ dịch vụ', 'Tiếp nhận và thực hiện các dịch vụ phòng, ăn uống, giặt ủi cho khách'),
('ROLE_CUSTOMER', 'Khách hàng', 'Tài khoản khách hàng trực tuyến đặt phòng và tra cứu lịch sử')
ON DUPLICATE KEY UPDATE role_name = VALUES(role_name);

-- 6.2. Accounts (Mật khẩu mặc định: 123456 -> BCrypt: $2a$10$eACCYoNOHEqgkVE8aIUTNuG3z5P3W7VqK0b9v3LzV2yZ6hQ7uIom6)
INSERT INTO account (username, password_hash, full_name, email, phone, role_id, status) VALUES
('admin', '$2a$10$eACCYoNOHEqgkVE8aIUTNuG3z5P3W7VqK0b9v3LzV2yZ6hQ7uIom6', 'Quản trị viên Hệ thống', 'admin@hotel.com', '0900000001', 1, 'ACTIVE'),
('manager', '$2a$10$eACCYoNOHEqgkVE8aIUTNuG3z5P3W7VqK0b9v3LzV2yZ6hQ7uIom6', 'Nguyễn Văn Quản Lý', 'manager@hotel.com', '0900000002', 2, 'ACTIVE'),
('receptionist', '$2a$10$eACCYoNOHEqgkVE8aIUTNuG3z5P3W7VqK0b9v3LzV2yZ6hQ7uIom6', 'Trần Thị Lễ Tân', 'receptionist@hotel.com', '0900000003', 3, 'ACTIVE'),
('cashier', '$2a$10$eACCYoNOHEqgkVE8aIUTNuG3z5P3W7VqK0b9v3LzV2yZ6hQ7uIom6', 'Lê Văn Thu Ngân', 'cashier@hotel.com', '0900000004', 3, 'ACTIVE'),
('housekeeper', '$2a$10$eACCYoNOHEqgkVE8aIUTNuG3z5P3W7VqK0b9v3LzV2yZ6hQ7uIom6', 'Phạm Thị Buồng Phòng', 'housekeeper@hotel.com', '0900000005', 4, 'ACTIVE'),
('technician', '$2a$10$eACCYoNOHEqgkVE8aIUTNuG3z5P3W7VqK0b9v3LzV2yZ6hQ7uIom6', 'Trần Kỹ Thuật Bảo Trì', 'tech@hotel.com', '0900000006', 5, 'ACTIVE'),
('servicestaff', '$2a$10$eACCYoNOHEqgkVE8aIUTNuG3z5P3W7VqK0b9v3LzV2yZ6hQ7uIom6', 'Võ Phục Vụ Buồng Dịch Vụ', 'service@hotel.com', '0900000007', 6, 'ACTIVE'),
('customer1', '$2a$10$eACCYoNOHEqgkVE8aIUTNuG3z5P3W7VqK0b9v3LzV2yZ6hQ7uIom6', 'Nguyễn Văn Khách', 'customer1@gmail.com', '0901234567', 7, 'ACTIVE')
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name);

-- 6.3. Customers
INSERT INTO customer (full_name, account_id, id_type, id_number, id_issue_date, id_issue_place, phone, email, nationality) VALUES
('Nguyễn Văn Khách', (SELECT account_id FROM account WHERE username = 'customer1'), 'CCCD', '001201001234', '2021-05-15', 'Cục Cảnh sát QLHC về TTXH', '0901234567', 'customer1@gmail.com', 'Việt Nam'),
('Trần Thị Lan', NULL, 'CCCD', '048202005678', '2022-08-20', 'Cục Cảnh sát QLHC về TTXH', '0912345678', 'lan.tran@gmail.com', 'Việt Nam'),
('John Smith', NULL, 'PASSPORT', 'B98765432', '2020-01-10', 'USA', '0987654321', 'john.smith@gmail.com', 'Hoa Kỳ')
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name);

-- 6.4. Room Types
INSERT INTO room_type (type_name, capacity, base_price, amenities, description) VALUES
('Phòng Standard', 2, 500000.00, 'Wifi tốc độ cao, TV màn hình phẳng, Điều hòa hai chiều, Bình nóng lạnh', 'Phòng tiêu chuẩn 1 giường đôi đầy đủ tiện nghi, sạch sẽ thoáng mát'),
('Phòng Deluxe Hướng Biển', 2, 850000.00, 'Wifi, TV 4K, Điều hòa, Bồn tắm ngâm, Ban công ngắm cảnh biển, Minibar', 'Phòng cao cấp view biển lãng mạn, nội thất hiện đại'),
('Phòng Suite Gia Đình', 4, 1500000.00, '2 Giường King, Phòng khách riêng, Bếp mini, Bồn tắm massage, Sofa bed', 'Phòng VIP không gian rộng rãi 65m2 thích hợp cho gia đình hoặc nhóm bạn')
ON DUPLICATE KEY UPDATE type_name = VALUES(type_name);

-- 6.5. Rooms
INSERT INTO room (room_number, room_type_id, floor, status, note) VALUES
('101', 1, 1, 'AVAILABLE', 'Phòng gần thang máy'),
('102', 1, 1, 'OCCUPIED', 'Khách đang lưu trú'),
('201', 2, 2, 'AVAILABLE', 'View biển tầng cao'),
('301', 3, 3, 'CLEANING', 'Đang dọn phòng chuẩn bị đón khách')
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- 6.6. Equipment (Thiết bị phòng)
INSERT INTO equipment (room_id, equipment_name, serial_number, status, note) VALUES
(1, 'Điều hòa Daikin 1.5HP Inverter', 'DK-2023-0101', 'WORKING', 'Lắp đặt 01/2023'),
(1, 'Smart TV Sony 50 inch 4K', 'SN-2023-0101', 'WORKING', 'Treo tường'),
(2, 'Điều hòa Daikin 1.5HP Inverter', 'DK-2023-0102', 'WORKING', 'Lắp đặt 01/2023'),
(2, 'Tủ lạnh mini Electrolux', 'EL-2023-0102', 'WORKING', 'Minibar phòng'),
(NULL, 'Máy giặt công nghiệp LG', 'LG-IND-001', 'WORKING', 'Khu vực giặt là chung')
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- 6.7. Service Categories & Services
INSERT INTO service_category (category_name) VALUES
('Ẩm thực & Đồ uống (F&B)'),
('Dịch vụ phòng & Giặt ủi'),
('Thư giãn & Spa')
ON DUPLICATE KEY UPDATE category_name = VALUES(category_name);

INSERT INTO service (category_id, service_name, unit_price, unit, is_active) VALUES
(1, 'Nước khoáng Lavie 500ml', 15000.00, 'Chai', TRUE),
(1, 'Bữa sáng Buffet', 120000.00, 'Suất', TRUE),
(2, 'Giặt ủi quần áo nhanh', 50000.00, 'Kg', TRUE),
(3, 'Massage body thư giãn 60 phút', 300000.00, 'Vé', TRUE)
ON DUPLICATE KEY UPDATE service_name = VALUES(service_name);

-- 6.8. Shifts
INSERT INTO shift (start_time, end_time) VALUES
('06:00:00', '14:00:00'),
('14:00:00', '22:00:00'),
('22:00:00', '06:00:00')
ON DUPLICATE KEY UPDATE start_time = VALUES(start_time);

-- 6.9. Vouchers
INSERT INTO voucher (created_by, voucher_code, voucher_name, description, discount_type, discount_value, max_discount_amount, min_order_amount, usage_limit, usage_limit_per_customer, valid_from, valid_to, is_active) VALUES
(1, 'SUMMER2026', 'Ưu đãi chào hè giảm 10%', 'Áp dụng cho mọi đơn đặt phòng trực tuyến', 'PERCENT', 10.00, 200000.00, 500000.00, 100, 1, '2026-06-01 00:00:00', '2026-12-31 23:59:59', TRUE),
(1, 'WELCOME50K', 'Mã chào mừng khách mới giảm 50.000đ', 'Giảm trực tiếp 50K cho đơn từ 300K', 'FIXED', 50000.00, NULL, 300000.00, 500, 1, '2026-01-01 00:00:00', '2026-12-31 23:59:59', TRUE)
ON DUPLICATE KEY UPDATE voucher_name = VALUES(voucher_name);

-- 6.10. Loyalty Tiers (4 hạng thành viên)
INSERT INTO loyalty_tier (tier_code, tier_name, tier_level, min_score, description) VALUES
('SEASHELL', 'Hạng Sò Biển (Seashell)', 1, 0.00, 'Hạng khởi đầu cho khách hàng đăng ký mới. Không có ưu đãi đặc quyền.'),
('STARFISH', 'Hạng Sao Biển (Starfish)', 2, 10.00, 'Đạt từ 10 điểm tích lũy: Giảm 5% giá phòng lưu trú.'),
('CORAL', 'Hạng San Hô (Coral)', 3, 30.00, 'Đạt từ 30 điểm tích lũy: Giảm 10% giá phòng, miễn phí giặt là 2 lần/năm.'),
('PEARL', 'Hạng Ngọc Trai (Pearl)', 4, 80.00, 'Đạt từ 80 điểm tích lũy: Giảm 15% giá phòng, miễn phí đưa đón sân bay, tặng 1 đêm nghỉ miễn phí/năm.')
ON DUPLICATE KEY UPDATE tier_name = VALUES(tier_name);

-- 6.11. Tier Benefits
INSERT INTO tier_benefit (tier_id, benefit_type, benefit_name, discount_percent, quota, period_type, description) VALUES
((SELECT tier_id FROM loyalty_tier WHERE tier_code = 'STARFISH'), 'ROOM_DISCOUNT', 'Giảm 5% giá phòng đặt trực tiếp', 5.00, NULL, 'YEAR', 'Áp dụng cho mọi lần đặt phòng trong năm'),
((SELECT tier_id FROM loyalty_tier WHERE tier_code = 'CORAL'), 'ROOM_DISCOUNT', 'Giảm 10% giá phòng đặt trực tiếp', 10.00, NULL, 'YEAR', 'Áp dụng không giới hạn trong năm'),
((SELECT tier_id FROM loyalty_tier WHERE tier_code = 'CORAL'), 'FREE_SERVICE', 'Miễn phí giặt ủi nhanh 3kg', NULL, 2, 'YEAR', 'Tặng 2 lần giặt ủi miễn phí mỗi năm'),
((SELECT tier_id FROM loyalty_tier WHERE tier_code = 'PEARL'), 'ROOM_DISCOUNT', 'Giảm 15% giá phòng VIP', 15.00, NULL, 'YEAR', 'Ưu đãi cao nhất cho hạng Ngọc Trai'),
((SELECT tier_id FROM loyalty_tier WHERE tier_code = 'PEARL'), 'FREE_NIGHT', 'Tặng 1 đêm nghỉ miễn phí', NULL, 1, 'YEAR', 'Miễn phí 1 đêm nghỉ phòng Standard/Deluxe mỗi năm')
ON DUPLICATE KEY UPDATE benefit_name = VALUES(benefit_name);

-- 6.12. Customer Loyalty Seed
INSERT INTO customer_loyalty (customer_id, tier_id, total_stay_days, total_spent, total_score)
SELECT 
    c.customer_id, 
    (SELECT tier_id FROM loyalty_tier WHERE tier_code = 'SEASHELL'),
    0, 0.00, 0.00
FROM customer c
LEFT JOIN customer_loyalty cl ON c.customer_id = cl.customer_id
WHERE cl.customer_id IS NULL;
