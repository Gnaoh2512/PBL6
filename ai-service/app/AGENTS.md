# Python application — trợ lý khách sạn

- Kế thừa `ai-service/AGENTS.md`. Khung FastAPI chạy bằng `uvicorn app.main:create_app --factory` từ ai-service; chưa có provider/index/orchestration.
- `api` gọi `orchestration`; orchestration dùng `retrieval`, khai báo `tools`, `schemas` và adapter `providers`.
- `ingestion` chạy offline, không nằm trên đường xử lý mỗi câu chat. `prompts` chứa chỉ dẫn versioned.
- Không thêm framework agent hoặc cloud SDK trước khi có yêu cầu triển khai và lý do phù hợp với lát đang làm.
- Không tạo module rỗng hàng loạt; mỗi lát phải có hành vi có thể kiểm chứng trước khi mở rộng.
- Giữ logic điều phối độc lập transport/provider để kiểm tra bằng fake có nhãn; lỗi provider thật không được ngầm thay bằng fake.
- Không đọc MySQL hoặc JWT khách. Dữ liệu nghiệp vụ chỉ đến qua tool result đã được Spring kiểm tra quyền.
- Đọc `ai-service/docs/architecture.md` từ gốc repository để hiểu luồng và giới hạn.
