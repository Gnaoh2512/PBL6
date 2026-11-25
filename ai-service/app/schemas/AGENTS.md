# Schemas — message, tool và evidence

- Kế thừa `ai-service/app/AGENTS.md`. Là hợp đồng typed giữa transport, orchestration, retrieval và Spring.
- Phân biệt user message, server context, tool call, tool result, citation, card/action và error. Client không được ghi các trường server-only.
- Không coi nội dung conversation state từ browser là trusted identity hoặc bằng chứng quyền.
- Tool result phải có call ID/request binding; nguồn tài liệu phải có document ID, chunk ID, version và source reference kiểm chứng được.
- Số tiền dùng biểu diễn chính xác tương thích Java và currency/unit rõ; không làm tròn tùy ý bằng float.
- Giới hạn độ dài/số phần tử; định nghĩa unknown/empty/error riêng, không dùng giá 0 hay booking giả thay dữ liệu thiếu.
- Không thêm trường PII chỉ vì entity backend có sẵn. Tránh raw payload/log không cần thiết.
- Thay đổi schema phải cập nhật contract và integration test cả Java/Python/FE.
