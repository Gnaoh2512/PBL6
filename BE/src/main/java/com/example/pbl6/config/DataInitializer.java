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

    private final AccountRepository accountRepository;
    private final CustomerRepository customerRepository;
    private final RoomTypeRepository roomTypeRepository;
    private final RoomRepository roomRepository;
    private final ServiceCategoryRepository serviceCategoryRepository;
    private final ServiceRepository serviceRepository;
    private final ShiftRepository shiftRepository;
    private final VoucherRepository voucherRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
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
    }

    private void initAccounts() {
        String defaultPasswordHash = passwordEncoder.encode("123456");

        List<Account> accounts = List.of(
                Account.builder()
                        .username("admin")
                        .passwordHash(defaultPasswordHash)
                        .fullName("Quản trị viên Hệ thống")
                        .email("admin@hotel.com")
                        .phone("0900000001")
                        .role("ADMIN")
                        .status("ACTIVE")
                        .build(),
                Account.builder()
                        .username("manager")
                        .passwordHash(defaultPasswordHash)
                        .fullName("Nguyễn Văn Quản Lý")
                        .email("manager@hotel.com")
                        .phone("0900000002")
                        .role("MANAGER")
                        .status("ACTIVE")
                        .build(),
                Account.builder()
                        .username("receptionist")
                        .passwordHash(defaultPasswordHash)
                        .fullName("Trần Thị Lễ Tân")
                        .email("receptionist@hotel.com")
                        .phone("0900000003")
                        .role("RECEPTIONIST")
                        .status("ACTIVE")
                        .build(),
                Account.builder()
                        .username("cashier")
                        .passwordHash(defaultPasswordHash)
                        .fullName("Lê Văn Thu Ngân")
                        .email("cashier@hotel.com")
                        .phone("0900000004")
                        .role("CASHIER")
                        .status("ACTIVE")
                        .build(),
                Account.builder()
                        .username("housekeeper")
                        .passwordHash(defaultPasswordHash)
                        .fullName("Phạm Thị Buồng Phòng")
                        .email("housekeeper@hotel.com")
                        .phone("0900000005")
                        .role("HOUSEKEEPING")
                        .status("ACTIVE")
                        .build(),
                Account.builder()
                        .username("customer1")
                        .passwordHash(defaultPasswordHash)
                        .fullName("Nguyễn Văn Khách")
                        .email("customer1@gmail.com")
                        .phone("0901234567")
                        .role("CUSTOMER")
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
}
