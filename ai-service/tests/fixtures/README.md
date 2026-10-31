# Test fixtures

Files in this directory are synthetic test data. Their field names and nesting mirror the Java
DTOs `ApiResponse`, `AvailableRoomResponse`, and `RoomTypeResponse`; they are not production or
database exports.

The deposit amount follows Spring's `FinancialCalculator`: 30% of the two-night charge is
rounded to a whole number using `HALF_UP`.
