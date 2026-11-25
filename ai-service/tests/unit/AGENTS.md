# Unit tests — logic cô lập

- Kế thừa `ai-service/tests/AGENTS.md`.
- Kiểm tra intent/schema, hỏi bổ sung, tool allowlist, budget, kết quả lỗi, ghép citation và policy metadata.
- Retrieval dùng corpus nhỏ/vector biết trước; kiểm tra thứ tự ổn định, empty và nguồn hết hiệu lực.
- Fake LLM/provider có nhãn rõ; không hardcode câu trả lời để giả kiểm thử end-to-end.
- Kiểm tra cùng input/principal context dẫn đến các tool hợp lệ; prompt không phải cơ chế ownership.
- Không gọi backend/cloud thật hoặc yêu cầu credential để chạy unit.
