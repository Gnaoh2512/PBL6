-- =====================================================================
-- PBL6 HOTEL MANAGEMENT - DUMMY / DEMO DATA (V4 REFACTORED)
-- Run AFTER schema_v4_clean.sql.
-- Password for all accounts: Pbl6Demo@123
-- =====================================================================

USE hotel_management;
SET NAMES utf8mb4;
START TRANSACTION;

-- ---------------------------------------------------------------------
-- 1. Roles, room types, service categories, shifts & loyalty tiers
-- ---------------------------------------------------------------------
INSERT INTO role (role_id, role_code, role_name, description) VALUES
(1,'ROLE_ADMIN','Administrator','System administration'),
(2,'ROLE_MANAGER','Hotel Manager','Hotel operations and approvals'),
(3,'ROLE_RECEPTIONIST','Receptionist','Bookings, check-in/out and payments'),
(4,'ROLE_HOUSEKEEPING','Housekeeping Staff','Room cleaning and room status'),
(5,'ROLE_MAINTENANCE','Maintenance Staff','Equipment and room maintenance'),
(6,'ROLE_SERVICE_STAFF','Service Staff','Guest service requests'),
(7,'ROLE_CUSTOMER','Customer','Online guest account');

INSERT INTO room_type (room_type_id,type_name,capacity,base_price,amenities,description) VALUES
(1,'Standard',2,850000.00,'Wi-Fi, TV, air conditioning','Standard room'),
(2,'Deluxe',2,1250000.00,'Wi-Fi, TV, minibar, balcony','Deluxe room'),
(3,'Suite',3,2400000.00,'Wi-Fi, TV, living area, bathtub','Suite room'),
(4,'VIP',2,3500000.00,'Wi-Fi, sea view, lounge access','VIP room');

INSERT INTO service_category (category_id,category_name) VALUES
(1,'Food and Beverage'),
(2,'Laundry'),
(3,'Transportation'),
(4,'Wellness');

INSERT INTO shift (shift_id, shift_name, start_time, end_time) VALUES
(1, 'MORNING',   '06:00:00', '14:00:00'),
(2, 'AFTERNOON', '14:00:00', '22:00:00'),
(3, 'NIGHT',     '22:00:00', '06:00:00');

INSERT INTO loyalty_tier (tier_id,tier_code,tier_name,tier_level,min_score,description) VALUES
(1,'SEASHELL','Seashell',1,0.00,'Entry tier'),
(2,'STARFISH','Starfish',2,10.00,'10 points and above'),
(3,'CORAL','Coral',3,30.00,'30 points and above'),
(4,'PEARL','Pearl',4,80.00,'80 points and above');

-- ---------------------------------------------------------------------
-- 2. Accounts and customers (Includes walk-in customer without account)
-- ---------------------------------------------------------------------
INSERT INTO account
(account_id,username,password_hash,full_name,email,phone,role_id,status,created_at)
VALUES
(1,'admin','$2a$10$XQvafm9hfGEnTeeDuQKiFOf9uz09XklV15FUCfPv0PQTAu3mjYn9W','System Admin','admin@pbl6.local','0900000001',1,'ACTIVE','2026-01-01 08:00:00'),
(2,'manager','$2a$10$XQvafm9hfGEnTeeDuQKiFOf9uz09XklV15FUCfPv0PQTAu3mjYn9W','Hotel Manager','manager@pbl6.local','0900000002',2,'ACTIVE','2026-01-01 08:00:00'),
(3,'reception1','$2a$10$XQvafm9hfGEnTeeDuQKiFOf9uz09XklV15FUCfPv0PQTAu3mjYn9W','Receptionist One','reception1@pbl6.local','0900000003',3,'ACTIVE','2026-01-01 08:00:00'),
(4,'housekeeping1','$2a$10$XQvafm9hfGEnTeeDuQKiFOf9uz09XklV15FUCfPv0PQTAu3mjYn9W','Housekeeping One','housekeeping1@pbl6.local','0900000004',4,'ACTIVE','2026-01-01 08:00:00'),
(5,'maintenance1','$2a$10$XQvafm9hfGEnTeeDuQKiFOf9uz09XklV15FUCfPv0PQTAu3mjYn9W','Maintenance One','maintenance1@pbl6.local','0900000005',5,'ACTIVE','2026-01-01 08:00:00'),
(6,'service1','$2a$10$XQvafm9hfGEnTeeDuQKiFOf9uz09XklV15FUCfPv0PQTAu3mjYn9W','Service Staff One','service1@pbl6.local','0900000006',6,'ACTIVE','2026-01-01 08:00:00'),
(7,'customer1','$2a$10$XQvafm9hfGEnTeeDuQKiFOf9uz09XklV15FUCfPv0PQTAu3mjYn9W','Nguyen Minh Anh','customer1@pbl6.local','0910000001',7,'ACTIVE','2026-01-02 08:00:00'),
(8,'customer2','$2a$10$XQvafm9hfGEnTeeDuQKiFOf9uz09XklV15FUCfPv0PQTAu3mjYn9W','Tran Bao Ngoc','customer2@pbl6.local','0910000002',7,'ACTIVE','2026-01-03 08:00:00');

INSERT INTO customer
(customer_id,account_id,full_name,id_type,id_number,id_issue_date,id_issue_place,phone,email,nationality,created_at)
VALUES
(1,7,'Nguyen Minh Anh','CCCD','079201000001','2021-06-10','Da Nang','0910000001','customer1@pbl6.local','Vietnamese','2026-01-02 08:00:00'),
(2,8,'Tran Bao Ngoc','CCCD','079201000002','2021-07-11','Ho Chi Minh City','0910000002','customer2@pbl6.local','Vietnamese','2026-01-03 08:00:00'),
(3,NULL,'Le Quoc Bao (Walk-in)','PASSPORT','P1234567','2020-02-12','Hanoi','0910000003','bao@example.local','Vietnamese','2026-01-04 08:00:00'),
(4,NULL,'Pham Thu Ha (Walk-in)','PASSPORT','P7654321','2020-03-13','Hue','0910000004','ha@example.local','Vietnamese','2026-01-05 08:00:00');

-- ---------------------------------------------------------------------
-- 3. Rooms, services, work schedules, equipment, cashier shift
-- ---------------------------------------------------------------------
INSERT INTO room (room_id,room_number,room_type_id,floor,status,note) VALUES
(1,'101',1,1,'AVAILABLE','Near elevator'),
(2,'102',1,1,'AVAILABLE',NULL),
(3,'201',2,2,'OCCUPIED',NULL),
(4,'202',2,2,'AVAILABLE','Sea view'),
(5,'301',3,3,'AVAILABLE',NULL),
(6,'401',4,4,'MAINTENANCE','Temporarily unavailable');

INSERT INTO service (service_id,category_id,service_name,unit_price,unit,is_active) VALUES
(1,1,'Breakfast Set',180000.00,'person',1),
(2,3,'Airport Transfer',350000.00,'trip',1),
(3,2,'Express Laundry 3kg',120000.00,'package',1),
(4,4,'Spa Session',500000.00,'session',1),
(5,1,'In-room Dining',250000.00,'order',1);

-- Expanded work schedules for calendar views (November 2026)
INSERT INTO work_schedule (schedule_id, account_id, shift_id, work_date, status, note) VALUES
(1,  3, 1, '2026-11-08', 'COMPLETED', 'Front desk shift'),
(2,  3, 1, '2026-11-09', 'COMPLETED', 'Front desk shift'),
(3,  3, 1, '2026-11-10', 'COMPLETED', 'Front desk shift'),
(4,  3, 1, '2026-11-11', 'COMPLETED', 'Cashier shift assigned'),
(5,  3, 1, '2026-11-12', 'SCHEDULED', 'Front desk shift'),

(6,  4, 1, '2026-11-08', 'COMPLETED', 'Housekeeping shift'),
(7,  4, 1, '2026-11-09', 'COMPLETED', 'Housekeeping shift'),
(8,  4, 1, '2026-11-10', 'COMPLETED', 'Housekeeping shift'),
(9,  4, 1, '2026-11-11', 'COMPLETED', 'Housekeeping shift'),
(10, 4, 1, '2026-11-12', 'SCHEDULED', 'Housekeeping shift'),

(11, 5, 2, '2026-11-08', 'COMPLETED', 'Maintenance shift'),
(12, 5, 2, '2026-11-09', 'COMPLETED', 'Maintenance shift'),
(13, 5, 2, '2026-11-10', 'COMPLETED', 'Maintenance shift'),
(14, 5, 2, '2026-11-11', 'COMPLETED', 'Maintenance shift'),
(15, 5, 2, '2026-11-12', 'SCHEDULED', 'Maintenance shift'),

(16, 6, 2, '2026-11-08', 'COMPLETED', 'Service shift'),
(17, 6, 2, '2026-11-09', 'COMPLETED', 'Service shift'),
(18, 6, 2, '2026-11-10', 'COMPLETED', 'Service shift'),
(19, 6, 2, '2026-11-11', 'COMPLETED', 'Service shift'),
(20, 6, 2, '2026-11-12', 'SCHEDULED', 'Service shift');

INSERT INTO equipment (equipment_id,room_id,equipment_name,serial_number,status,note) VALUES
(1,1,'Air Conditioner','AC-101-001','WORKING',NULL),
(2,3,'Television','TV-201-001','WORKING',NULL),
(3,6,'Water Heater','WH-401-001','BROKEN','Heating element needs replacement'),
(4,NULL,'Lobby Printer','PRN-LOBBY-01','WORKING','Shared equipment');

INSERT INTO cashier_shift
(cashier_shift_id,account_id,schedule_id,start_time,end_time,opening_cash,closing_cash_actual,status,received_by,handover_note)
VALUES
(1,3,4,'2026-11-11 06:00:00','2026-11-11 14:00:00',5000000.00,6350000.00,'CLOSED',2,'Shift handed over to manager');

-- ---------------------------------------------------------------------
-- 4. Loyalty benefits
-- ---------------------------------------------------------------------
INSERT INTO tier_benefit
(tier_benefit_id,tier_id,service_id,room_type_id,benefit_type,benefit_name,discount_percent,quota,period_type,is_active,description)
VALUES
(1,2,NULL,NULL,'ROOM_DISCOUNT','Starfish room discount',5.00,NULL,'YEAR',1,'5 percent room discount, unlimited per calendar year'),
(2,3,NULL,NULL,'ROOM_DISCOUNT','Coral room discount',10.00,NULL,'YEAR',1,'10 percent room discount, unlimited per calendar year'),
(3,3,3,NULL,'FREE_SERVICE','Coral annual laundry allowance',NULL,2,'YEAR',1,'Two express laundry packages per calendar year'),
(4,4,NULL,NULL,'ROOM_DISCOUNT','Pearl room discount',15.00,NULL,'YEAR',1,'15 percent room discount, unlimited per calendar year'),
(5,4,NULL,2,'FREE_NIGHT','Pearl annual free night',NULL,1,'YEAR',1,'One free night in a Deluxe room or lower'),
(6,2,1,NULL,'FREE_SERVICE','Starfish daily breakfast',NULL,1,'DAY',1,'One breakfast set per calendar day'),
(7,3,3,NULL,'FREE_SERVICE','Coral monthly laundry allowance',NULL,1,'MONTH',1,'One express laundry package per calendar month');

INSERT INTO customer_loyalty
(customer_id,tier_id,total_stay_days,total_spent,total_score,tier_updated_at,joined_at)
VALUES
(1,4,18,96500000.00,96.50,'2026-10-01 10:00:00','2025-01-01 09:00:00'),
(2,3,9,36500000.00,36.50,'2026-09-15 10:00:00','2025-03-01 09:00:00'),
(3,2,4,12500000.00,12.50,'2026-08-20 10:00:00','2025-05-01 09:00:00'),
(4,1,0,0.00,0.00,'2026-01-05 08:00:00','2026-01-05 08:00:00');

-- ---------------------------------------------------------------------
-- 5. Bookings, invoices, service usage
-- ---------------------------------------------------------------------
INSERT INTO booking
(booking_id,booking_code,customer_id,created_by,check_in_date,check_out_date,guest_count,status,deposit_required,source,note,created_at)
VALUES
(1,'BK-2026-0001',1,3,'2026-10-01','2026-10-04',2,'CHECKED_OUT',1000000.00,'DIRECT','Pearl member stay','2026-09-20 09:00:00'),
(2,'BK-2026-0002',1,3,'2026-10-15','2026-10-17',2,'CHECKED_OUT',1000000.00,'ONLINE','Pearl free-night test booking','2026-10-01 10:00:00'),
(3,'BK-2026-0003',2,3,'2026-11-05','2026-11-08',2,'CHECKED_OUT',1500000.00,'DIRECT','Coral member stay','2026-10-25 11:00:00'),
(4,'BK-2026-0004',3,3,'2026-11-20','2026-11-22',1,'CONFIRMED',800000.00,'ONLINE','Starfish member upcoming stay','2026-11-01 12:00:00');

INSERT INTO booking_room
(booking_room_id,booking_id,room_id,planned_checkin,planned_checkout,status,actual_checkin,actual_checkout,price_applied)
VALUES
(1,1,3,'2026-10-01','2026-10-04','CHECKED_OUT','2026-10-01 14:00:00','2026-10-04 11:00:00',1250000.00),
(2,2,4,'2026-10-15','2026-10-17','CHECKED_OUT','2026-10-15 14:00:00','2026-10-17 11:00:00',1250000.00),
(3,3,5,'2026-11-05','2026-11-08','CHECKED_OUT','2026-11-05 14:00:00','2026-11-08 11:00:00',2400000.00),
(4,4,1,'2026-11-20','2026-11-22','RESERVED',NULL,NULL,850000.00);

INSERT INTO invoice
(invoice_id,invoice_number,booking_id,issued_by,discount_approved_by,room_charge,service_charge,tax_amount,discount_amount,deposit_applied,total_amount,status,issued_at)
VALUES
(1,'INV-2026-0001',1,3,2,3750000.00,360000.00,411000.00,562500.00,1000000.00,2958500.00,'PAID','2026-10-04 11:30:00'),
(2,'INV-2026-0002',2,3,2,2500000.00,0.00,250000.00,0.00,1000000.00,1750000.00,'PAID','2026-10-17 11:30:00'),
(3,'INV-2026-0003',3,3,NULL,7200000.00,120000.00,732000.00,720000.00,1500000.00,5832000.00,'PAID','2026-11-08 11:30:00');

INSERT INTO service_usage
(usage_id,booking_id,service_id,invoice_id,quantity,unit_price_applied,discount_amount,total_price,status,recorded_by,used_at)
VALUES
(1,3,3,3,1,120000.00,120000.00,0.00,'COMPLETED',6,'2026-11-06 09:00:00'),
(2,1,1,1,2,180000.00,0.00,360000.00,'COMPLETED',6,'2026-10-02 07:30:00'),
(3,3,5,3,1,250000.00,0.00,250000.00,'COMPLETED',6,'2026-11-06 19:00:00');

-- ---------------------------------------------------------------------
-- 6. Vouchers, payments, service requests, maintenance & room cleaning
-- ---------------------------------------------------------------------
INSERT INTO voucher
(voucher_id,created_by,voucher_code,voucher_name,description,discount_type,discount_value,max_discount_amount,min_order_amount,usage_limit,usage_limit_per_customer,valid_from,valid_to,is_active)
VALUES
(1,1,'WELCOME10','Welcome 10 Percent','Demo voucher for first booking','PERCENT',10.00,1000000.00,1000000.00,100,1,'2026-01-01 00:00:00','2027-12-31 23:59:59',1),
(2,1,'FLAT200','Flat 200K','Fixed discount demo','FIXED',200000.00,NULL,1500000.00,50,1,'2026-01-01 00:00:00','2027-12-31 23:59:59',1);

INSERT INTO voucher_redemption
(redemption_id,voucher_id,customer_id,booking_id,invoice_id,discount_applied,redeemed_at)
VALUES
(1,1,2,3,3,720000.00,'2026-11-08 10:00:00');

INSERT INTO payment
(payment_id,booking_id,invoice_id,cashier_shift_id,type,method,amount,received_by,approved_by,note,paid_at)
VALUES
(1,1,NULL,1,'DEPOSIT','CASH',1000000.00,3,2,'Booking deposit','2026-09-20 09:05:00'),
(2,1,1,1,'PAYMENT','CARD',2958500.00,3,2,'Final invoice payment','2026-10-04 11:35:00'),
(3,2,NULL,1,'DEPOSIT','BANK_TRANSFER',1000000.00,3,2,'Booking deposit','2026-10-01 10:05:00'),
(4,2,2,1,'PAYMENT','BANK_TRANSFER',1750000.00,3,2,'Final invoice payment','2026-10-17 11:35:00'),
(5,3,NULL,1,'DEPOSIT','CASH',1500000.00,3,2,'Booking deposit','2026-10-25 11:05:00'),
(6,3,3,1,'PAYMENT','CARD',5832000.00,3,2,'Final invoice payment','2026-11-08 11:35:00');

-- Service Requests matching new status lifecycle (PENDING -> DELIVERING -> COMPLETED)
INSERT INTO service_request
(service_request_id,booking_id,room_id,service_id,customer_id,assigned_to,invoice_id,quantity,fee_amount,status,note,requested_at,completed_at)
VALUES
(1,3,5,3,2,6,3,1,120000.00,'COMPLETED','Express laundry request','2026-11-06 08:30:00','2026-11-06 10:00:00'),
(2,4,1,2,3,6,NULL,1,350000.00,'DELIVERING','Airport pickup request assigned to service staff 1','2026-11-10 14:00:00',NULL),
(3,3,5,1,2,NULL,NULL,2,360000.00,'PENDING','Breakfast set in-room dining requested by guest','2026-11-11 20:00:00',NULL);

-- Maintenance Requests (Assigned to ROLE_MAINTENANCE account 5)
INSERT INTO maintenance_request
(request_id,room_id,equipment_id,reported_by,assigned_to,confirmed_by,title,description,priority,status,resolution_note,reported_at,started_at,completed_at,confirmed_at)
VALUES
(1,6,3,4,5,2,'Water heater not heating','Guest room water heater does not produce hot water','HIGH','CONFIRMED','Heating element replaced and tested','2026-11-08 08:00:00','2026-11-08 09:00:00','2026-11-08 11:00:00','2026-11-08 11:30:00'),
(2,3,2,4,5,NULL,'TV remote not responding','Replace remote batteries','LOW','IN_PROGRESS',NULL,'2026-11-10 09:00:00','2026-11-10 10:00:00',NULL,NULL);

-- Room Cleaning Requests (Assigned to ROLE_HOUSEKEEPING account 4)
INSERT INTO roomcleaning_request
(request_id,room_id,reported_by,assigned_to,confirmed_by,title,description,priority,status,note,reported_at,started_at,completed_at,confirmed_at)
VALUES
(1,3,3,4,NULL,'Dọn phòng định kỳ','Khách yêu cầu dọn phòng và thay ga giường','MEDIUM','IN_PROGRESS','Đang thực hiện dọn phòng','2026-11-11 09:00:00','2026-11-11 09:15:00',NULL,NULL),
(2,2,3,4,2,'Dọn phòng sau Check-out','Dọn dẹp và khử trùng phòng 102','HIGH','CONFIRMED','Hoàn tất vệ sinh phòng','2026-11-10 11:00:00','2026-11-10 11:15:00','2026-11-10 12:00:00','2026-11-10 12:15:00');

-- ---------------------------------------------------------------------
-- 7. Loyalty transactions, benefit redemptions & audit log (Text format)
-- ---------------------------------------------------------------------
INSERT INTO loyalty_transaction
(txn_id,customer_id,invoice_id,created_by,txn_type,stay_days,amount_spent,score_earned,note,created_at)
VALUES
(1,1,1,NULL,'EARN',3,2958500.00,29.59,'Points earned from invoice 1','2026-10-04 11:40:00'),
(2,1,2,NULL,'EARN',2,1750000.00,17.50,'Points earned from invoice 2','2026-10-17 11:40:00'),
(3,2,3,NULL,'EARN',3,5832000.00,58.32,'Points earned from invoice 3','2026-11-08 11:40:00'),
(4,3,NULL,2,'ADJUST',0,0.00,2.00,'Manual loyalty adjustment','2026-11-09 09:00:00');

INSERT INTO benefit_redemption
(redemption_id,customer_id,tier_benefit_id,booking_id,invoice_id,service_usage_id,approved_by,value_amount,note,redeemed_at)
VALUES
(1,1,4,1,1,NULL,2,562500.00,'Pearl 15 percent room discount','2026-10-04 11:45:00'),
(2,1,5,2,2,NULL,2,1250000.00,'Pearl free night','2026-10-17 11:45:00'),
(3,2,3,3,3,1,2,120000.00,'Coral annual laundry allowance','2026-11-08 11:45:00');

-- Insert audit_log values as standard text / formatted JSON strings
INSERT INTO audit_log
(log_id,account_id,module_name,action_type,target_table,target_id,old_value,new_value,ip_address,logged_at)
VALUES
(1,3,'BOOKING','CREATE','booking',4,NULL,'{"booking_code":"BK-2026-0004","status":"CONFIRMED"}','127.0.0.1','2026-11-01 12:01:00'),
(2,2,'MAINTENANCE','CONFIRM','maintenance_request',1,'{"status":"DONE"}','{"status":"CONFIRMED"}','127.0.0.1','2026-11-08 11:31:00');

COMMIT;

-- ---------------------------------------------------------------------
-- 8. Quick Verification Queries
-- ---------------------------------------------------------------------
SELECT 'accounts' AS table_name, COUNT(*) AS rows_count FROM account
UNION ALL SELECT 'work_schedules', COUNT(*) FROM work_schedule
UNION ALL SELECT 'roomcleaning_requests', COUNT(*) FROM roomcleaning_request
UNION ALL SELECT 'maintenance_requests', COUNT(*) FROM maintenance_request
UNION ALL SELECT 'service_requests', COUNT(*) FROM service_request
UNION ALL SELECT 'audit_logs', COUNT(*) FROM audit_log;