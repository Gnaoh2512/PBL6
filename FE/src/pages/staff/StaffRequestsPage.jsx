import { useCallback, useEffect, useState } from "react";
import { apiCall, formatDateTime, formatVND } from "../../services/api";
import { useToast } from "../../contexts/ToastContext";
import SelectMenu from "../../components/SelectMenu";

const STATUS_META = {
  PENDING: { label: "Chờ xử lý", badge: "hc-badge-warning" },
  IN_PROGRESS: { label: "Đang xử lý", badge: "hc-badge-info" },
  COMPLETED: { label: "Hoàn tất", badge: "hc-badge-success" },
  CANCELED: { label: "Đã hủy", badge: "hc-badge-muted" },
  CANCELLED: { label: "Đã hủy", badge: "hc-badge-muted" },
};

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "PENDING", label: STATUS_META.PENDING.label },
  { value: "IN_PROGRESS", label: STATUS_META.IN_PROGRESS.label },
  { value: "COMPLETED", label: STATUS_META.COMPLETED.label },
  { value: "CANCELED", label: STATUS_META.CANCELED.label },
];

const CLOSED_STATUSES = ["COMPLETED", "CANCELED", "CANCELLED"];

export default function StaffRequestsPage() {
  const { addToast } = useToast();
  const [requests, setRequests] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const query = status ? `?status=${encodeURIComponent(status)}` : "";
      const response = await apiCall(`/api/staff/service-requests${query}`, { silentError: true });
      setRequests(response?.success ? response.data || [] : []);
    } catch (error) {
      setRequests([]);
      addToast(error.message || "Không thể tải yêu cầu dịch vụ.", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast, status]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const updateRequest = async (request, action) => {
    setWorkingId(request.serviceRequestId);
    try {
      const response = await apiCall(`/api/staff/service-requests/${request.serviceRequestId}/${action}`, { method: "POST" });
      if (response?.success) {
        const messages = {
          assign: "Đã nhận xử lý yêu cầu.",
          complete: "Đã hoàn tất yêu cầu dịch vụ.",
          cancel: "Đã hủy yêu cầu dịch vụ.",
        };
        addToast(messages[action] || "Cập nhật thành công.", "success");
        await loadRequests();
      }
    } catch (error) {
      addToast(error.message || "Không thể cập nhật yêu cầu.", "error");
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <div className="ops-page">
      <div className="hc-page-title" style={{ textAlign: "left" }}>
        <h2>Yêu cầu dịch vụ</h2>
        <p>Tiếp nhận, xử lý và hoàn tất các yêu cầu từ khách lưu trú.</p>
      </div>

      <div className="hc-card">
        <div className="hc-card-header">
          <div className="hc-card-title">
            <i className="bi bi-bell text-primary" style={{ marginRight: "8px" }}></i>
            Danh sách yêu cầu
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ minWidth: "200px" }}>
              <SelectMenu value={status} onChange={setStatus} options={STATUS_OPTIONS} ariaLabel="Lọc trạng thái" icon="bi-funnel" />
            </div>
            <button type="button" className="hc-btn hc-btn-outline" onClick={loadRequests} disabled={loading}>
              <i className="bi bi-arrow-clockwise"></i> Làm mới
            </button>
          </div>
        </div>

        {loading ? (
          <div className="hc-loading-spinner">
            <div className="hc-spinner"></div>
          </div>
        ) : requests.length === 0 ? (
          <div className="hc-empty-state">
            <i className="bi bi-inbox"></i>
            <p>Không có yêu cầu dịch vụ phù hợp.</p>
          </div>
        ) : (
          <div className="hc-card-body flush" style={{ overflowX: "auto" }}>
            <table className="hc-table">
              <thead>
                <tr>
                  <th>Dịch vụ</th>
                  <th>Khách</th>
                  <th>Phòng</th>
                  <th>Số lượng</th>
                  <th>Thành tiền</th>
                  <th>Yêu cầu lúc</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => {
                  const meta = STATUS_META[request.status] || { label: request.status, badge: "hc-badge-muted" };
                  const isClosed = CLOSED_STATUSES.includes(request.status);
                  return (
                    <tr key={request.serviceRequestId}>
                      <td>
                        <strong>{request.serviceName || "Yêu cầu dịch vụ"}</strong>
                        {request.note && <div style={{ fontSize: "12px", color: "var(--hc-text-secondary)", marginTop: "2px" }}>{request.note}</div>}
                      </td>
                      <td>{request.customerName || "—"}</td>
                      <td>{request.roomNumber || "—"}</td>
                      <td>{request.quantity || 1}</td>
                      <td>{formatVND(request.feeAmount || 0)}</td>
                      <td>{formatDateTime(request.requestedAt)}</td>
                      <td>
                        <span className={`hc-badge ${meta.badge}`}>{meta.label}</span>
                      </td>
                      <td>
                        {!isClosed && (
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" disabled={workingId !== null} onClick={() => updateRequest(request, "assign")}>
                              {request.assignedToStaff ? "Nhận lại" : "Nhận xử lý"}
                            </button>
                            <button type="button" className="hc-btn hc-btn-primary hc-btn-sm" disabled={workingId !== null} onClick={() => updateRequest(request, "complete")}>
                              {workingId === request.serviceRequestId ? "Đang xử lý…" : "Hoàn tất"}
                            </button>
                            <button
                              type="button"
                              className="hc-btn hc-btn-outline hc-btn-sm"
                              disabled={workingId !== null}
                              onClick={() => {
                                if (window.confirm("Xác nhận hủy yêu cầu dịch vụ này?")) {
                                  updateRequest(request, "cancel");
                                }
                              }}
                              title="Hủy yêu cầu dịch vụ"
                            >
                              Hủy
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
