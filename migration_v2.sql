-- ====================================================================
-- PBL6: DATABASE MIGRATION SCRIPT TO V2 (26 TABLES COMPLETE SCHEMA)
-- ====================================================================
USE hotel_management;

-- 1. BẢNG PHÂN QUYỀN MỚI: role
CREATE TABLE IF NOT EXISTS role (
    role_id INT AUTO_INCREMENT PRIMARY KEY,
    role_code VARCHAR(50) NOT NULL UNIQUE COMMENT 'ROLE_ADMIN | ROLE_MANAGER | ROLE_RECEPTIONIST | ROLE_HOUSEKEEPING | ROLE_MAINTENANCE | ROLE_SERVICE_STAFF | ROLE_CUSTOMER',
    role_name VARCHAR(100) NOT NULL,
    description TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Thêm các vai trò chuẩn hóa nếu chưa có
INSERT INTO role (role_code, role_name, description) VALUES
('ROLE_ADMIN', 'Quản trị viên hệ thống', 'Toàn quyền cấu hình và quản trị hệ thống khách sạn'),
('ROLE_MANAGER', 'Quản lý khách sạn', 'Quản lý vận hành toàn diện, phê duyệt chiết khấu, giám sát báo cáo'),
('ROLE_RECEPTIONIST', 'Nhân viên lễ tân', 'Xử lý đặt phòng, check-in, check-out, thanh toán và thu cọc'),
('ROLE_HOUSEKEEPING', 'Nhân viên buồng phòng', 'Dọn dẹp phòng, kiểm tra buồng phòng và cập nhật tình trạng phòng'),
('ROLE_MAINTENANCE', 'Nhân viên kỹ thuật & bảo trì', 'Tiếp nhận và xử lý sửa chữa trang thiết bị, bảo trì phòng'),
('ROLE_SERVICE_STAFF', 'Nhân viên phục vụ dịch vụ', 'Tiếp nhận và thực hiện các dịch vụ phòng, ăn uống, giặt ủi cho khách'),
('ROLE_CUSTOMER', 'Khách hàng', 'Tài khoản khách hàng trực tuyến đặt phòng và tra cứu lịch sử')
ON DUPLICATE KEY UPDATE role_name = VALUES(role_name), description = VALUES(description);

-- 2. CẬP NHẬT BẢNG account: Thêm role_id FK và ánh xạ dữ liệu cũ
-- Thêm cột role_id nếu chưa có
SET @exist_role_id := (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'hotel_management' 
      AND TABLE_NAME = 'account' 
      AND COLUMN_NAME = 'role_id'
);

SET @sql := IF(@exist_role_id = 0, 'ALTER TABLE account ADD COLUMN role_id INT NULL AFTER phone;', 'SELECT 1;');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ánh xạ role cũ (string) sang role_id mới
UPDATE account a
JOIN role r ON (
    (a.role = 'ADMIN' AND r.role_code = 'ROLE_ADMIN') OR
    (a.role = 'MANAGER' AND r.role_code = 'ROLE_MANAGER') OR
    (a.role = 'RECEPTIONIST' AND r.role_code = 'ROLE_RECEPTIONIST') OR
    (a.role = 'CASHIER' AND r.role_code = 'ROLE_RECEPTIONIST') OR
    (a.role = 'HOUSEKEEPING' AND r.role_code = 'ROLE_HOUSEKEEPING') OR
    (a.role = 'CUSTOMER' AND r.role_code = 'ROLE_CUSTOMER') OR
    (a.role = r.role_code)
)
SET a.role_id = r.role_id
WHERE a.role_id IS NULL;

-- Gán mặc định nếu có tài khoản nào chưa map được
UPDATE account SET role_id = (SELECT role_id FROM role WHERE role_code = 'ROLE_CUSTOMER') WHERE role_id IS NULL;

-- Thêm Foreign Key fk_account_role nếu chưa có
SET @exist_fk_role := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = 'hotel_management'
      AND TABLE_NAME = 'account'
      AND CONSTRAINT_NAME = 'fk_account_role'
);

SET @sql_fk_role := IF(@exist_fk_role = 0, 
    'ALTER TABLE account ADD CONSTRAINT fk_account_role FOREIGN KEY (role_id) REFERENCES role(role_id) ON DELETE RESTRICT;', 
    'SELECT 1;'
);
PREPARE stmt_fk FROM @sql_fk_role;
EXECUTE stmt_fk;
DEALLOCATE PREPARE stmt_fk;


-- 3. CẬP NHẬT BẢNG customer: Thêm account_id (nullable, unique)
SET @exist_cust_account := (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'hotel_management' 
      AND TABLE_NAME = 'customer' 
      AND COLUMN_NAME = 'account_id'
);

SET @sql_cust := IF(@exist_cust_account = 0, 'ALTER TABLE customer ADD COLUMN account_id INT NULL UNIQUE AFTER customer_id;', 'SELECT 1;');
PREPARE stmt_cust FROM @sql_cust;
EXECUTE stmt_cust;
DEALLOCATE PREPARE stmt_cust;

-- Thêm Foreign Key fk_customer_account
SET @exist_fk_cust_acc := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = 'hotel_management'
      AND TABLE_NAME = 'customer'
      AND CONSTRAINT_NAME = 'fk_customer_account'
);

SET @sql_fk_cust := IF(@exist_fk_cust_acc = 0, 
    'ALTER TABLE customer ADD CONSTRAINT fk_customer_account FOREIGN KEY (account_id) REFERENCES account(account_id) ON DELETE SET NULL;', 
    'SELECT 1;'
);
PREPARE stmt_fk_cust FROM @sql_fk_cust;
EXECUTE stmt_fk_cust;
DEALLOCATE PREPARE stmt_fk_cust;

-- Liên kết tài khoản khách mẫu customer1 với khách hàng Nguyễn Văn Khách
UPDATE customer c
JOIN account a ON a.username = 'customer1'
SET c.account_id = a.account_id
WHERE c.customer_id = 1 AND c.account_id IS NULL;


-- 4. BẢNG MỚI: equipment (Quản lý thiết bị)
CREATE TABLE IF NOT EXISTS equipment (
    equipment_id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT NULL COMMENT 'nullable, null = common area',
    equipment_name VARCHAR(100) NOT NULL,
    serial_number VARCHAR(100),
    status VARCHAR(50) DEFAULT 'WORKING' COMMENT 'WORKING | BROKEN | UNDER_REPAIR | RETIRED',
    note TEXT,
    FOREIGN KEY (room_id) REFERENCES room(room_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 5. BẢNG MỚI: maintenance_request (Yêu cầu bảo trì, sửa chữa)
CREATE TABLE IF NOT EXISTS maintenance_request (
    request_id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT NOT NULL,
    equipment_id INT NULL,
    reported_by INT NOT NULL COMMENT 'account báo hỏng',
    assigned_to INT NULL COMMENT 'account nhân viên bảo trì',
    confirmed_by INT NULL COMMENT 'account xác nhận hoàn thành',
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


-- 6. BẢNG MỚI: service_request (Yêu cầu dịch vụ phòng của khách)
CREATE TABLE IF NOT EXISTS service_request (
    service_request_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    room_id INT NOT NULL,
    service_id INT NOT NULL,
    customer_id INT NOT NULL COMMENT 'guest who made the request',
    assigned_to INT NULL COMMENT 'account nhân viên dịch vụ xử lý',
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


-- 7. CẬP NHẬT BẢNG voucher THEO CHUẨN MỚI
-- Nếu bảng voucher đã có với cấu trúc cũ, chuẩn hóa lại cột
SET @exist_voucher_code := (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'hotel_management' 
      AND TABLE_NAME = 'voucher' 
      AND COLUMN_NAME = 'voucher_code'
);

SET @sql_v_code := IF(@exist_voucher_code = 0, 'ALTER TABLE voucher CHANGE COLUMN code voucher_code VARCHAR(50) NOT NULL UNIQUE;', 'SELECT 1;');
PREPARE stmt_v_code FROM @sql_v_code;
EXECUTE stmt_v_code;
DEALLOCATE PREPARE stmt_v_code;

-- Đổi start_date -> valid_from (DATETIME)
SET @exist_start_date := (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'hotel_management' 
      AND TABLE_NAME = 'voucher' 
      AND COLUMN_NAME = 'start_date'
);
SET @sql_v_from := IF(@exist_start_date > 0, 'ALTER TABLE voucher CHANGE COLUMN start_date valid_from DATETIME NULL;', 'SELECT 1;');
PREPARE stmt_v_from FROM @sql_v_from;
EXECUTE stmt_v_from;
DEALLOCATE PREPARE stmt_v_from;

-- Đổi end_date -> valid_to (DATETIME)
SET @exist_end_date := (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'hotel_management' 
      AND TABLE_NAME = 'voucher' 
      AND COLUMN_NAME = 'end_date'
);
SET @sql_v_to := IF(@exist_end_date > 0, 'ALTER TABLE voucher CHANGE COLUMN end_date valid_to DATETIME NULL;', 'SELECT 1;');
PREPARE stmt_v_to FROM @sql_v_to;
EXECUTE stmt_v_to;
DEALLOCATE PREPARE stmt_v_to;

-- Thêm created_by nếu chưa có
SET @exist_v_created_by := (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'hotel_management' 
      AND TABLE_NAME = 'voucher' 
      AND COLUMN_NAME = 'created_by'
);
SET @sql_v_cby := IF(@exist_v_created_by = 0, 'ALTER TABLE voucher ADD COLUMN created_by INT NULL AFTER voucher_id;', 'SELECT 1;');
PREPARE stmt_v_cby FROM @sql_v_cby;
EXECUTE stmt_v_cby;
DEALLOCATE PREPARE stmt_v_cby;

-- Thêm description nếu chưa có
SET @exist_v_desc := (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'hotel_management' 
      AND TABLE_NAME = 'voucher' 
      AND COLUMN_NAME = 'description'
);
SET @sql_v_desc := IF(@exist_v_desc = 0, 'ALTER TABLE voucher ADD COLUMN description TEXT NULL AFTER voucher_name;', 'SELECT 1;');
PREPARE stmt_v_desc FROM @sql_v_desc;
EXECUTE stmt_v_desc;
DEALLOCATE PREPARE stmt_v_desc;

-- Thêm usage_limit_per_customer nếu chưa có
SET @exist_v_per_cust := (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'hotel_management' 
      AND TABLE_NAME = 'voucher' 
      AND COLUMN_NAME = 'usage_limit_per_customer'
);
SET @sql_v_pcust := IF(@exist_v_per_cust = 0, 'ALTER TABLE voucher ADD COLUMN usage_limit_per_customer INT NULL AFTER usage_limit;', 'SELECT 1;');
PREPARE stmt_v_pcust FROM @sql_v_pcust;
EXECUTE stmt_v_pcust;
DEALLOCATE PREPARE stmt_v_pcust;

-- Chuẩn hóa discount_type
UPDATE voucher SET discount_type = 'PERCENT' WHERE discount_type IN ('PERCENTAGE', 'PERCENT');
UPDATE voucher SET discount_type = 'FIXED' WHERE discount_type IN ('FIXED_AMOUNT', 'FIXED');

-- Gán created_by = 1 (admin) cho voucher hiện có nếu đang null
UPDATE voucher SET created_by = 1 WHERE created_by IS NULL;

-- Thêm FK created_by vào account
SET @exist_fk_v_acc := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = 'hotel_management'
      AND TABLE_NAME = 'voucher'
      AND CONSTRAINT_NAME = 'fk_voucher_created_by'
);
SET @sql_fk_vacc := IF(@exist_fk_v_acc = 0, 
    'ALTER TABLE voucher ADD CONSTRAINT fk_voucher_created_by FOREIGN KEY (created_by) REFERENCES account(account_id) ON DELETE SET NULL;', 
    'SELECT 1;'
);
PREPARE stmt_fk_vacc FROM @sql_fk_vacc;
EXECUTE stmt_fk_vacc;
DEALLOCATE PREPARE stmt_fk_vacc;


-- 8. BẢNG MỚI: voucher_redemption (Lịch sử sử dụng voucher)
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


-- 9. PHÂN HỆ LOYALTY (COASTAL BAY CLUB - 5 BẢNG)

-- 9.1. loyalty_tier (Hạng thành viên)
CREATE TABLE IF NOT EXISTS loyalty_tier (
    tier_id INT AUTO_INCREMENT PRIMARY KEY,
    tier_code VARCHAR(50) NOT NULL UNIQUE COMMENT 'SEASHELL | STARFISH | CORAL | PEARL',
    tier_name VARCHAR(100) NOT NULL,
    tier_level INT NOT NULL UNIQUE COMMENT '1 to 4',
    min_score DECIMAL(10, 2) NOT NULL DEFAULT 0,
    description TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO loyalty_tier (tier_code, tier_name, tier_level, min_score, description) VALUES
('SEASHELL', 'Hạng Sò Biển (Seashell)', 1, 0.00, 'Hạng khởi đầu cho khách hàng đăng ký mới. Không có ưu đãi đặc quyền.'),
('STARFISH', 'Hạng Sao Biển (Starfish)', 2, 10.00, 'Đạt từ 10 điểm tích lũy: Giảm 5% giá phòng lưu trú.'),
('CORAL', 'Hạng San Hô (Coral)', 3, 30.00, 'Đạt từ 30 điểm tích lũy: Giảm 10% giá phòng, miễn phí giặt là 2 lần/năm.'),
('PEARL', 'Hạng Ngọc Trai (Pearl)', 4, 80.00, 'Đạt từ 80 điểm tích lũy: Giảm 15% giá phòng, miễn phí đưa đón sân bay, tặng 1 đêm nghỉ miễn phí/năm.')
ON DUPLICATE KEY UPDATE tier_name = VALUES(tier_name), min_score = VALUES(min_score), description = VALUES(description);

-- 9.2. customer_loyalty (Thông tin tích điểm & hạng của khách hàng, 1:1 với customer)
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

-- Khởi tạo loyalty mặc định (hạng Seashell) cho các khách hàng hiện có nếu chưa có
INSERT INTO customer_loyalty (customer_id, tier_id, total_stay_days, total_spent, total_score)
SELECT 
    c.customer_id, 
    (SELECT tier_id FROM loyalty_tier WHERE tier_code = 'SEASHELL'),
    0, 0.00, 0.00
FROM customer c
LEFT JOIN customer_loyalty cl ON c.customer_id = cl.customer_id
WHERE cl.customer_id IS NULL;

-- 9.3. loyalty_transaction (Lịch sử biến động điểm)
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

-- 9.4. tier_benefit (Quy định đặc quyền theo hạng)
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

-- Thêm các đặc quyền mẫu theo thiết kế
INSERT INTO tier_benefit (tier_id, benefit_type, benefit_name, discount_percent, quota, period_type, description) VALUES
((SELECT tier_id FROM loyalty_tier WHERE tier_code = 'STARFISH'), 'ROOM_DISCOUNT', 'Giảm 5% giá phòng đặt trực tiếp', 5.00, NULL, 'YEAR', 'Áp dụng cho mọi lần đặt phòng trong năm'),
((SELECT tier_id FROM loyalty_tier WHERE tier_code = 'CORAL'), 'ROOM_DISCOUNT', 'Giảm 10% giá phòng đặt trực tiếp', 10.00, NULL, 'YEAR', 'Áp dụng không giới hạn trong năm'),
((SELECT tier_id FROM loyalty_tier WHERE tier_code = 'CORAL'), 'FREE_SERVICE', 'Miễn phí giặt ủi nhanh 3kg', NULL, 2, 'YEAR', 'Tặng 2 lần giặt ủi miễn phí mỗi năm'),
((SELECT tier_id FROM loyalty_tier WHERE tier_code = 'PEARL'), 'ROOM_DISCOUNT', 'Giảm 15% giá phòng VIP', 15.00, NULL, 'YEAR', 'Ưu đãi cao nhất cho hạng Ngọc Trai'),
((SELECT tier_id FROM loyalty_tier WHERE tier_code = 'PEARL'), 'FREE_NIGHT', 'Tặng 1 đêm nghỉ miễn phí', NULL, 1, 'YEAR', 'Miễn phí 1 đêm nghỉ phòng Standard/Deluxe mỗi năm')
ON DUPLICATE KEY UPDATE benefit_name = VALUES(benefit_name);

-- 9.5. benefit_redemption (Lịch sử sử dụng đặc quyền của khách)
CREATE TABLE IF NOT EXISTS benefit_redemption (
    redemption_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    tier_benefit_id INT NOT NULL,
    booking_id INT NULL,
    invoice_id INT NULL,
    service_usage_id INT NULL COMMENT 'nullable, for FREE_SERVICE',
    approved_by INT NULL COMMENT 'account nhân viên duyệt ưu đãi',
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
-- KẾT THÚC SCRIPT MIGRATION
-- ====================================================================
