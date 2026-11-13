# AI Hotel — trợ lý khách sạn

Trợ lý hỗ trợ FAQ, phòng, giá phòng, dịch vụ, booking cá nhân khi đăng nhập và chính sách khách sạn. Widget đặt ở **góc dưới bên phải**.

**Trạng thái:** đã có khung FastAPI với health/readiness, xác thực service, schemas start/resume và lỗi có mã. Chưa có provider LLM, index, pipeline RAG, vòng điều phối hoặc widget; không trả câu trả lời AI giả.

## Cách chia trách nhiệm

- `app/`: API nội bộ, điều phối hội thoại, retrieval, tools, ingestion, providers, schemas và prompts.
- `knowledge/`: FAQ, chính sách và hướng dẫn dịch vụ được duyệt; không chứa booking hoặc thông tin khách.
- `tests/`: unit, integration, evaluation và fixture synthetic.
- `docs/`: một bộ tài liệu hiện hành cho trợ lý.
- Mỗi thư mục có `AGENTS.md` nêu trách nhiệm, ranh giới và cách kiểm tra.

Spring Boot giữ xác thực, quyền sở hữu booking và dữ liệu nghiệp vụ. AI dùng RAG cho tài liệu; việc tra phòng/giá/dịch vụ/booking thực thi qua service backend. Không kết nối trực tiếp MySQL hoặc gửi JWT khách cho AI.

## Tài liệu

| File | Nội dung |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Quy tắc làm việc của agent |
| [Kiến trúc](docs/architecture.md) | Sơ đồ luồng, cây thư mục và ranh giới dữ liệu |
| [Hợp đồng API](docs/API.md) | Endpoint/tool đề xuất, dữ liệu trao đổi, xác thực, phiên và mã lỗi |
| [Giao diện](docs/UI.md) | Widget góc dưới bên phải, desktop/mobile |
| [Lộ trình](docs/PLAN.md) | Các lát triển khai và tiêu chí nghiệm thu |
| [Đánh giá](docs/EVALUATION.md) | Chất lượng RAG/tool, phân quyền và hiệu năng |
| [Trạng thái](docs/STATUS.md) | Đã làm, giới hạn và việc tiếp theo |

## Khởi chạy

Đã kiểm tra trên Windows/PowerShell, Python 3.13.10. Chạy từ thư mục `ai-service`:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.lock
Copy-Item settings.example.env .env
.\.venv\Scripts\python.exe -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8006
```

`requirements.txt` liệt kê dependency runtime; `requirements-dev.txt` thêm pytest, HTTPX và Ruff. `requirements.lock` chốt toàn bộ phiên bản môi trường phát triển đã kiểm thử; lệnh trên cài cả công cụ test. Không khôi phục pyproject.toml, .env.example hoặc cây src/ai_service cũ đang bị xóa.

File mẫu không chứa credential thật. Điền AI_SERVICE_AUTH_TOKEN bằng token riêng của service trong `.env` hoặc biến môi trường; giá trị môi trường có ưu tiên cao hơn `.env`. Không dùng JWT khách làm token nội bộ. Token cấu hình phải dài 1–512 ký tự ASCII in được, không có khoảng trắng; nên tạo chuỗi ngẫu nhiên đủ mạnh, không dùng giá trị mẫu. AI_CORPUS_MODE là production hoặc demo_synthetic. Không có biến bật giả trạng thái LLM/index.

Không cài hay kết nối MySQL, SDK LLM hoặc vector database. Chỉ bind loopback cho chạy local; khi dùng qua mạng cần TLS và giới hạn mạng theo API.md. Chưa mở Swagger/OpenAPI hoặc route browser.

## Hành vi hiện có

| Request | Kết quả |
| --- | --- |
| GET /health | 200, status=alive |
| GET /ready | 503, status=not_ready; llm=false, retrieval=false |
| POST /internal/assistant/turn thiếu cấu hình token | 503 AI_NOT_CONFIGURED |
| Cùng route, có cấu hình nhưng thiếu/sai credential hoặc gửi USER_JWT | 401 UNAUTHORIZED |
| Start hợp lệ với đúng token | 503 DEPENDENCY_UNAVAILABLE; không có answer |
| Resume đúng schema | 409 CONTINUATION_NOT_FOUND; chưa có continuation nào được cấp |
| Payload sai/ID không khớp header | 422 VALIDATION_ERROR |
| JSON sai cú pháp có Content-Type application/json | 400 INVALID_JSON |
| Body nội bộ vượt 128 KiB kể cả gửi chunk | 413 PAYLOAD_TOO_LARGE |

Các payload lỗi trả requestId và error.code/message/retryable, không phản chiếu nội dung đầu vào. Dữ liệu trong [API.md](docs/API.md) là hợp đồng tổng thể; trong bước này chỉ hiện thực schema request và lớp biên, chưa có success/tool execution/final output. Nếu gửi X-Request-ID thì phải khớp requestId trong body; server sinh ID nếu header thiếu, do đó request turn với body khác ID sẽ bị từ chối.

## Kiểm tra

```powershell
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\ruff.exe check app tests/unit tests/integration
.\.venv\Scripts\ruff.exe format --check app tests/unit tests/integration
.\.venv\Scripts\python.exe -m pip check
```

Test paths chỉ gồm tests/unit và tests/integration của bước mới. Không gọi DB/cloud/model, không chạy các test của source cũ đang bị xóa. Contract test đọc ví dụ start/resume trong docs/API.md. HTTPX 0.28.1 hiện gây một cảnh báo deprecation từ Starlette TestClient; các kiểm thử vẫn pass, không lọc hoặc che cảnh báo. Cần đánh giá migration test client khi nâng dependency sau này.

Knowledge giữ approved=false; không đọc hoặc index chúng trong startup. Các chỉ số retrieval/grounding/latency của AI chưa đo.
