# Kiểm thử trợ lý AI

- Kế thừa `ai-service/AGENTS.md`. Đã có test suite khung FastAPI trong unit/integration; chưa có đánh giá retrieval/LLM hoặc luồng Spring/FE.
- `unit`: logic cô lập; `integration`: contract/boundary; `evaluation`: chất lượng; `fixtures`: dữ liệu synthetic.
- Unit test không gọi model/cloud/network thật. Integration thật phải tách nhãn và yêu cầu cấu hình tường minh.
- Phân quyền phải có cả kiểm tra ở Spring: khách A/khách B, anonymous, JWT hỏng, logout và conversation ID bị đánh cắp.
- Không dùng test logic pass để kết luận chất lượng RAG. Báo command, môi trường và kết quả đã chạy; chưa đo thì ghi chưa đo.
- Đọc kế hoạch `ai-service/docs/EVALUATION.md` từ gốc repository.
