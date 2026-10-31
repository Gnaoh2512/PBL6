# 🏨 PBL6 – Hotel Management System

Hệ thống quản lý khách sạn bao gồm ba thành phần chính:

| Thành phần | Công nghệ | Mô tả |
|---|---|---|
| **BE** (Backend) | Spring Boot 4.x + MySQL | REST API, xác thực JWT, serve React SPA |
| **FE** (Frontend) | React 19 + Vite + Bootstrap 5 | Giao diện người dùng |
| **ai-service** | Python / FastAPI | RAG, gợi ý khách sạn bằng AI |

> **Cách làm việc hằng ngày (Development):** Chạy BE ở cổng `9090` và FE dev server ở cổng `3000` (`npm run dev`).
> Vite tự động proxy `/api/*` → `9090`, nên bạn chỉ cần mở **http://localhost:3000**.
>
> **Khi cần demo / deploy:** Build FE vào thư mục `static` của BE bằng `npm run build-prod`,
> sau đó chỉ cần chạy BE — toàn bộ ứng dụng phục vụ tại **http://localhost:9090**.

---

## 📋 Yêu cầu cài đặt

| Công cụ | Phiên bản tối thiểu | Ghi chú |
|---|---|---|
| JDK | 21+ | Spring Boot 4 yêu cầu Java 21 |
| Maven | 3.9+ (hoặc dùng `mvnw` đi kèm) | |
| Node.js | 18+ | Kèm npm |
| MySQL | 8.0+ | |
| Python | 3.12+ | Chỉ cần nếu chạy ai-service |

---

## ⚙️ 1. Chuẩn bị cơ sở dữ liệu

### 1.1 Tạo database

```sql
-- Chạy file SQL có sẵn trong thư mục gốc dự án
source hotel_management.sql
```

Hoặc từ terminal:

```bash
mysql -u root -p < hotel_management.sql
```

File `hotel_management.sql` sẽ tự tạo database `hotel_management` nếu chưa tồn tại.

### 1.2 Dữ liệu mẫu (seed data)

Khi BE khởi động lần đầu, class `DataInitializer` sẽ tự động chèn dữ liệu mẫu
(loại phòng, tài khoản admin, v.v.) nếu database đang trống.

---

## 🔧 2. Backend (BE)

### 2.1 Cấu hình biến môi trường

Sao chép file `.env.example` thành `.env` trong thư mục `BE/`:

```bash
cp BE/.env.example BE/.env
```

Sau đó chỉnh sửa `BE/.env` theo thông tin thực tế của bạn:

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=hotel_management
DB_USERNAME=root
DB_PASSWORD=<mật_khẩu_mysql_của_bạn>
JWT_SECRET=404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970
SEPAY_API_KEY=<api_key_sepay_nếu_có>
SERVER_PORT=9090
```

> **Lưu ý:** File `.env` đã được thêm vào `.gitignore`, **không commit** file này lên git.

### 2.2 Chạy Backend

Từ thư mục `BE/`:

```bash
# Dùng Maven Wrapper (không cần cài Maven toàn cục)
.\mvnw.cmd spring-boot:run        # Windows
./mvnw spring-boot:run            # Linux/Mac
```

Hoặc nếu đã cài Maven:

```bash
mvn spring-boot:run
```

Backend sẽ khởi động tại: **http://localhost:9090**

### 2.3 Kiểm tra

```bash
curl http://localhost:9090/api/health
```

---

## 🎨 3. Frontend (FE)

### 3.1 Cài dependencies

```bash
cd FE
npm install
```

### 3.2 Chạy FE (Development — cách làm việc hằng ngày)

```bash
npm run dev
```

Mở trình duyệt tại **http://localhost:3000**.

Vite tự động proxy mọi request `/api/*` sang BE tại `http://localhost:9090` — bạn không cần cấu hình gì thêm.

> ⚠️ **Lưu ý:** BE phải đang chạy ở cổng `9090` trước, nếu không các API call sẽ thất bại.

### 3.3 Build cho Production / Demo (tích hợp vào BE)

> Chỉ dùng khi cần demo hoặc triển khai. Trong lúc phát triển bình thường, **dùng `npm run dev`** như trên.

```bash
npm run build-prod
```

Lệnh này sẽ:
1. Build React app ra thư mục `dist/`
2. Tự động sao chép toàn bộ nội dung vào `BE/src/main/resources/static/`

Sau khi build xong, **chỉ cần chạy BE** và truy cập **http://localhost:9090** — không cần chạy FE riêng.

> BE có `SpaRedirectController` tự động forward tất cả các route không phải `/api/**` về `index.html`,
> cho phép React Router hoạt động đúng khi refresh trang.

---

## 🤖 4. AI Service (`ai-service/`)

Xem hướng dẫn đầy đủ tại [`ai-service/README.md`](./ai-service/README.md).

Tóm tắt nhanh:

```bash
cd ai-service

# Tạo virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
source .venv/bin/activate     # Linux/Mac

# Cài dependencies
pip install -e .

# Cấu hình .env (sao chép từ .env.example)
cp .env.example .env

# Chạy service
uvicorn src.ai_service.main:app --reload --port 8000
```

---

## 🚀 5. Quy trình khởi động đầy đủ

### Môi trường phát triển (3 terminal riêng biệt)

```
Terminal 1 – Database
  └─ Đảm bảo MySQL đang chạy & database hotel_management đã được import

Terminal 2 – Backend
  └─ cd BE && .\mvnw.cmd spring-boot:run
      → http://localhost:9090

Terminal 3 – Frontend
  └─ cd FE && npm run dev
      → http://localhost:3000

(Tuỳ chọn) Terminal 4 – AI Service
  └─ cd ai-service && uvicorn src.ai_service.main:app --reload --port 8000
      → http://localhost:8000
```

### Môi trường Production / Demo (1 cổng duy nhất)

```bash
# Bước 1: Build FE vào static của BE
cd FE && npm run build-prod

# Bước 2: Chạy BE
cd ../BE && .\mvnw.cmd spring-boot:run

# Truy cập toàn bộ ứng dụng tại:
http://localhost:9090
```

---

## 📁 6. Cấu trúc thư mục

```
PBL6-2026/
├── BE/                         # Spring Boot Backend
│   ├── .env                    # Biến môi trường (KHÔNG commit)
│   ├── .env.example            # Template biến môi trường
│   ├── pom.xml
│   ├── mvnw / mvnw.cmd         # Maven Wrapper
│   ├── API_DOC_FOR_BE.md       # Tài liệu API nội bộ BE
│   ├── API_DOCUMENTATION_FOR_FE.md  # Tài liệu API cho FE
│   └── src/
│       └── main/
│           ├── java/com/example/pbl6/
│           │   ├── config/
│           │   │   ├── SpaRedirectController.java  # Forward route → React
│           │   │   ├── BankConfig.java
│           │   │   └── DataInitializer.java        # Seed data
│           │   ├── controller/
│           │   ├── service/
│           │   ├── repository/
│           │   ├── entity/
│           │   ├── dto/
│           │   ├── security/    # JWT Filter, SecurityConfig
│           │   └── exception/
│           └── resources/
│               ├── application.properties
│               └── static/      # ← FE build output (auto-generated)
│
├── FE/                         # React + Vite Frontend
│   ├── package.json
│   ├── vite.config.js          # Proxy /api → 9090, build → BE/static
│   └── src/
│
├── ai-service/                 # Python FastAPI AI Service
│   └── README.md               # Hướng dẫn chi tiết
│
├── hotel_management.sql        # Schema & migration SQL
└── README.md                   # File này
```

---

## 🔑 7. Tài khoản mặc định

Sau khi `DataInitializer` chạy, hệ thống có sẵn tài khoản:

| Username | Password | Vai trò |
|---|---|---|
| `admin` | `admin123` | ADMIN |

> Tài khoản mặc định chỉ dùng cho môi trường phát triển. **Đổi mật khẩu** trước khi triển khai production.

---

## 🌐 8. Cổng dịch vụ

| Service | Cổng |
|---|---|
| Backend (Spring Boot) | `9090` |
| Frontend Dev Server (Vite) | `3000` |
| AI Service (FastAPI) | `8000` |
| MySQL | `3306` |

---

## 📝 9. Tài liệu API

- **API cho FE:** [`BE/API_DOCUMENTATION_FOR_FE.md`](./BE/API_DOCUMENTATION_FOR_FE.md)
- **API nội bộ BE:** [`BE/API_DOC_FOR_BE.md`](./BE/API_DOC_FOR_BE.md)
- **AI Service:** [`ai-service/README.md`](./ai-service/README.md)

---

## ❓ Xử lý lỗi thường gặp

### BE không start được — lỗi kết nối database

```
Communications link failure
```
→ Kiểm tra MySQL đang chạy, và giá trị `DB_HOST`, `DB_PORT`, `DB_PASSWORD` trong `BE/.env`.

### BE không đọc được `.env`

→ Đảm bảo file `.env` nằm đúng trong thư mục `BE/` (cùng cấp với `pom.xml`).
Dự án dùng thư viện `dotenv-java` để tự động load file này.

### FE gọi API bị lỗi CORS hoặc 404

→ Kiểm tra BE đã chạy ở cổng `9090`. Vite chỉ proxy trong môi trường `dev`;
nếu build production thì FE chạy trực tiếp trên BE, không cần proxy.

### React Router bị 404 khi refresh trang (production)

→ `SpaRedirectController` đã xử lý vấn đề này. Nếu vẫn gặp lỗi, kiểm tra
FE đã được build vào đúng thư mục `BE/src/main/resources/static/`.
