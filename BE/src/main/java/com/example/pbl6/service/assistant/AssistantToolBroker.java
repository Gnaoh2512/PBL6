package com.example.pbl6.service.assistant;

import com.example.pbl6.dto.history.CustomerBookingHistoryDetailResponse;
import com.example.pbl6.dto.history.CustomerBookingHistorySummaryResponse;
import com.example.pbl6.dto.room.AvailableRoomResponse;
import com.example.pbl6.dto.room.RoomSearchRequest;
import com.example.pbl6.dto.room.RoomTypeResponse;
import com.example.pbl6.dto.service.ServiceResponse;
import com.example.pbl6.exception.ResourceNotFoundException;
import com.example.pbl6.service.CustomerBillingService;
import com.example.pbl6.service.CustomerHistoryService;
import com.example.pbl6.service.RoomCatalogService;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.regex.Pattern;

/**
 * In-process broker for D2 public read-only business tools and D3 principal-bound booking tools.
 * Enforces allowlist, strict principal ownership (never trusts model/client identity),
 * strict argument schema, null-price rejection, PII/field stripping, deterministic ordering,
 * and authoritative Turn Ledger card assembly.
 */
@Component
public class AssistantToolBroker {
    public static final ZoneId HOTEL_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    public static final Set<String> BOOKING_TOOLS = Set.of("list_my_bookings", "get_my_booking");
    public static final Set<String> SUPPORTED_BUSINESS_TOOLS = Set.of(
            "search_rooms", "list_services", "list_my_bookings", "get_my_booking"
    );

    private static final int DEFAULT_LIMIT = 5;
    private static final int MAX_LIMIT = 10;
    private static final int MAX_TEXT_LENGTH = 2000;
    private static final Pattern ISO_DATE = Pattern.compile("^[0-9]{4}-[0-9]{2}-[0-9]{2}$");
    private static final Pattern MONEY = Pattern.compile("^(0|[1-9][0-9]*)(\\.[0-9]{1,2})?$");
    private static final Pattern BOOKING_CODE = Pattern.compile("^[A-Za-z0-9-]{1,50}$");
    private static final Set<String> SEARCH_ROOMS_FIELDS = Set.of(
            "checkInDate", "checkOutDate", "guestCount", "roomTypeId", "minPrice", "maxPrice", "sortBy", "limit"
    );
    private static final Set<String> LIST_SERVICES_FIELDS = Set.of("categoryId", "limit");
    private static final Set<String> LIST_MY_BOOKINGS_FIELDS = Set.of("status", "limit");
    private static final Set<String> GET_MY_BOOKING_FIELDS = Set.of("bookingCode", "includeFinancials");
    private static final Set<String> VALID_BOOKING_STATUSES = Set.of(
            "PENDING_DEPOSIT", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELED", "EXPIRED"
    );

    private final RoomCatalogService roomCatalogService;
    private final CustomerBillingService customerBillingService;
    private final CustomerHistoryService customerHistoryService;
    private final Clock clock;

    @Autowired
    public AssistantToolBroker(
            RoomCatalogService roomCatalogService,
            CustomerBillingService customerBillingService,
            CustomerHistoryService customerHistoryService
    ) {
        this(roomCatalogService, customerBillingService, customerHistoryService, Clock.system(HOTEL_ZONE));
    }

    AssistantToolBroker(
            RoomCatalogService roomCatalogService,
            CustomerBillingService customerBillingService,
            Clock clock
    ) {
        this(roomCatalogService, customerBillingService, null, clock);
    }

    AssistantToolBroker(
            RoomCatalogService roomCatalogService,
            CustomerBillingService customerBillingService,
            CustomerHistoryService customerHistoryService,
            Clock clock
    ) {
        this.roomCatalogService = roomCatalogService;
        this.customerBillingService = customerBillingService;
        this.customerHistoryService = customerHistoryService;
        this.clock = clock;
    }

    public record Execution(
            Map<String, Object> toolResult,
            String retrievedAt,
            List<Map<String, Object>> cards,
            Map<String, Object> sanitizedQuery,
            boolean hasMore
    ) {
        public boolean isOk() {
            return "ok".equals(toolResult.get("status"));
        }

        public String errorCode() {
            Object err = toolResult.get("error");
            if (err instanceof Map<?, ?> map && map.get("code") instanceof String code) {
                return code;
            }
            return null;
        }
    }

    public Execution execute(String callId, String toolName, JsonNode arguments, Set<String> allowedTools) {
        return execute(callId, toolName, arguments, allowedTools, null, false);
    }

    public Execution execute(
            String callId,
            String toolName,
            JsonNode arguments,
            Set<String> allowedTools,
            String authenticatedUsername,
            boolean isCustomer
    ) {
        if (callId == null || toolName == null
                || !SUPPORTED_BUSINESS_TOOLS.contains(toolName)
                || allowedTools == null || !allowedTools.contains(toolName)) {
            throw new AssistantFault(502, "AI_PROTOCOL_ERROR");
        }
        String retrievedAt = OffsetDateTime.now(clock)
                .withOffsetSameInstant(HOTEL_ZONE.getRules().getOffset(clock.instant()))
                .truncatedTo(ChronoUnit.SECONDS)
                .format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
        if (arguments == null || !arguments.isObject()) {
            return errorExecution(callId, toolName, retrievedAt, "VALIDATION_ERROR",
                    "Tham số công cụ không hợp lệ.");
        }
        return switch (toolName) {
            case "search_rooms" -> executeSearchRooms(callId, arguments, retrievedAt);
            case "list_services" -> executeListServices(callId, arguments, retrievedAt);
            case "list_my_bookings" -> executeListMyBookings(callId, arguments, retrievedAt, authenticatedUsername, isCustomer);
            case "get_my_booking" -> executeGetMyBooking(callId, arguments, retrievedAt, authenticatedUsername, isCustomer);
            default -> throw new AssistantFault(502, "AI_PROTOCOL_ERROR");
        };
    }

    private Execution executeSearchRooms(String callId, JsonNode args, String retrievedAt) {
        if (!hasOnlyAllowedKeys(args, SEARCH_ROOMS_FIELDS)) {
            return errorExecution(callId, "search_rooms", retrievedAt, "VALIDATION_ERROR",
                    "Yêu cầu tìm phòng chứa tham số không được hỗ trợ.");
        }
        LocalDate today = LocalDate.now(clock.withZone(HOTEL_ZONE));
        LocalDate checkIn = parseRequiredDate(args.get("checkInDate"));
        LocalDate checkOut = parseRequiredDate(args.get("checkOutDate"));
        Integer guestCount = parseRequiredPositiveInt(args.get("guestCount"));
        if (checkIn == null || checkOut == null || guestCount == null) {
            return errorExecution(callId, "search_rooms", retrievedAt, "VALIDATION_ERROR",
                    "Cần ngày nhận phòng, ngày trả phòng (YYYY-MM-DD) và số khách lớn hơn 0.");
        }
        if (checkIn.isBefore(today)) {
            return errorExecution(callId, "search_rooms", retrievedAt, "VALIDATION_ERROR",
                    "Ngày nhận phòng phải từ ngày hôm nay trở đi.");
        }
        if (!checkOut.isAfter(checkIn)) {
            return errorExecution(callId, "search_rooms", retrievedAt, "VALIDATION_ERROR",
                    "Ngày trả phòng phải sau ngày nhận phòng.");
        }

        OptionalInt roomTypeIdOpt = parseOptionalPositiveInt(args.get("roomTypeId"));
        if (roomTypeIdOpt == null) {
            return errorExecution(callId, "search_rooms", retrievedAt, "VALIDATION_ERROR",
                    "Mã hạng phòng không hợp lệ.");
        }
        Optional<BigDecimal> minPriceOpt = parseOptionalMoney(args.get("minPrice"));
        Optional<BigDecimal> maxPriceOpt = parseOptionalMoney(args.get("maxPrice"));
        if (minPriceOpt == null || maxPriceOpt == null) {
            return errorExecution(callId, "search_rooms", retrievedAt, "VALIDATION_ERROR",
                    "Khoảng giá tìm phòng không hợp lệ.");
        }
        if (minPriceOpt.isPresent() && maxPriceOpt.isPresent()
                && minPriceOpt.get().compareTo(maxPriceOpt.get()) > 0) {
            return errorExecution(callId, "search_rooms", retrievedAt, "VALIDATION_ERROR",
                    "Giá tối thiểu không được lớn hơn giá tối đa.");
        }
        String sortBy = parseSortBy(args.get("sortBy"));
        if (sortBy == null) {
            return errorExecution(callId, "search_rooms", retrievedAt, "VALIDATION_ERROR",
                    "Kiểu sắp xếp không hợp lệ.");
        }
        Integer limit = parseLimit(args.get("limit"));
        if (limit == null) {
            return errorExecution(callId, "search_rooms", retrievedAt, "VALIDATION_ERROR",
                    "Giới hạn kết quả phải từ 1 đến 10.");
        }

        RoomSearchRequest request = RoomSearchRequest.builder()
                .checkInDate(checkIn)
                .checkOutDate(checkOut)
                .roomTypeId(roomTypeIdOpt.isPresent() ? roomTypeIdOpt.getAsInt() : null)
                .guestCount(guestCount)
                .minPrice(minPriceOpt.orElse(null))
                .maxPrice(maxPriceOpt.orElse(null))
                .sortBy(sortBy)
                .build();

        List<AvailableRoomResponse> rawRooms;
        try {
            rawRooms = roomCatalogService.findAvailableRooms(request);
        } catch (IllegalArgumentException ex) {
            return errorExecution(callId, "search_rooms", retrievedAt, "VALIDATION_ERROR",
                    "Điều kiện tìm phòng không hợp lệ.");
        } catch (RuntimeException ex) {
            return errorExecution(callId, "search_rooms", retrievedAt, "DEPENDENCY_UNAVAILABLE",
                    "Không thể tra cứu danh sách phòng trống lúc này.");
        }

        if (rawRooms == null) {
            return errorExecution(callId, "search_rooms", retrievedAt, "DATA_UNAVAILABLE",
                    "Không có dữ liệu phòng hợp lệ từ hệ thống.");
        }

        for (AvailableRoomResponse room : rawRooms) {
            if (!isValidRoomRecord(room)) {
                return errorExecution(callId, "search_rooms", retrievedAt, "DATA_UNAVAILABLE",
                        "Thiếu dữ liệu giá phòng hợp lệ từ hệ thống.");
            }
        }

        Comparator<AvailableRoomResponse> comparator = Comparator
                .comparing((AvailableRoomResponse r) -> r.getRoomType().getBasePrice())
                .thenComparing(AvailableRoomResponse::getRoomId);
        if ("PRICE_DESC".equals(sortBy)) {
            comparator = Comparator
                    .comparing((AvailableRoomResponse r) -> r.getRoomType().getBasePrice(), Comparator.reverseOrder())
                    .thenComparing(AvailableRoomResponse::getRoomId);
        }

        List<AvailableRoomResponse> sorted = rawRooms.stream().sorted(comparator).toList();
        boolean hasMore = sorted.size() > limit;
        List<AvailableRoomResponse> page = sorted.subList(0, Math.min(limit, sorted.size()));

        List<Map<String, Object>> items = new ArrayList<>(page.size());
        List<Map<String, Object>> cards = new ArrayList<>(page.size());
        for (AvailableRoomResponse room : page) {
            Map<String, Object> item = toRoomItem(room);
            if (item == null) {
                return errorExecution(callId, "search_rooms", retrievedAt, "DATA_UNAVAILABLE",
                        "Thiếu dữ liệu giá phòng hợp lệ từ hệ thống.");
            }
            items.add(item);
            Map<String, Object> card = new LinkedHashMap<>();
            card.put("type", "room");
            card.put("data", item);
            card.put("retrievedAt", retrievedAt);
            cards.add(Collections.unmodifiableMap(card));
        }

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("items", Collections.unmodifiableList(items));
        data.put("hasMore", hasMore);

        Map<String, Object> query = new LinkedHashMap<>();
        query.put("checkInDate", checkIn.toString());
        query.put("checkOutDate", checkOut.toString());
        query.put("guestCount", guestCount);
        if (roomTypeIdOpt.isPresent()) {
            query.put("roomTypeId", roomTypeIdOpt.getAsInt());
        }

        return okExecution(callId, "search_rooms", retrievedAt, data, cards, query, hasMore);
    }

    private Execution executeListServices(String callId, JsonNode args, String retrievedAt) {
        if (!hasOnlyAllowedKeys(args, LIST_SERVICES_FIELDS)) {
            return errorExecution(callId, "list_services", retrievedAt, "VALIDATION_ERROR",
                    "Yêu cầu danh sách dịch vụ chứa tham số không được hỗ trợ.");
        }
        OptionalInt categoryIdOpt = parseOptionalPositiveInt(args.get("categoryId"));
        if (categoryIdOpt == null) {
            return errorExecution(callId, "list_services", retrievedAt, "VALIDATION_ERROR",
                    "Mã danh mục dịch vụ không hợp lệ.");
        }
        Integer limit = parseLimit(args.get("limit"));
        if (limit == null) {
            return errorExecution(callId, "list_services", retrievedAt, "VALIDATION_ERROR",
                    "Giới hạn kết quả phải từ 1 đến 10.");
        }

        List<ServiceResponse> rawServices;
        try {
            rawServices = customerBillingService.getActiveServices(
                    categoryIdOpt.isPresent() ? categoryIdOpt.getAsInt() : null
            );
        } catch (IllegalArgumentException ex) {
            return errorExecution(callId, "list_services", retrievedAt, "VALIDATION_ERROR",
                    "Tham số tra cứu dịch vụ không hợp lệ.");
        } catch (RuntimeException ex) {
            return errorExecution(callId, "list_services", retrievedAt, "DEPENDENCY_UNAVAILABLE",
                    "Không thể tra cứu danh sách dịch vụ lúc này.");
        }

        if (rawServices == null) {
            return errorExecution(callId, "list_services", retrievedAt, "DATA_UNAVAILABLE",
                    "Không có dữ liệu dịch vụ hợp lệ từ hệ thống.");
        }

        List<ServiceResponse> active = rawServices.stream()
                .filter(Objects::nonNull)
                .filter(s -> Boolean.TRUE.equals(s.getIsActive()))
                .toList();

        for (ServiceResponse service : active) {
            if (!isValidServiceRecord(service)) {
                return errorExecution(callId, "list_services", retrievedAt, "DATA_UNAVAILABLE",
                        "Thiếu dữ liệu giá dịch vụ hợp lệ từ hệ thống.");
            }
        }

        List<ServiceResponse> sorted = active.stream()
                .sorted(Comparator.comparing(ServiceResponse::getServiceId))
                .toList();
        boolean hasMore = sorted.size() > limit;
        List<ServiceResponse> page = sorted.subList(0, Math.min(limit, sorted.size()));

        List<Map<String, Object>> items = new ArrayList<>(page.size());
        List<Map<String, Object>> cards = new ArrayList<>(page.size());
        for (ServiceResponse service : page) {
            Map<String, Object> item = toServiceItem(service);
            if (item == null) {
                return errorExecution(callId, "list_services", retrievedAt, "DATA_UNAVAILABLE",
                        "Thiếu dữ liệu giá dịch vụ hợp lệ từ hệ thống.");
            }
            items.add(item);
            Map<String, Object> card = new LinkedHashMap<>();
            card.put("type", "service");
            card.put("data", item);
            card.put("retrievedAt", retrievedAt);
            cards.add(Collections.unmodifiableMap(card));
        }

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("items", Collections.unmodifiableList(items));
        data.put("hasMore", hasMore);

        Map<String, Object> query = new LinkedHashMap<>();
        if (categoryIdOpt.isPresent()) {
            query.put("categoryId", categoryIdOpt.getAsInt());
        }

        return okExecution(callId, "list_services", retrievedAt, data, cards, query, hasMore);
    }

    private Execution executeListMyBookings(
            String callId,
            JsonNode args,
            String retrievedAt,
            String authenticatedUsername,
            boolean isCustomer
    ) {
        if (isBlank(authenticatedUsername)) {
            return errorExecution(callId, "list_my_bookings", retrievedAt, "AUTH_REQUIRED",
                    "Vui lòng đăng nhập tài khoản khách hàng để xem đơn đặt phòng của bạn.");
        }
        if (!isCustomer) {
            return errorExecution(callId, "list_my_bookings", retrievedAt, "FORBIDDEN",
                    "Chức năng xem đơn đặt phòng cá nhân chỉ áp dụng cho tài khoản khách hàng.");
        }
        if (customerHistoryService == null) {
            return errorExecution(callId, "list_my_bookings", retrievedAt, "CAPABILITY_UNAVAILABLE",
                    "Chức năng tra cứu đơn đặt phòng chưa sẵn sàng.");
        }
        if (!hasOnlyAllowedKeys(args, LIST_MY_BOOKINGS_FIELDS)) {
            return errorExecution(callId, "list_my_bookings", retrievedAt, "VALIDATION_ERROR",
                    "Yêu cầu danh sách đơn đặt phòng chứa tham số không được hỗ trợ.");
        }
        String statusFilter = null;
        JsonNode statusNode = args.get("status");
        if (statusNode != null && !statusNode.isNull()) {
            if (!statusNode.isTextual()) {
                return errorExecution(callId, "list_my_bookings", retrievedAt, "VALIDATION_ERROR",
                        "Trạng thái đơn đặt phòng không hợp lệ.");
            }
            String candidate = statusNode.asText().trim().toUpperCase(Locale.ROOT);
            if (!VALID_BOOKING_STATUSES.contains(candidate)) {
                return errorExecution(callId, "list_my_bookings", retrievedAt, "VALIDATION_ERROR",
                        "Trạng thái đơn đặt phòng không hợp lệ.");
            }
            statusFilter = candidate;
        }
        Integer limit = parseLimit(args.get("limit"));
        if (limit == null) {
            return errorExecution(callId, "list_my_bookings", retrievedAt, "VALIDATION_ERROR",
                    "Giới hạn kết quả phải từ 1 đến 10.");
        }

        List<CustomerBookingHistorySummaryResponse> rawBookings;
        try {
            rawBookings = customerHistoryService.getMemberHistory(authenticatedUsername, statusFilter);
        } catch (ResourceNotFoundException ex) {
            return errorExecution(callId, "list_my_bookings", retrievedAt, "AUTH_REQUIRED",
                    "Không xác thực được tài khoản khách hàng hiện tại.");
        } catch (RuntimeException ex) {
            return errorExecution(callId, "list_my_bookings", retrievedAt, "DEPENDENCY_UNAVAILABLE",
                    "Không thể tra cứu danh sách đơn đặt phòng lúc này.");
        }

        if (rawBookings == null) {
            return errorExecution(callId, "list_my_bookings", retrievedAt, "DATA_UNAVAILABLE",
                    "Không có dữ liệu đơn đặt phòng hợp lệ từ hệ thống.");
        }

        for (CustomerBookingHistorySummaryResponse b : rawBookings) {
            if (!isValidBookingSummary(b)) {
                return errorExecution(callId, "list_my_bookings", retrievedAt, "DATA_UNAVAILABLE",
                        "Dữ liệu đơn đặt phòng không đầy đủ.");
            }
        }

        Comparator<CustomerBookingHistorySummaryResponse> comparator = Comparator
                .comparing(CustomerBookingHistorySummaryResponse::getCreatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(CustomerBookingHistorySummaryResponse::getBookingCode);

        List<CustomerBookingHistorySummaryResponse> sorted = rawBookings.stream().sorted(comparator).toList();
        boolean hasMore = sorted.size() > limit;
        List<CustomerBookingHistorySummaryResponse> page = sorted.subList(0, Math.min(limit, sorted.size()));

        List<Map<String, Object>> items = new ArrayList<>(page.size());
        List<Map<String, Object>> cards = new ArrayList<>(page.size());
        for (CustomerBookingHistorySummaryResponse b : page) {
            Map<String, Object> item = toBookingItem(b);
            items.add(item);
            Map<String, Object> card = new LinkedHashMap<>();
            card.put("type", "booking");
            card.put("data", item);
            card.put("retrievedAt", retrievedAt);
            cards.add(Collections.unmodifiableMap(card));
        }

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("items", Collections.unmodifiableList(items));
        data.put("hasMore", hasMore);

        Map<String, Object> query = new LinkedHashMap<>();
        if (statusFilter != null) {
            query.put("status", statusFilter);
        }
        return okExecution(callId, "list_my_bookings", retrievedAt, data, cards, query, hasMore);
    }

    private Execution executeGetMyBooking(
            String callId,
            JsonNode args,
            String retrievedAt,
            String authenticatedUsername,
            boolean isCustomer
    ) {
        if (isBlank(authenticatedUsername)) {
            return errorExecution(callId, "get_my_booking", retrievedAt, "AUTH_REQUIRED",
                    "Vui lòng đăng nhập tài khoản khách hàng để xem chi tiết đơn đặt phòng.");
        }
        if (!isCustomer) {
            return errorExecution(callId, "get_my_booking", retrievedAt, "FORBIDDEN",
                    "Chức năng xem chi tiết đơn đặt phòng chỉ áp dụng cho tài khoản khách hàng.");
        }
        if (customerHistoryService == null) {
            return errorExecution(callId, "get_my_booking", retrievedAt, "CAPABILITY_UNAVAILABLE",
                    "Chức năng tra cứu đơn đặt phòng chưa sẵn sàng.");
        }
        if (!hasOnlyAllowedKeys(args, GET_MY_BOOKING_FIELDS)) {
            return errorExecution(callId, "get_my_booking", retrievedAt, "VALIDATION_ERROR",
                    "Yêu cầu chi tiết đơn đặt phòng chứa tham số không được hỗ trợ.");
        }
        JsonNode codeNode = args.get("bookingCode");
        if (codeNode == null || !codeNode.isTextual()) {
            return errorExecution(callId, "get_my_booking", retrievedAt, "VALIDATION_ERROR",
                    "Vui lòng cung cấp mã đơn đặt phòng hợp lệ.");
        }
        String bookingCode = codeNode.asText().trim();
        if (!BOOKING_CODE.matcher(bookingCode).matches()) {
            return errorExecution(callId, "get_my_booking", retrievedAt, "VALIDATION_ERROR",
                    "Định dạng mã đơn đặt phòng không hợp lệ.");
        }
        boolean includeFinancials = false;
        JsonNode finNode = args.get("includeFinancials");
        if (finNode != null && !finNode.isNull()) {
            if (!finNode.isBoolean()) {
                return errorExecution(callId, "get_my_booking", retrievedAt, "VALIDATION_ERROR",
                        "Tham số hiển thị thông tin thanh toán không hợp lệ.");
            }
            includeFinancials = finNode.booleanValue();
        }

        CustomerBookingHistoryDetailResponse detail;
        try {
            detail = customerHistoryService.getMemberBookingDetail(authenticatedUsername, bookingCode);
        } catch (ResourceNotFoundException ex) {
            // Identical NOT_FOUND whether booking does not exist or belongs to another customer.
            return errorExecution(callId, "get_my_booking", retrievedAt, "NOT_FOUND",
                    "Không tìm thấy đơn đặt phòng phù hợp trong tài khoản của bạn.");
        } catch (RuntimeException ex) {
            return errorExecution(callId, "get_my_booking", retrievedAt, "DEPENDENCY_UNAVAILABLE",
                    "Không thể tra cứu chi tiết đơn đặt phòng lúc này.");
        }

        if (!isValidBookingDetail(detail)) {
            return errorExecution(callId, "get_my_booking", retrievedAt, "DATA_UNAVAILABLE",
                    "Dữ liệu chi tiết đơn đặt phòng không đầy đủ.");
        }

        Map<String, Object> data = toBookingDetailItem(detail, includeFinancials);
        if (data == null) {
            return errorExecution(callId, "get_my_booking", retrievedAt, "DATA_UNAVAILABLE",
                    "Dữ liệu số tiền của đơn đặt phòng không hợp lệ.");
        }

        Map<String, Object> card = new LinkedHashMap<>();
        card.put("type", "booking");
        card.put("data", data);
        card.put("retrievedAt", retrievedAt);

        return okExecution(
                callId, "get_my_booking", retrievedAt, data,
                List.of(Collections.unmodifiableMap(card)),
                Map.of("bookingCode", bookingCode),
                false
        );
    }

    private static boolean isValidBookingSummary(CustomerBookingHistorySummaryResponse b) {
        if (b == null || isBlank(b.getBookingCode()) || !BOOKING_CODE.matcher(b.getBookingCode().trim()).matches()) {
            return false;
        }
        if (isBlank(b.getBookingStatus()) || !VALID_BOOKING_STATUSES.contains(b.getBookingStatus().trim().toUpperCase(Locale.ROOT))) {
            return false;
        }
        return b.getCheckInDate() != null && b.getCheckOutDate() != null
                && b.getNights() > 0 && b.getGuestCount() != null && b.getGuestCount() > 0;
    }

    private static Map<String, Object> toBookingItem(CustomerBookingHistorySummaryResponse b) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("bookingCode", b.getBookingCode().trim());
        item.put("bookingStatus", b.getBookingStatus().trim().toUpperCase(Locale.ROOT));
        item.put("roomTypeName", normalizeRoomTypeName(b.getRoomTypeName()));
        item.put("checkInDate", b.getCheckInDate().toString());
        item.put("checkOutDate", b.getCheckOutDate().toString());
        item.put("nights", b.getNights());
        item.put("guestCount", b.getGuestCount());
        return Collections.unmodifiableMap(item);
    }

    private static boolean isValidBookingDetail(CustomerBookingHistoryDetailResponse d) {
        if (d == null || isBlank(d.getBookingCode()) || !BOOKING_CODE.matcher(d.getBookingCode().trim()).matches()) {
            return false;
        }
        if (isBlank(d.getBookingStatus()) || !VALID_BOOKING_STATUSES.contains(d.getBookingStatus().trim().toUpperCase(Locale.ROOT))) {
            return false;
        }
        return d.getCheckInDate() != null && d.getCheckOutDate() != null
                && d.getNights() > 0 && d.getGuestCount() != null && d.getGuestCount() > 0;
    }

    private static Map<String, Object> toBookingDetailItem(CustomerBookingHistoryDetailResponse d, boolean includeFinancials) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("bookingCode", d.getBookingCode().trim());
        item.put("bookingStatus", d.getBookingStatus().trim().toUpperCase(Locale.ROOT));
        item.put("roomTypeName", normalizeRoomTypeName(d.getRoomTypeName()));
        item.put("checkInDate", d.getCheckInDate().toString());
        item.put("checkOutDate", d.getCheckOutDate().toString());
        item.put("nights", d.getNights());
        item.put("guestCount", d.getGuestCount());

        if (includeFinancials) {
            String depositRequired = nullableMoney(d.getDepositRequired());
            String depositPaid = nullableMoney(d.getDepositPaid());
            String totalAmount = nullableMoney(d.getTotalAmount());
            String remainingBalance = nullableMoney(d.getRemainingBalance());
            if ((d.getDepositRequired() != null && depositRequired == null)
                    || (d.getDepositPaid() != null && depositPaid == null)
                    || (d.getTotalAmount() != null && totalAmount == null)
                    || (d.getRemainingBalance() != null && remainingBalance == null)) {
                return null;
            }
            item.put("depositRequired", depositRequired);
            item.put("depositPaid", depositPaid);
            item.put("totalAmount", totalAmount);
            item.put("remainingBalance", remainingBalance);
            item.put("currency", "VND");
        }
        return Collections.unmodifiableMap(item);
    }

    private static String normalizeRoomTypeName(String raw) {
        if (isBlank(raw) || "N/A".equalsIgnoreCase(raw.trim())) return null;
        return clampText(raw);
    }

    private static String nullableMoney(BigDecimal value) {
        return value == null ? null : formatMoney(value);
    }

    private static boolean isValidRoomRecord(AvailableRoomResponse room) {
        if (room == null || room.getRoomId() == null || room.getRoomId() <= 0) return false;
        RoomTypeResponse type = room.getRoomType();
        if (type == null || type.getRoomTypeId() == null || type.getRoomTypeId() <= 0) return false;
        if (isBlank(type.getTypeName()) || type.getCapacity() == null || type.getCapacity() <= 0) return false;
        if (room.getCheckInDate() == null || room.getCheckOutDate() == null || room.getNights() <= 0) return false;
        if (type.getBasePrice() == null || type.getBasePrice().signum() < 0) return false;
        if (room.getPricePerNight() == null || room.getPricePerNight().signum() < 0) return false;
        if (room.getTotalRoomCharge() == null || room.getTotalRoomCharge().signum() < 0) return false;
        if (room.getEstimatedDeposit() == null || room.getEstimatedDeposit().signum() < 0) return false;
        return room.getDepositPercentage() >= 0 && room.getDepositPercentage() <= 100;
    }

    private static Map<String, Object> toRoomItem(AvailableRoomResponse room) {
        RoomTypeResponse type = room.getRoomType();
        String pricePerNight = formatMoney(room.getPricePerNight());
        String totalRoomCharge = formatMoney(room.getTotalRoomCharge());
        String estimatedDeposit = formatMoney(room.getEstimatedDeposit());
        if (pricePerNight == null || totalRoomCharge == null || estimatedDeposit == null) return null;

        Map<String, Object> item = new LinkedHashMap<>();
        item.put("roomId", room.getRoomId());
        item.put("roomTypeId", type.getRoomTypeId());
        item.put("typeName", clampText(type.getTypeName()));
        item.put("capacity", type.getCapacity());
        item.put("amenities", nullableText(type.getAmenities()));
        item.put("description", nullableText(type.getDescription()));
        item.put("checkInDate", room.getCheckInDate().toString());
        item.put("checkOutDate", room.getCheckOutDate().toString());
        item.put("nights", room.getNights());
        item.put("pricePerNight", pricePerNight);
        item.put("totalRoomCharge", totalRoomCharge);
        item.put("depositPercentage", room.getDepositPercentage());
        item.put("estimatedDeposit", estimatedDeposit);
        item.put("currency", "VND");
        item.put("priceScope", "room_charge_estimate");
        return Collections.unmodifiableMap(item);
    }

    private static boolean isValidServiceRecord(ServiceResponse service) {
        if (service.getServiceId() == null || service.getServiceId() <= 0) return false;
        if (isBlank(service.getCategoryName()) || isBlank(service.getServiceName()) || isBlank(service.getUnit())) {
            return false;
        }
        return service.getUnitPrice() != null && service.getUnitPrice().signum() >= 0;
    }

    private static Map<String, Object> toServiceItem(ServiceResponse service) {
        String unitPrice = formatMoney(service.getUnitPrice());
        if (unitPrice == null) return null;

        Map<String, Object> item = new LinkedHashMap<>();
        item.put("serviceId", service.getServiceId());
        item.put("categoryName", clampText(service.getCategoryName()));
        item.put("serviceName", clampText(service.getServiceName()));
        item.put("unitPrice", unitPrice);
        item.put("unit", clampText(service.getUnit()));
        item.put("isActive", true);
        item.put("currency", "VND");
        return Collections.unmodifiableMap(item);
    }

    private static Execution okExecution(
            String callId,
            String toolName,
            String retrievedAt,
            Map<String, Object> data,
            List<Map<String, Object>> cards,
            Map<String, Object> query,
            boolean hasMore
    ) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("callId", callId);
        result.put("name", toolName);
        result.put("status", "ok");
        result.put("data", Collections.unmodifiableMap(data));
        result.put("error", null);
        return new Execution(
                Collections.unmodifiableMap(result),
                retrievedAt,
                Collections.unmodifiableList(cards),
                Collections.unmodifiableMap(query),
                hasMore
        );
    }

    private static Execution errorExecution(
            String callId,
            String toolName,
            String retrievedAt,
            String code,
            String message
    ) {
        Map<String, Object> error = new LinkedHashMap<>();
        error.put("code", code);
        error.put("message", message);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("callId", callId);
        result.put("name", toolName);
        result.put("status", "error");
        result.put("data", null);
        result.put("error", Collections.unmodifiableMap(error));
        return new Execution(
                Collections.unmodifiableMap(result),
                retrievedAt,
                List.of(),
                Map.of(),
                false
        );
    }

    private static boolean hasOnlyAllowedKeys(JsonNode object, Set<String> allowed) {
        Iterator<String> names = object.fieldNames();
        while (names.hasNext()) {
            if (!allowed.contains(names.next())) return false;
        }
        return true;
    }

    private static LocalDate parseRequiredDate(JsonNode node) {
        if (node == null || !node.isTextual()) return null;
        String raw = node.asText();
        if (!ISO_DATE.matcher(raw).matches()) return null;
        try {
            return LocalDate.parse(raw);
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    private static Integer parseRequiredPositiveInt(JsonNode node) {
        if (node == null || !node.isIntegralNumber() || node.isBoolean() || !node.canConvertToInt()) return null;
        int value = node.intValue();
        return value > 0 ? value : null;
    }

    private static OptionalInt parseOptionalPositiveInt(JsonNode node) {
        if (node == null || node.isNull()) return OptionalInt.empty();
        Integer parsed = parseRequiredPositiveInt(node);
        return parsed == null ? null : OptionalInt.of(parsed);
    }

    private static Optional<BigDecimal> parseOptionalMoney(JsonNode node) {
        if (node == null || node.isNull()) return Optional.empty();
        if (!node.isTextual()) return null;
        String raw = node.asText();
        if (raw.length() > 32 || !MONEY.matcher(raw).matches()) return null;
        return Optional.of(new BigDecimal(raw));
    }

    private static String parseSortBy(JsonNode node) {
        if (node == null || node.isNull()) return "PRICE_ASC";
        if (!node.isTextual()) return null;
        String value = node.asText();
        return ("PRICE_ASC".equals(value) || "PRICE_DESC".equals(value)) ? value : null;
    }

    private static Integer parseLimit(JsonNode node) {
        if (node == null || node.isNull()) return DEFAULT_LIMIT;
        Integer value = parseRequiredPositiveInt(node);
        if (value == null || value < 1 || value > MAX_LIMIT) return null;
        return value;
    }

    static String formatMoney(BigDecimal value) {
        if (value == null || value.signum() < 0) return null;
        BigDecimal normalized = value.scale() > 2
                ? value.setScale(2, RoundingMode.HALF_UP)
                : value;
        normalized = normalized.stripTrailingZeros();
        if (normalized.scale() < 0) {
            normalized = normalized.setScale(0, RoundingMode.UNNECESSARY);
        }
        String text = normalized.toPlainString();
        if (text.length() > 32 || !MONEY.matcher(text).matches()) return null;
        return text;
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static String clampText(String value) {
        String trimmed = value.strip();
        return trimmed.length() <= MAX_TEXT_LENGTH ? trimmed : trimmed.substring(0, MAX_TEXT_LENGTH);
    }

    private static String nullableText(String value) {
        if (isBlank(value)) return null;
        return clampText(value);
    }
}
