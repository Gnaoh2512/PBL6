# Provider adapters — LLM, embedding, index

- Kế thừa `ai-service/app/AGENTS.md`. Bao bọc IO/provider, không chứa quyết định quyền hoặc nghiệp vụ khách sạn.
- Provider/model cho assistant còn mở; không mặc nhiên cài Azure SDK, Gemini SDK, vector service hoặc model chỉ vì có thư mục này.
- Interface cần tách generate/tool planning, encode và search/index để thay provider mà không đổi quy tắc nghiệp vụ.
- Cấu hình credential bằng môi trường; không có khóa mặc định, không ghi request/response nhạy cảm vào log.
- Client có timeout/cancellation, token limit và concurrency limit; retry phải bị chặn bởi deadline chung, không retry vô hạn.
- Nạp model/client một lần theo lifecycle; readiness phản ánh dependency bắt buộc. Không trả câu trả lời giả khi provider lỗi.
- Record model/revision và số đo đã làm sạch; provider outage phải đi thành lỗi/partial rõ ràng.
- Fake cho unit test phải được gắn nhãn; integration thực dùng credential riêng ngoài Git.
