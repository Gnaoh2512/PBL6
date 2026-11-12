import { useCallback, useEffect, useState } from "react";
import { apiCall, formatDateTime, formatVND } from "../../services/api";
import { useToast } from "../../contexts/ToastContext";
import SelectMenu from "../../components/SelectMenu";

const STATUS_META = {
  PENDING: { label: "PENDING (Chờ xử lý)", badge: "hc-badge-service-pending" },
  DELIVERING: { label: "DELIVERING (Đang giao)", badge: "hc-badge-service-delivering" },
  IN_PROGRESS: { label: "DELIVERING (Đang giao)", badge: "hc-badge-service-delivering" },
  COMPLETED: { label: "COMPLETED (Hoàn tất)", badge: "hc-badge-service-completed" },
  CANCELED: { label: "CANCELED (Đã hủy)", badge: "hc-badge-service-canceled" },
  CANCELLED: { label: "CANCELED (Đã hủy)", badge: "hc-badge-service-canceled" },
};

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "PENDING", label: "PENDING (Chờ xử lý)" },
  { value: "DELIVERING", label: "DELIVERING (Đang giao)" },
  { value: "COMPLETED", label: "COMPLETED (Hoàn tất)" },
  { value: "CANCELED", label: "CANCELED (Đã hủy)" },
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
      const response = await apiCall(`/api/staff/service-requests${query}`);
      let items = [];
      if (Array.isArray(response)) {
        items = response;
      } else if (response?.data && Array.isArray(response.data)) {
        items = response.data;
      }
      setRequests(items);
    } catch (error) {
      console.error("Lỗi khi tải danh sách yêu cầu dịch vụ:", error);
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
          assign: "Đã tiếp nhận yêu cầu, trạng thái chuyển sang DELIVERING (Đang giao)!",
          complete: "Đã hoàn tất yêu cầu dịch vụ (COMPLETED)!",
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

  const updateRequestStatus = async (request, nextStatus) => {
    setWorkingId(request.serviceRequestId);
    try {
      const response = await apiCall(`/api/staff/service-requests/${request.serviceRequestId}/status?status=${nextStatus}`, {
        method: "PATCH",
      });
      if (response?.success) {
        addToast(`Đã chuyển trạng thái yêu cầu sang ${nextStatus}!`, "success");
        await loadRequests();
      }
    } catch (error) {
      addToast(error.message || "Không thể cập nhật trạng thái.", "error");
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
                      <td>
                        <strong>{request.roomNumber ? `Phòng ${request.roomNumber}` : "—"}</strong>
                        {request.bookingCode && <div style={{ fontSize: "11px", color: "var(--hc-text-secondary)" }}>#{request.bookingCode}</div>}
                      </td>
                      <td>{request.quantity || 1}</td>
                      <td>{formatVND(request.feeAmount || 0)}</td>
                      <td>{formatDateTime(request.requestedAt)}</td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <span className={`hc-badge ${meta.badge}`}>{meta.label}</span>
                          <select
                            className="hc-select"
                            value={request.status || "PENDING"}
                            disabled={workingId !== null}
                            onChange={(e) => updateRequestStatus(request, e.target.value)}
                            style={{ fontSize: "11px", padding: "2px 6px", height: "auto", borderRadius: "4px", marginTop: "2px" }}
                            title="Thay đổi trạng thái trực tiếp"
                          >
                            <option value="PENDING">PENDING (Chờ xử lý)</option>
                            <option value="DELIVERING">DELIVERING (Đang giao)</option>
                            <option value="COMPLETED">COMPLETED (Hoàn tất)</option>
                            <option value="CANCELED">CANCELED (Đã hủy)</option>
                          </select>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                          {request.status === "PENDING" && (
                            <button
                              type="button"
                              className="hc-btn hc-btn-outline hc-btn-sm"
                              disabled={workingId !== null}
                              onClick={() => updateRequest(request, "assign")}
                              style={{ borderColor: "#0284c7", color: "#0284c7", fontWeight: 600 }}
                              title="Nhân viên tiếp nhận và tiến hành mang dịch vụ lên phòng"
                            >
                              <i className="bi bi-bicycle"></i> {workingId === request.serviceRequestId ? "Đang xử lý…" : "Nhận giao món"}
                            </button>
                          )}
                          {(request.status === "DELIVERING" || request.status === "IN_PROGRESS") && (
                            <button
                              type="button"
                              className="hc-btn hc-btn-primary hc-btn-sm"
                              disabled={workingId !== null}
                              onClick={() => updateRequest(request, "complete")}
                              style={{ fontWeight: 600 }}
                              title="Xác nhận đã giao dịch vụ lên phòng khách thành công"
                            >
                              <i className="bi bi-check2-circle"></i> {workingId === request.serviceRequestId ? "Đang xử lý…" : "Hoàn tất giao"}
                            </button>
                          )}
                          {request.status !== "CANCELED" && request.status !== "CANCELLED" && request.status !== "COMPLETED" && (
                            <button
                              type="button"
                              className="hc-btn hc-btn-outline hc-btn-sm"
                              disabled={workingId !== null}
                              onClick={() => {
                                if (window.confirm("Xác nhận hủy yêu cầu dịch vụ này?")) {
                                  updateRequest(request, "cancel");
                                }
                              }}
                              style={{ color: "#dc2626", borderColor: "#fca5a5" }}
                              title="Hủy yêu cầu dịch vụ"
                            >
                              <i className="bi bi-x-circle"></i> Hủy
                            </button>
                          )}
                        </div>
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
