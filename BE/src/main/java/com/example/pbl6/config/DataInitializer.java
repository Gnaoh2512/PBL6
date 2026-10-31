package com.example.pbl6.config;

import com.example.pbl6.entity.*;
import com.example.pbl6.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final RoleRepository roleRepository;
    private final AccountRepository accountRepository;
    private final CustomerRepository customerRepository;
    private final LoyaltyTierRepository loyaltyTierRepository;
    private final BookingRepository bookingRepository;
    private final BookingRoomRepository bookingRoomRepository;
    private final RoomTypeRepository roomTypeRepository;
    private final RoomRepository roomRepository;
    private final ServiceCategoryRepository serviceCategoryRepository;
    private final ServiceRepository serviceRepository;
    private final ShiftRepository shiftRepository;
    private final VoucherRepository voucherRepository;
    private final AuditLogRepository auditLogRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        initRoles();
        ensureLoyaltyTiers();
        mergeLegacyCashierRole();
        if (accountRepository.count() == 0) {
            log.info("Bắt đầu khởi tạo dữ liệu mẫu cho hệ thống...");
            initAccounts();
            initCustomers();
            initRoomTypesAndRooms();
            initServices();
            initShifts();
            initVouchers();
            log.info("Khởi tạo dữ liệu mẫu hoàn tất!");
        } else {
            initVouchers();
        }
        repairSampleAccountRoles();
        ensureDemoStaffAccounts();
        ensureCustomerServiceDemoBooking();
        ensureInitialAuditLogs();
    }

    private void initRoles() {
        List<Role> roles = List.of(
                Role.builder().roleCode("ROLE_ADMIN").roleName("Quản trị viên hệ thống").description("Toàn quyền hệ thống").build(),
                Role.builder().roleCode("ROLE_MANAGER").roleName("Quản lý khách sạn").description("Quản lý vận hành").build(),
                Role.builder().roleCode("ROLE_RECEPTIONIST").roleName("Nhân viên lễ tân").description("Tiếp tân và đặt phòng").build(),
                Role.builder().roleCode("ROLE_HOUSEKEEPING").roleName("Nhân viên buồng phòng").description("Dọn phòng và kiểm tra phòng").build(),
                Role.builder().roleCode("ROLE_MAINTENANCE").roleName("Nhân viên bảo trì").description("Sửa chữa cơ sở vật chất").build(),
                Role.builder().roleCode("ROLE_SERVICE_STAFF").roleName("Nhân viên dịch vụ").description("Phục vụ đồ ăn và dịch vụ buồng").build(),
                Role.builder().roleCode("ROLE_CUSTOMER").roleName("Khách hàng").description("Tài khoản khách hàng trực tuyến").build()
        );
        List<Role> missingRoles = roles.stream()
                .filter(role -> roleRepository.findByRoleCode(role.getRoleCode()).isEmpty())
                .toList();
        if (!missingRoles.isEmpty()) {
            roleRepository.saveAll(missingRoles);
            log.info("Đã khởi tạo {} vai trò hệ thống còn thiếu (RBAC)", missingRoles.size());
        }
    }

    private void ensureLoyaltyTiers() {
        List<LoyaltyTier> tiers = List.of(
                LoyaltyTier.builder().tierCode("SEASHELL").tierName("Hạng Sò Biển (Seashell)").tierLevel(1).minScore(BigDecimal.ZERO).description("Hạng khởi đầu cho khách hàng đăng ký mới.").build(),
                LoyaltyTier.builder().tierCode("STARFISH").tierName("Hạng Sao Biển (Starfish)").tierLevel(2).minScore(BigDecimal.TEN).description("Đạt từ 10 điểm tích lũy.").build(),
                LoyaltyTier.builder().tierCode("CORAL").tierName("Hạng San Hô (Coral)").tierLevel(3).minScore(BigDecimal.valueOf(30)).description("Đạt từ 30 điểm tích lũy.").build(),
                LoyaltyTier.builder().tierCode("PEARL").tierName("Hạng Ngọc Trai (Pearl)").tierLevel(4).minScore(BigDecimal.valueOf(80)).description("Đạt từ 80 điểm tích lũy.").build()
        );
        List<LoyaltyTier> missing = tiers.stream()
                .filter(tier -> loyaltyTierRepository.findByTierCode(tier.getTierCode()).isEmpty())
                .toList();
        if (!missing.isEmpty()) loyaltyTierRepository.saveAll(missing);
    }

    /** Move accounts from the retired cashier role to the unified receptionist role. */
    private void mergeLegacyCashierRole() {
        Role receptionistRole = roleRepository.findByRoleCode("ROLE_RECEPTIONIST").orElse(null);
        Role cashierRole = roleRepository.findByRoleCode("ROLE_CASHIER").orElse(null);
        if (receptionistRole == null) return;

        List<Account> legacyCashiers = accountRepository.findAll().stream()
                .filter(account -> (account.getRole() != null
                        && "ROLE_CASHIER".equalsIgnoreCase(account.getRole().getRoleCode()))
                        || "cashier".equalsIgnoreCase(account.getUsername()))
                .toList();
        legacyCashiers.forEach(account -> {
            if (account.getRole() != null && "ROLE_CASHIER".equalsIgnoreCase(account.getRole().getRoleCode())) {
                account.setRole(receptionistRole);
            }
            if ("cashier".equalsIgnoreCase(account.getUsername())) account.setStatus("INACTIVE");
        });
        accountRepository.saveAll(legacyCashiers);
        if (cashierRole != null) roleRepository.delete(cashierRole);
        if (!legacyCashiers.isEmpty()) log.info("Retired legacy cashier role and demo account");
    }

    /** Restores role links for the built-in demo accounts from older databases. */
    private void repairSampleAccountRoles() {
        List<String[]> sampleRoles = List.of(
                new String[]{"admin", "ROLE_ADMIN"},
                new String[]{"manager", "ROLE_MANAGER"},
                new String[]{"receptionist", "ROLE_RECEPTIONIST"},
                new String[]{"housekeeper", "ROLE_HOUSEKEEPING"},
                new String[]{"technician", "ROLE_MAINTENANCE"},
                new String[]{"servicestaff", "ROLE_SERVICE_STAFF"},
                new String[]{"customer1", "ROLE_CUSTOMER"}
        );
        for (String[] sampleRole : sampleRoles) {
            accountRepository.findByUsername(sampleRole[0]).ifPresent(account -> {
                if (account.getRole() != null && sampleRole[1].equalsIgnoreCase(account.getRole().getRoleCode())) return;
                roleRepository.findByRoleCode(sampleRole[1]).ifPresent(role -> {
                    account.setRole(role);
                    accountRepository.save(account);
                    log.info("Restored missing role {} for sample account {}", sampleRole[1], sampleRole[0]);
                });
            });
        }
    }

    /** Ensures staff demo logins exist even when the database was initialized before these roles were added. */
    private void ensureDemoStaffAccounts() {
        String passwordHash = passwordEncoder.encode("123456");
        ensureDemoStaffAccount("technician", "Nhân viên kỹ thuật bảo trì", "tech@hotel.com", "0900000006", "ROLE_MAINTENANCE", passwordHash);
        ensureDemoStaffAccount("servicestaff", "Nhân viên phục vụ dịch vụ", "service@hotel.com", "0900000007", "ROLE_SERVICE_STAFF", passwordHash);
    }

    private void ensureDemoStaffAccount(String username, String fullName, String email, String phone, String roleCode, String passwordHash) {
        roleRepository.findByRoleCode(roleCode).ifPresent(role -> {
            Account account = accountRepository.findByUsername(username).orElseGet(() -> Account.builder()
                    .username(username)
                    .build());
            account.setPasswordHash(passwordHash);
            account.setFullName(fullName);
            account.setEmail(email);
            account.setPhone(phone);
            account.setRole(role);
            account.setStatus("ACTIVE");
            accountRepository.save(account);
        });
    }

    /** Creates one checked-in customer booking so the guest service-order flow has a test stay. */
    private void ensureCustomerServiceDemoBooking() {
        if (bookingRepository.existsByBookingCode("BK-CUSTOMER1-DEMO")) return;

        Account customerAccount = accountRepository.findByUsername("customer1").orElse(null);
        if (customerAccount == null) return;
        Customer customer = customerRepository.findByAccount_Username("customer1")
                .orElseGet(() -> customerRepository.findByEmail(customerAccount.getEmail()).orElse(null));
        Room room = roomRepository.findFirstByStatusIgnoreCaseOrderByRoomNumberAsc("AVAILABLE").orElse(null);
        if (customer == null || room == null) return;

        LocalDate checkIn = LocalDate.now().minusDays(1);
        LocalDate checkOut = LocalDate.now().plusDays(2);
        Booking booking = bookingRepository.save(Booking.builder()
                .bookingCode("BK-CUSTOMER1-DEMO")
                .customer(customer)
                .createdBy(customerAccount)
                .checkInDate(checkIn)
                .checkOutDate(checkOut)
                .guestCount(2)
                .status("CHECKED_IN")
                .depositRequired(BigDecimal.ZERO)
                .source("DEMO")
                .note("Demo stay for testing guest service orders")
                .build());

        BigDecimal nightlyRate = room.getRoomType() != null && room.getRoomType().getBasePrice() != null
                ? room.getRoomType().getBasePrice() : BigDecimal.ZERO;
        bookingRoomRepository.save(BookingRoom.builder()
                .booking(booking)
                .room(room)
                .plannedCheckin(checkIn)
                .plannedCheckout(checkOut)
                .actualCheckin(java.time.LocalDateTime.now())
                .status("CHECKED_IN")
                .priceApplied(nightlyRate)
                .build());
        room.setStatus("OCCUPIED");
        roomRepository.save(room);
        log.info("Created demo in-house booking {} for customer1 in room {}", booking.getBookingCode(), room.getRoomNumber());
    }

    private void initAccounts() {
        String defaultPasswordHash = passwordEncoder.encode("123456");

        Role adminRole = roleRepository.findByRoleCode("ROLE_ADMIN").orElse(null);
        Role managerRole = roleRepository.findByRoleCode("ROLE_MANAGER").orElse(null);
        Role receptionistRole = roleRepository.findByRoleCode("ROLE_RECEPTIONIST").orElse(null);
        Role housekeeperRole = roleRepository.findByRoleCode("ROLE_HOUSEKEEPING").orElse(null);
        Role customerRole = roleRepository.findByRoleCode("ROLE_CUSTOMER").orElse(null);

        List<Account> accounts = List.of(
                Account.builder()
                        .username("admin")
                        .passwordHash(defaultPasswordHash)
                        .fullName("Quản trị viên Hệ thống")
                        .email("admin@hotel.com")
                        .phone("0900000001")
                        .role(adminRole)
                        .status("ACTIVE")
                        .build(),
                Account.builder()
                        .username("manager")
                        .passwordHash(defaultPasswordHash)
                        .fullName("Nguyễn Văn Quản Lý")
                        .email("manager@hotel.com")
                        .phone("0900000002")
                        .role(managerRole)
                        .status("ACTIVE")
                        .build(),
                Account.builder()
                        .username("receptionist")
                        .passwordHash(defaultPasswordHash)
                        .fullName("Trần Thị Lễ Tân")
                        .email("receptionist@hotel.com")
                        .phone("0900000003")
                        .role(receptionistRole)
                        .status("ACTIVE")
                        .build(),
                Account.builder()
                        .username("housekeeper")
                        .passwordHash(defaultPasswordHash)
                        .fullName("Phạm Thị Buồng Phòng")
                        .email("housekeeper@hotel.com")
                        .phone("0900000005")
                        .role(housekeeperRole)
                        .status("ACTIVE")
                        .build(),
                Account.builder()
                        .username("technician")
                        .passwordHash(defaultPasswordHash)
                        .fullName("Nhân viên kỹ thuật bảo trì")
                        .email("tech@hotel.com")
                        .phone("0900000006")
                        .role(roleRepository.findByRoleCode("ROLE_MAINTENANCE").orElse(null))
                        .status("ACTIVE")
                        .build(),
                Account.builder()
                        .username("servicestaff")
                        .passwordHash(defaultPasswordHash)
                        .fullName("Nhân viên phục vụ dịch vụ")
                        .email("service@hotel.com")
                        .phone("0900000007")
                        .role(roleRepository.findByRoleCode("ROLE_SERVICE_STAFF").orElse(null))
                        .status("ACTIVE")
                        .build(),
                Account.builder()
                        .username("customer1")
                        .passwordHash(defaultPasswordHash)
                        .fullName("Nguyễn Văn Khách")
                        .email("customer1@gmail.com")
                        .phone("0901234567")
                        .role(customerRole)
                        .status("ACTIVE")
                        .build()
        );

        accountRepository.saveAll(accounts);
        log.info("Đã tạo {} tài khoản mẫu (mật khẩu mặc định: 123456)", accounts.size());
    }

    private void initCustomers() {
        if (customerRepository.count() > 0) return;

        List<Customer> customers = List.of(
                Customer.builder()
                        .fullName("Nguyễn Văn Khách")
                        .idType("CCCD")
                        .idNumber("001201001234")
                        .idIssueDate(LocalDate.of(2021, 5, 15))
                        .idIssuePlace("Cục Cảnh sát QLHC về TTXH")
                        .phone("0901234567")
                        .email("customer1@gmail.com")
                        .nationality("Việt Nam")
                        .build(),
                Customer.builder()
                        .fullName("Trần Thị Lan")
                        .idType("CCCD")
                        .idNumber("048202005678")
                        .idIssueDate(LocalDate.of(2022, 8, 20))
                        .idIssuePlace("Cục Cảnh sát QLHC về TTXH")
                        .phone("0912345678")
                        .email("lan.tran@gmail.com")
                        .nationality("Việt Nam")
                        .build(),
                Customer.builder()
                        .fullName("John Smith")
                        .idType("PASSPORT")
                        .idNumber("B98765432")
                        .idIssueDate(LocalDate.of(2020, 1, 10))
                        .idIssuePlace("USA")
                        .phone("0987654321")
                        .email("john.smith@gmail.com")
                        .nationality("Hoa Kỳ")
                        .build()
        );

        customerRepository.saveAll(customers);
        log.info("Đã tạo {} hồ sơ khách hàng mẫu", customers.size());
    }

    private void initRoomTypesAndRooms() {
        if (roomTypeRepository.count() > 0) return;

        RoomType standard = RoomType.builder()
                .typeName("Phòng Standard")
                .capacity(2)
                .basePrice(BigDecimal.valueOf(500000))
                .amenities("Wifi tốc độ cao, TV màn hình phẳng, Điều hòa hai chiều, Bình nóng lạnh")
                .description("Phòng tiêu chuẩn 1 giường đôi đầy đủ tiện nghi, sạch sẽ thoáng mát")
                .build();

        RoomType deluxe = RoomType.builder()
                .typeName("Phòng Deluxe Hướng Biển")
                .capacity(2)
                .basePrice(BigDecimal.valueOf(850000))
                .amenities("Wifi, TV 4K, Điều hòa, Bồn tắm ngâm, Ban công ngắm cảnh biển, Minibar")
                .description("Phòng cao cấp view biển lãng mạn, nội thất hiện đại")
                .build();

        RoomType suite = RoomType.builder()
                .typeName("Phòng Suite Gia Đình")
                .capacity(4)
                .basePrice(BigDecimal.valueOf(1500000))
                .amenities("2 Giường King, Phòng khách riêng, Bếp mini, Bồn tắm massage, Sofa bed")
                .description("Phòng VIP không gian rộng rãi 65m2 thích hợp cho gia đình hoặc nhóm bạn")
                .build();

        roomTypeRepository.saveAll(List.of(standard, deluxe, suite));

        if (roomRepository.count() == 0) {
            List<Room> rooms = List.of(
                    Room.builder()
                            .roomNumber("101")
                            .roomType(standard)
                            .floor(1)
                            .status("AVAILABLE")
                            .note("Phòng gần thang máy")
                            .build(),
                    Room.builder()
                            .roomNumber("102")
                            .roomType(standard)
                            .floor(1)
                            .status("OCCUPIED")
                            .note("Khách đang lưu trú")
                            .build(),
                    Room.builder()
                            .roomNumber("201")
                            .roomType(deluxe)
                            .floor(2)
                            .status("AVAILABLE")
                            .note("View biển tầng cao")
                            .build(),
                    Room.builder()
                            .roomNumber("301")
                            .roomType(suite)
                            .floor(3)
                            .status("CLEANING")
                            .note("Đang dọn phòng chuẩn bị đón khách")
                            .build()
            );
            roomRepository.saveAll(rooms);
            log.info("Đã tạo {} loại phòng và {} phòng mẫu", 3, rooms.size());
        }
    }

    private void initServices() {
        if (serviceCategoryRepository.count() > 0) return;

        ServiceCategory fbCat = ServiceCategory.builder()
                .categoryName("Ẩm thực & Đồ uống (F&B)")
                .build();

        ServiceCategory laundryCat = ServiceCategory.builder()
                .categoryName("Dịch vụ phòng & Giặt ủi")
                .build();

        serviceCategoryRepository.saveAll(List.of(fbCat, laundryCat));

        if (serviceRepository.count() == 0) {
            List<Service> services = List.of(
                    Service.builder()
                            .category(fbCat)
                            .serviceName("Nước khoáng Lavie 500ml")
                            .unitPrice(BigDecimal.valueOf(15000))
                            .unit("Chai")
                            .isActive(true)
                            .build(),
                    Service.builder()
                            .category(fbCat)
                            .serviceName("Bữa sáng Buffet")
                            .unitPrice(BigDecimal.valueOf(120000))
                            .unit("Suất")
                            .isActive(true)
                            .build(),
                    Service.builder()
                            .category(laundryCat)
                            .serviceName("Giặt ủi quần áo nhanh")
                            .unitPrice(BigDecimal.valueOf(50000))
                            .unit("Kg")
                            .isActive(true)
                            .build()
            );
            serviceRepository.saveAll(services);
            log.info("Đã tạo {} danh mục dịch vụ và {} dịch vụ mẫu", 2, services.size());
        }
    }

    private void initShifts() {
        if (shiftRepository.count() > 0) return;

        List<Shift> shifts = List.of(
                Shift.builder()
                        .startTime(LocalTime.of(6, 0))
                        .endTime(LocalTime.of(14, 0))
                        .build(),
                Shift.builder()
                        .startTime(LocalTime.of(14, 0))
                        .endTime(LocalTime.of(22, 0))
                        .build(),
                Shift.builder()
                        .startTime(LocalTime.of(22, 0))
                        .endTime(LocalTime.of(6, 0))
                        .build()
        );

        shiftRepository.saveAll(shifts);
        log.info("Đã tạo {} ca làm việc mẫu (Sáng, Chiều, Đêm)", shifts.size());
    }

    private void initVouchers() {
        if (voucherRepository.count() > 0) return;

        List<com.example.pbl6.entity.Voucher> vouchers = List.of(
                com.example.pbl6.entity.Voucher.builder()
                        .code("SUMMER2026")
                        .voucherName("Ưu đãi chào hè giảm 10% tối đa 200.000đ")
                        .discountType("PERCENTAGE")
                        .discountValue(BigDecimal.valueOf(10))
                        .maxDiscountAmount(BigDecimal.valueOf(200000))
                        .minOrderAmount(BigDecimal.valueOf(500000))
                        .startDate(LocalDate.of(2026, 6, 1))
                        .endDate(LocalDate.of(2026, 12, 31))
                        .usageLimit(100)
                        .usedCount(0)
                        .isActive(true)
                        .build(),
                com.example.pbl6.entity.Voucher.builder()
                        .code("WELCOME50K")
                        .voucherName("Mã chào mừng khách mới giảm 50.000đ")
                        .discountType("FIXED_AMOUNT")
                        .discountValue(BigDecimal.valueOf(50000))
                        .minOrderAmount(BigDecimal.valueOf(300000))
                        .startDate(LocalDate.of(2026, 1, 1))
                        .endDate(LocalDate.of(2026, 12, 31))
                        .usageLimit(500)
                        .usedCount(0)
                        .isActive(true)
                        .build()
        );

        voucherRepository.saveAll(vouchers);
        log.info("Đã khởi tạo {} voucher ưu đãi mẫu (SUMMER2026, WELCOME50K)", vouchers.size());
    }

    private void ensureInitialAuditLogs() {
        Account adminUser = accountRepository.findByUsername("admin").orElse(null);
        if (adminUser != null) {
            java.util.List<AuditLog> unassignedLogs = auditLogRepository.findAll().stream()
                    .filter(l -> l.getAccount() == null)
                    .peek(l -> l.setAccount(adminUser))
                    .collect(java.util.stream.Collectors.toList());
            if (!unassignedLogs.isEmpty()) {
                auditLogRepository.saveAll(unassignedLogs);
                log.info("Đã đồng bộ {} bản ghi nhật ký hoạt động cũ sang quản trị viên (admin)", unassignedLogs.size());
            }
        }

        if (auditLogRepository.count() > 0) return;

        Account admin = accountRepository.findByUsername("admin").orElse(null);
        java.time.LocalDateTime now = java.time.LocalDateTime.now();

        List<AuditLog> initialLogs = List.of(
                AuditLog.builder()
                        .account(admin)
                        .moduleName("HỆ THỐNG")
                        .actionType("KHỞI TẠO")
                        .targetTable("system")
                        .targetId(1L)
                        .newValue("Khởi tạo hệ thống quản lý khách sạn Hotel California thành công")
                        .ipAddress("127.0.0.1")
                        .loggedAt(now.minusHours(48))
                        .build(),
                AuditLog.builder()
                        .account(admin)
                        .moduleName("PHÂN QUYỀN")
                        .actionType("CẤU HÌNH")
                        .targetTable("role")
                        .targetId(7L)
                        .newValue("Đồng bộ 7 vai trò chuẩn hóa hệ thống (ADMIN, MANAGER, RECEPTIONIST, HOUSEKEEPING...)")
                        .ipAddress("127.0.0.1")
                        .loggedAt(now.minusHours(36))
                        .build(),
                AuditLog.builder()
                        .account(admin)
                        .moduleName("PHÒNG NGHỈ")
                        .actionType("CẤU HÌNH")
                        .targetTable("room_type")
                        .targetId(10L)
                        .newValue("Cấu hình danh mục loại phòng nghỉ và định giá tiêu chuẩn")
                        .ipAddress("127.0.0.1")
                        .loggedAt(now.minusHours(24))
                        .build(),
                AuditLog.builder()
                        .account(admin)
                        .moduleName("MARKETING")
                        .actionType("TẠO MỚI")
                        .targetTable("voucher")
                        .targetId(1L)
                        .newValue("Tạo chiến dịch ưu đãi chào hè SUMMER2026 (Giảm 10% tối đa 200.000đ)")
                        .ipAddress("127.0.0.1")
                        .loggedAt(now.minusHours(12))
                        .build(),
                AuditLog.builder()
                        .account(admin)
                        .moduleName("THÀNH VIÊN")
                        .actionType("CẤU HÌNH")
                        .targetTable("loyalty_tier")
                        .targetId(4L)
                        .newValue("Thiết lập 4 hạng hội viên Coastal Bay Club (Seashell, Starfish, Coral, Ocean Pearl)")
                        .ipAddress("127.0.0.1")
                        .loggedAt(now.minusHours(6))
                        .build(),
                AuditLog.builder()
                        .account(admin)
                        .moduleName("BẢO MẬT")
                        .actionType("ĐĂNG NHẬP")
                        .targetTable("account")
                        .targetId(1L)
                        .newValue("Quản trị viên (admin) đăng nhập hệ thống thành công")
                        .ipAddress("127.0.0.1")
                        .loggedAt(now.minusMinutes(30))
                        .build()
        );

        auditLogRepository.saveAll(initialLogs);
        log.info("Đã khởi tạo {} bản ghi nhật ký hoạt động mẫu (Audit Logs)", initialLogs.size());
    }
}
