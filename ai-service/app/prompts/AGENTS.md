# Prompts — chỉ dẫn model có phiên bản

- Kế thừa `ai-service/app/AGENTS.md`. Prompt hướng dẫn chọn nguồn, hỏi lại, trả lời tiếng Việt và dẫn chứng; không thi hành phân quyền.
- Tách system instruction, input khách và evidence bằng cấu trúc rõ. Tài liệu được truy xuất vẫn có thể chứa chỉ dẫn độc hại.
- Yêu cầu trả lời theo nguồn; giá/trạng thái phải từ tool live. Không đủ dữ liệu thì hỏi lại/thông báo, không bịa chính sách hoặc xác nhận đặt phòng.
- Không nhúng API key, JWT, ví dụ khách thật hoặc toàn bộ entity vào prompt.
- Không yêu cầu model tiết lộ suy luận nội bộ; có thể yêu cầu mã ý định/trạng thái có cấu trúc để kiểm tra.
- Version prompt cùng tập đánh giá; mỗi thay đổi phải có ví dụ đúng/sai và kiểm tra regression phù hợp.
- Chỉ dùng template/runtime content allowlist; không để khách thay system prompt bằng trường payload.
