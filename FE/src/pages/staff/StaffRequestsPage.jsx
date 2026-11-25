import { useCallback, useEffect, useState } from "react";
import { apiCall, formatDateTime, formatVND } from "../../services/api";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import SelectMenu from "../../components/common/SelectMenu";
import Modal from "../../components/common/Modal";
import Paginated from "../../components/common/TablePagination";
import { SERVICE_STATUS_LABEL } from "../../utils/labels";

const STATUS_META = {
  PENDING: { label: SERVICE_STATUS_LABEL.PENDING, badge: "hc-badge-service-pending" },
  DELIVERING: { label: SERVICE_STATUS_LABEL.DELIVERING, badge: "hc-badge-service-delivering" },
  IN_PROGRESS: { label: SERVICE_STATUS_LABEL.DELIVERING, badge: "hc-badge-service-delivering" },
  COMPLETED: { label: SERVICE_STATUS_LABEL.COMPLETED, badge: "hc-badge-service-completed" },
  CANCELED: { label: SERVICE_STATUS_LABEL.CANCELED, badge: "hc-badge-service-canceled" },
  CANCELLED: { label: SERVICE_STATUS_LABEL.CANCELED, badge: "hc-badge-service-canceled" },
};

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "PENDING", label: SERVICE_STATUS_LABEL.PENDING },
  { value: "DELIVERING", label: SERVICE_STATUS_LABEL.DELIVERING },
  { value: "COMPLETED", label: SERVICE_STATUS_LABEL.COMPLETED },
  { value: "CANCELED", label: SERVICE_STATUS_LABEL.CANCELED },
];

const CLOSED_STATUSES = ["COMPLETED", "CANCELED", "CANCELLED"];


// Accept the timestamp names used by both Java DTOs and SQL-oriented responses.
const getRequestTime = (request) => request?.requestedAt ?? request?.reqTime ?? request?.req_time ?? request?.requestTime ?? null;

// Only explicit backend loyalty metadata classifies a request as a loyalty benefit.
// A zero fee alone is not sufficient: regular services can also be waived.
const isLoyaltyBenefitRequest = (request) => {
  if (request?.isLoyaltyBenefit === true || request?.loyaltyBenefit === true || request?.freeByLoyalty === true) return true;

  const marker = [request?.benefitType, request?.requestType, request?.serviceSource, request?.source, request?.benefitCode].filter(Boolean).join(" ").toUpperCase();

  if (marker.includes("LOYALTY") || marker.includes("TIER_BENEFIT") || request?.benefitRedemptionId || request?.tierBenefitId || request?.loyaltyBenefitId) return true;

  if (request?.isLoyaltyBenefit === false || request?.loyaltyBenefit === false || marker.includes("NORMAL") || marker.includes("REGULAR") || marker.includes("STANDARD")) return false;

  return null;
};

const sortRequestsNewestFirst = (items) =>
  [...items].sort((a, b) => {
    const timeA = Date.parse(getRequestTime(a) || "") || 0;
    const timeB = Date.parse(getRequestTime(b) || "") || 0;
    return timeB - timeA;
  });

export default function StaffRequestsPage() {
  const { addToast } = useToast();
  const [requests, setRequests] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState(null);
  const { hasRole } = useAuth();
  // Service staff only complete their own requests; assigning / cancelling is for supervisors
  const canManage = hasRole(["RECEPTIONIST", "MANAGER", "ADMIN"]);
  const isServiceStaff = hasRole(["SERVICE_STAFF"]);
  const [completeTarget, setCompleteTarget] = useState(null);

  const confirmComplete = async () => {
    if (!completeTarget) return;
    await updateRequest(completeTarget, "complete");
    setCompleteTarget(null);
  };
  // Detail modal (read-only, opens when a row is clicked)
  const [editTarget, setEditTarget] = useState(null);

  // Assign Modal States
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [targetRequest, setTargetRequest] = useState(null);
  const [serviceStaff, setServiceStaff] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [submittingAssign, setSubmittingAssign] = useState(false);

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
      setRequests(sortRequestsNewestFirst(items));
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
          assign: "Đã tiếp nhận yêu cầu, trạng thái chuyển sang Đang giao!",
          complete: "Đã hoàn tất yêu cầu dịch vụ!",
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

  const openEditModal = (request) => setEditTarget(request);
  const closeEditModal = () => setEditTarget(null);

  const openAssignModal = async (request) => {
    setTargetRequest(request);
    setSelectedStaffId(request.assignedToId ? String(request.assignedToId) : "");
    setAssignModalOpen(true);
    setLoadingStaff(true);
    try {
      const res = await apiCall("/api/staff/available-in-shift?roleCode=ROLE_SERVICE_STAFF", { silentError: true });
      const list = res?.success && Array.isArray(res.data) ? res.data : [];
      const formatted = list.map((item) => {
        const id = item.accountId ?? item.id;
        const name = item.fullName || item.username || `Nhân viên #${id}`;
        const start = item.shiftStartTime ? String(item.shiftStartTime).slice(0, 5) : "";
        const end = item.shiftEndTime ? String(item.shiftEndTime).slice(0, 5) : "";
        const timeStr = start && end ? ` (${start} - ${end})` : "";
        const shiftStr = item.shiftName ? ` — ${item.shiftName}${timeStr}` : "";
        return {
          id: String(id),
          name: `${name}${shiftStr}`,
          raw: item,
        };
      });
      setServiceStaff(formatted);
      if (formatted.length > 0 && !request.assignedToId) {
        setSelectedStaffId(formatted[0].id);
      }
    } catch (err) {
      console.error("Lỗi khi tải danh sách nhân viên phục vụ:", err);
      setServiceStaff([]);
    } finally {
      setLoadingStaff(false);
    }
  };

  const closeAssignModal = () => {
    setAssignModalOpen(false);
    setTargetRequest(null);
    setSelectedStaffId("");
  };

  const handleConfirmAssign = async () => {
    if (!targetRequest || !selectedStaffId) {
      addToast("Vui lòng chọn nhân viên phục vụ.", "warning");
      return;
    }
    setSubmittingAssign(true);
    try {
      const res = await apiCall(`/api/staff/service-requests/${targetRequest.serviceRequestId}/assign?staffId=${encodeURIComponent(selectedStaffId)}`, {
        method: "POST",
      });
      if (res?.success) {
        addToast("Đã phân công nhân viên phục vụ thành công! (Trạng thái: Đang giao)", "success");
        closeAssignModal();
        await loadRequests();
      }
    } catch (error) {
      addToast(error.message || "Không thể phân công nhân viên.", "error");
    } finally {
      setSubmittingAssign(false);
    }
  };

  const staffOptions = [
    {
      value: "",
      label: loadingStaff ? "Đang tải nhân viên trong ca trực…" : serviceStaff.length ? "Chọn nhân viên phục vụ có ca trực" : "Không có nhân viên trong ca trực",
    },
    ...serviceStaff.map((s) => ({ value: s.id, label: s.name })),
  ];

  return (
    <div className="ops-page">
      <div className="hc-page-title u-text-left">
        <h2>Yêu cầu dịch vụ</h2>
        <p>Tiếp nhận, xử lý và hoàn tất các yêu cầu từ khách lưu trú.</p>
      </div>

      <div className="hc-card">
        <div className="hc-card-header">
          <div className="hc-card-title">
            <i className="bi bi-bell text-primary u-mr-8"></i>
            Danh sách yêu cầu
          </div>
          <div className="m-fields" style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
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
          <Paginated items={requests}>
            {(pageRows, pager) => (
              <>
                <div className="hc-card-body flush u-scroll-x">
                  <table className="hc-table requests-table">
                    <thead>
                      <tr>
                        <th>Dịch vụ</th>
                        <th>Loại dịch vụ</th>
                        <th>Khách</th>
                        <th>Phòng</th>
                        <th>Số lượng</th>
                        <th>Thành tiền</th>
                        <th>Người phục vụ</th>
                        <th>Yêu cầu lúc</th>
                        <th>Trạng thái</th>
                        <th className="col-actions">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((request) => {
                        const meta = STATUS_META[request.status] || { label: request.status, badge: "hc-badge-muted" };
                        const isClosed = CLOSED_STATUSES.includes(request.status);
                        const isLoyaltyBenefit = isLoyaltyBenefitRequest(request);
                        return (
                          <tr
                            key={request.serviceRequestId}
                            className="row-clickable"
                            tabIndex={0}
                            title="Nhấn để xem chi tiết yêu cầu"
                            onClick={() => openEditModal(request)}
                            onKeyDown={(e) => {
                              if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                                e.preventDefault();
                                openEditModal(request);
                              }
                            }}
                          >
                            <td>
                              <strong>{request.serviceName || "Yêu cầu dịch vụ"}</strong>
                              {request.note && <div style={{ fontSize: "12px", color: "var(--hc-text-secondary)", marginTop: "2px" }}>{request.note}</div>}
                            </td>
                            <td>
                              <span
                                className={`hc-badge ${isLoyaltyBenefit === true ? "hc-badge-info" : isLoyaltyBenefit === false ? "hc-badge-violet" : "hc-badge-muted"}`}
                                title={isLoyaltyBenefit === true ? "Dịch vụ được sử dụng từ quyền lợi hội viên" : isLoyaltyBenefit === false ? "Dịch vụ thông thường" : "API chưa trả về thông tin phân loại"}
                              >
                                {isLoyaltyBenefit === true ? "Ưu đãi hội viên" : isLoyaltyBenefit === false ? "Dịch vụ thường" : "Chưa xác định"}
                              </span>
                            </td>
                            <td>{request.customerName || "—"}</td>
                            <td>
                              <strong>{request.roomNumber ? `Phòng ${request.roomNumber}` : "—"}</strong>
                              {request.bookingCode && <div className="u-hint-sm">#{request.bookingCode}</div>}
                            </td>
                            <td>{request.quantity || 1}</td>
                            <td>{isLoyaltyBenefit === true ? <span style={{ color: "var(--hc-success, #16a34a)", fontWeight: 600 }}>Miễn phí</span> : formatVND(request.feeAmount || 0)}</td>
                            <td>
                              {request.assignedToStaff ? (
                                <span className="hc-badge hc-badge-info" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                  <i className="bi bi-person-check-fill"></i>
                                  {request.assignedToStaff}
                                </span>
                              ) : (
                                <span style={{ color: "var(--hc-text-muted)", fontSize: "12px", fontStyle: "italic" }}>Chưa phân công</span>
                              )}
                            </td>
                            <td>{formatDateTime(getRequestTime(request))}</td>
                            <td>
                              <span className={`hc-badge ${meta.badge}`}>{meta.label}</span>
                            </td>
                            <td className="col-actions">
                              <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                                {isServiceStaff && request.status === "PENDING" && !request.assignedToStaff && (
                                  <button
                                    type="button"
                                    className="hc-btn hc-btn-info hc-btn-sm"
                                    disabled={workingId !== null}
                                    onClick={() => updateRequest(request, "claim")}
                                    title="Nhận yêu cầu này từ hàng chờ"
                                  >
                                    <i className="bi bi-hand-index-thumb"></i> Nhận việc
                                  </button>
                                )}
                                {canManage && request.status === "PENDING" && (
                                  <button
                                    type="button"
                                    className="hc-btn hc-btn-info hc-btn-sm"
                                    disabled={workingId !== null}
                                    onClick={() => openAssignModal(request)}
                                    title="Phân công nhân viên có ca trực phục vụ"
                                  >
                                    <i className="bi bi-person-gear"></i> Phân công
                                  </button>
                                )}
                                {(request.status === "DELIVERING" || request.status === "IN_PROGRESS") && (
                                  <>
                                    <button
                                      type="button"
                                      className="hc-btn hc-btn-primary hc-btn-sm u-fw-600"
                                      disabled={workingId !== null}
                                      onClick={() => setCompleteTarget(request)}
                                      title="Xác nhận đã giao dịch vụ lên phòng khách thành công"
                                    >
                                      <i className="bi bi-check2-circle"></i> {workingId === request.serviceRequestId ? "Đang xử lý…" : "Hoàn tất"}
                                    </button>
                                    {canManage && (
                                      <button
                                        type="button"
                                        className="hc-btn hc-btn-outline hc-btn-sm"
                                        disabled={workingId !== null}
                                        onClick={() => openAssignModal(request)}
                                        title="Đổi nhân viên phục vụ khác"
                                      >
                                        <i className="bi bi-arrow-repeat"></i> Đổi
                                      </button>
                                    )}
                                  </>
                                )}
                                {canManage && request.status !== "CANCELED" && request.status !== "CANCELLED" && request.status !== "COMPLETED" && (
                                  <button
                                    type="button"
                                    className="hc-btn hc-btn-outline-danger hc-btn-sm"
                                    disabled={workingId !== null}
                                    onClick={() => {
                                      if (window.confirm("Xác nhận hủy yêu cầu dịch vụ này?")) {
                                        updateRequest(request, "cancel");
                                      }
                                    }}
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
                {pager}
              </>
            )}
          </Paginated>
        )}
      </div>

      {/* Xác nhận hoàn tất yêu cầu dịch vụ */}
      <Modal
        isOpen={!!completeTarget}
        onClose={() => workingId === null && setCompleteTarget(null)}
        title="Xác nhận hoàn tất"
        subtitle={completeTarget ? `${completeTarget.serviceName || "Yêu cầu dịch vụ"}${completeTarget.roomNumber ? ` · Phòng ${completeTarget.roomNumber}` : ""}` : undefined}
        icon="bi-check2-circle"
        maxWidth="440px"
        footer={
          <div className="u-actions-end">
            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => setCompleteTarget(null)} disabled={workingId !== null}>
              Hủy
            </button>
            <button type="button" className="hc-btn hc-btn-primary hc-btn-sm" onClick={confirmComplete} disabled={workingId !== null}>
              {workingId !== null ? "Đang xử lý..." : "Xác nhận hoàn tất"}
            </button>
          </div>
        }
      >
        {completeTarget && (
          <div className="u-col-16" style={{ fontSize: "13px" }}>
            <p style={{ margin: 0 }}>
              Xác nhận bạn đã giao <strong>{completeTarget.serviceName || "dịch vụ"}</strong>
              {completeTarget.quantity > 1 ? ` (x${completeTarget.quantity})` : ""} tới <strong>{completeTarget.roomNumber ? `phòng ${completeTarget.roomNumber}` : "khách"}</strong>?
            </p>
            <p className="u-text-secondary" style={{ margin: 0 }}>Yêu cầu sẽ chuyển sang trạng thái Hoàn tất và được tính vào hóa đơn của khách.</p>
          </div>
        )}
      </Modal>

      {/* Modal chi tiết yêu cầu dịch vụ (chỉ xem) */}
      <Modal
        isOpen={!!editTarget}
        onClose={closeEditModal}
        title={`Yêu cầu dịch vụ #${editTarget?.serviceRequestId || ""}`}
        subtitle={editTarget ? `${editTarget.serviceName || "Yêu cầu dịch vụ"}${editTarget.roomNumber ? ` · Phòng ${editTarget.roomNumber}` : ""}` : undefined}
        icon="bi-bell"
        maxWidth="560px"
        headerExtra={
          editTarget ? (
            <span className={`hc-badge ${(STATUS_META[editTarget.status] || { badge: "hc-badge-muted" }).badge}`}>{(STATUS_META[editTarget.status] || { label: editTarget.status }).label}</span>
          ) : null
        }
        footer={
          <div className="u-actions-end">
            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={closeEditModal}>
              Đóng
            </button>
          </div>
        }
      >
        {editTarget && (() => {
          const loyalty = isLoyaltyBenefitRequest(editTarget);
          const rows = [
            ["Dịch vụ", editTarget.serviceName || "—"],
            ["Loại dịch vụ", loyalty === true ? "Ưu đãi hội viên" : loyalty === false ? "Dịch vụ thường" : "Chưa xác định"],
            ["Khách", editTarget.customerName || "—"],
            ["Phòng", editTarget.roomNumber ? `Phòng ${editTarget.roomNumber}` : "—"],
            ["Mã đặt phòng", editTarget.bookingCode ? `#${editTarget.bookingCode}` : "—"],
            ["Số lượng", editTarget.quantity || 1],
            ["Thành tiền", loyalty === true ? "Miễn phí" : formatVND(editTarget.feeAmount || 0)],
            ["Người phục vụ", editTarget.assignedToStaff || "Chưa phân công"],
            ["Yêu cầu lúc", getRequestTime(editTarget) ? formatDateTime(getRequestTime(editTarget)) : "—"],
          ];
          return (
            <div className="u-col-16">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px 18px", fontSize: "13px" }}>
                {rows.map(([label, value]) => (
                  <div key={label}>
                    <small className="u-text-secondary u-block">{label}</small>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
              <div>
                <small className="u-text-secondary u-block">Ghi chú</small>
                <p style={{ margin: "2px 0 0", fontSize: "13px" }}>{editTarget.note || "—"}</p>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Modal Phân công Yêu cầu Dịch vụ */}
      <Modal
        isOpen={assignModalOpen}
        onClose={closeAssignModal}
        title={`Phân công phục vụ — Yêu cầu #${targetRequest?.serviceRequestId || ""}`}
        subtitle={targetRequest ? `${targetRequest.serviceName} · ${targetRequest.roomNumber ? `Phòng ${targetRequest.roomNumber}` : ""}` : undefined}
        icon="bi-bell"
        maxWidth="560px"
      >
        {targetRequest && (
          <div className="u-col-16">
            <div
              style={{
                background: "var(--hc-bg-subtle, #f8fafc)",
                border: "1px solid var(--hc-border-light, #e2e8f0)",
                borderRadius: "8px",
                padding: "14px 16px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "12px",
                fontSize: "0.875rem",
              }}
            >
              <div>
                <span className="u-hint u-block">Dịch vụ</span>
                <strong>{targetRequest.serviceName}</strong> (SL: {targetRequest.quantity || 1})
              </div>
              <div>
                <span className="u-hint u-block">Phòng / Đặt phòng</span>
                <strong>{targetRequest.roomNumber ? `Phòng ${targetRequest.roomNumber}` : "—"}</strong>
                {targetRequest.bookingCode && <span style={{ color: "var(--hc-text-secondary)", marginLeft: "4px" }}>({targetRequest.bookingCode})</span>}
              </div>
              <div>
                <span className="u-hint u-block">Khách hàng</span>
                <strong>{targetRequest.customerName || "—"}</strong>
              </div>
              <div>
                <span className="u-hint u-block">Loại dịch vụ</span>
                <strong>{isLoyaltyBenefitRequest(targetRequest) === true ? "Ưu đãi hội viên" : isLoyaltyBenefitRequest(targetRequest) === false ? "Dịch vụ thường" : "Chưa xác định"}</strong>
              </div>
              <div>
                <span className="u-hint u-block">Thành tiền</span>
                <strong style={{ color: isLoyaltyBenefitRequest(targetRequest) === true ? "var(--hc-success, #16a34a)" : "var(--hc-primary)" }}>
                  {isLoyaltyBenefitRequest(targetRequest) === true ? "Miễn phí" : formatVND(targetRequest.feeAmount || 0)}
                </strong>
              </div>
              {targetRequest.note && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <span className="u-hint u-block">Ghi chú của khách</span>
                  <p style={{ margin: "2px 0 0", fontStyle: "italic", color: "var(--hc-text-muted)" }}>{targetRequest.note}</p>
                </div>
              )}
            </div>

            <div className="hc-form-group">
              <label className="hc-label u-fw-600">
                Nhân viên phục vụ (Đang trong ca trực) <span className="u-text-error">*</span>
              </label>

              {loadingStaff ? (
                <div style={{ padding: "12px 0", color: "var(--hc-text-secondary)", fontSize: "0.875rem" }}>
                  <i className="bi bi-arrow-clockwise admin-schedule-spin u-mr-6"></i>
                  Đang kiểm tra lịch ca trực của nhân viên...
                </div>
              ) : serviceStaff.length === 0 ? (
                <div
                  className="u-notice-warn"
                >
                  <i className="bi bi-exclamation-triangle-fill u-star"></i>
                  <div>
                    <strong>Không có nhân viên trong ca trực:</strong> Hiện tại không có nhân viên phục vụ dịch vụ nào có lịch trực hoạt động theo ca. Vui lòng xếp ca trực tại mục{" "}
                    <strong>Quản lý Lịch làm việc</strong> trước khi phân công.
                  </div>
                </div>
              ) : (
                <SelectMenu value={selectedStaffId} onChange={setSelectedStaffId} options={staffOptions} ariaLabel="Chọn nhân viên phục vụ có ca trực" icon="bi-person-badge" />
              )}
            </div>

            <div className="u-modal-actions">
              <button type="button" className="hc-btn hc-btn-outline" onClick={closeAssignModal} disabled={submittingAssign}>
                Đóng
              </button>
              <button type="button" className="hc-btn hc-btn-primary" onClick={handleConfirmAssign} disabled={submittingAssign || !selectedStaffId || serviceStaff.length === 0}>
                <i className="bi bi-check2-circle"></i>
                {submittingAssign ? "Đang lưu…" : "Xác nhận phân công"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
