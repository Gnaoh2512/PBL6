---
document_id: service-usage-guide
title: "Danh mục dịch vụ theo database"
category: service_guide
version: "0.2.0-draft"
status: pending_review
approved: false
approved_by: null
approved_at: null
effective_from: null
effective_to: null
source_ref: "database:hotel_management/service,service_category;service_ids=1,2,3"
observed_at: "2026-11-13"
updated_at: "2026-11-13"
---

# Danh mục dịch vụ

> Bản nháp chờ duyệt. Ba dịch vụ dưới đây có is_active=1 khi khảo sát; trạng thái và giá phải được kiểm tra lại bằng backend khi trả lời khách.

## SVC-01 — Nước khoáng Lavie 500ml

- Mã dịch vụ: `1`.
- Nhóm: Ẩm thực & Đồ uống (F&B).
- Đơn vị tính: Chai.
- Nội dung có căn cứ: sản phẩm nước khoáng Lavie dung tích 500 ml.

Không suy ra dịch vụ giao tận phòng, miễn phí hoặc đã nằm trong giá phòng vì danh mục chưa thể hiện các điều kiện đó.

## SVC-02 — Bữa sáng Buffet

- Mã dịch vụ: `2`.
- Nhóm: Ẩm thực & Đồ uống (F&B).
- Đơn vị tính: Suất.
- Nội dung có căn cứ: dịch vụ bữa sáng buffet.

Không bổ sung giờ phục vụ, thực đơn, địa điểm, giá trẻ em hoặc khẳng định đã bao gồm trong tiền phòng vì dữ liệu được đọc chưa ghi các thông tin này.

## SVC-03 — Giặt ủi quần áo nhanh

- Mã dịch vụ: `3`.
- Nhóm: Dịch vụ phòng & Giặt ủi.
- Đơn vị tính: Kg.
- Nội dung có căn cứ: dịch vụ giặt ủi quần áo nhanh theo tên trong danh mục.

Từ “nhanh” là một phần tên dịch vụ, không phải cam kết trả đồ trong số giờ cụ thể. Không tự bổ sung điều kiện nhận đồ, loại vải hoặc mức phí ngoài giá backend.

## SVC-04 — Giá và trạng thái

service lưu đơn giá và trạng thái hoạt động; service_category lưu nhóm dịch vụ. Khi khách hỏi giá, backend cung cấp đơn giá hiện tại và đơn vị tương ứng. Tài liệu không đóng băng số tiền hoặc khẳng định dịch vụ luôn hoạt động.

## SVC-05 — Yêu cầu và chi phí trong kỳ lưu trú

Schema service_request có dịch vụ, số lượng, trạng thái, phí và liên kết booking. service_usage lưu dịch vụ đã ghi nhận, số lượng và giá áp dụng. Sự tồn tại các bảng này không xác định thời gian đáp ứng hoặc điều kiện đổi/hủy; dữ liệu cá nhân của yêu cầu chỉ cung cấp sau khi kiểm tra quyền ở backend.
