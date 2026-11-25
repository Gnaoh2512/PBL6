# Evaluation — chất lượng trợ lý

- Kế thừa `ai-service/tests/AGENTS.md` và kế hoạch `ai-service/docs/EVALUATION.md` từ gốc repository.
- Lưu query, nhãn ý định/tool, evidence chuẩn, đáp án được chấp nhận, nhóm quyền và snapshot/version.
- Tách dev/test theo nhóm ý định và paraphrase; không chỉnh prompt/ngưỡng bằng held-out test.
- Đánh giá retrieval, citation, grounding, tool selection, số liệu live và từ chối truy cập trái quyền riêng nhau.
- Đo p50/p95 latency, số tool calls, token/chi phí khi provider hỗ trợ; không tạo số liệu hoặc suy từ unit tests.
- Dữ liệu synthetic và đánh giá tự động bằng model phải được gắn nhãn; câu chính sách/tiền/quyền cần rubric và rà soát con người.
