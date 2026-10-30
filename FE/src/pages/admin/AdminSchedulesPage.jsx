import React, { useState, useEffect } from 'react';
import Modal from '../../components/Modal';
import { apiCall, formatDate } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const roleCodeOf = (role) => typeof role === 'string' ? role : role?.roleCode || role?.code || '';

export default function AdminSchedulesPage() {
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState('SCHEDULES'); // SCHEDULES | SHIFTS
  const [shifts, setShifts] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Assign Schedule Modal
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({
    accountId: '',
    shiftId: '',
    workDate: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [submittingSchedule, setSubmittingSchedule] = useState(false);

  // Shift Modal (Create / Edit Shift definition)
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [editShiftId, setEditShiftId] = useState(null);
  const [shiftForm, setShiftForm] = useState({
    shiftName: '',
    startTime: '06:00',
    endTime: '14:00',
    description: ''
  });
  const [submittingShift, setSubmittingShift] = useState(false);

  useEffect(() => {
    loadAll();
  }, [activeTab]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [shiftsRes, accountsRes, schedulesRes] = await Promise.all([
        apiCall('/api/admin/shifts', { silentError: true }),
        apiCall('/api/admin/accounts', { silentError: true }),
        apiCall('/api/admin/schedules', { silentError: true })
      ]);

      if (shiftsRes && shiftsRes.success) setShifts(shiftsRes.data || []);
      if (accountsRes && accountsRes.success) {
        const staffList = (accountsRes.data || []).filter(a => roleCodeOf(a.role) !== 'ROLE_CUSTOMER');
        setAccounts(staffList);
      }
      if (schedulesRes && schedulesRes.success) setSchedules(schedulesRes.data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const handleAssignSchedule = async (e) => {
    e.preventDefault();
    if (!assignForm.accountId || !assignForm.shiftId || !assignForm.workDate) {
      addToast('Vui lòng chọn nhân viên, ca làm việc và ngày phân công!', 'warning');
      return;
    }

    setSubmittingSchedule(true);
    try {
      const res = await apiCall('/api/admin/schedules', {
        method: 'POST',
        body: {
          accountId: parseInt(assignForm.accountId),
          shiftId: parseInt(assignForm.shiftId),
          workDate: assignForm.workDate,
          notes: assignForm.notes.trim() || null
        }
      });

      if (res && res.success) {
        addToast('Phân ca làm việc cho nhân viên thành công!', 'success');
        setScheduleModalOpen(false);
        loadAll();
      }
    } catch (err) {
      addToast(err.message || 'Lỗi phân ca làm việc', 'error');
    } finally {
      setSubmittingSchedule(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy phân ca này?')) return;
    try {
      const res = await apiCall(`/api/admin/schedules/${scheduleId}`, { method: 'DELETE' });
      if (res && res.success) {
        addToast('Đã xóa phân ca thành công!', 'success');
        loadAll();
      }
    } catch (err) {
      addToast(err.message || 'Lỗi xóa phân ca', 'error');
    }
  };

  const handleSaveShift = async (e) => {
    e.preventDefault();
    if (!shiftForm.shiftName.trim()) {
      addToast('Vui lòng nhập tên ca làm việc!', 'warning');
      return;
    }

    setSubmittingShift(true);
    const payload = {
      shiftName: shiftForm.shiftName.trim(),
      startTime: shiftForm.startTime,
      endTime: shiftForm.endTime,
      description: shiftForm.description.trim() || null
    };

    try {
      let res;
      if (editShiftId) {
        res = await apiCall(`/api/admin/shifts/${editShiftId}`, { method: 'PUT', body: payload });
      } else {
        res = await apiCall('/api/admin/shifts', { method: 'POST', body: payload });
      }

      if (res && res.success) {
        addToast(`${editShiftId ? 'Cập nhật' : 'Thêm'} ca làm việc thành công!`, 'success');
        setShiftModalOpen(false);
        loadAll();
      }
    } catch (err) {
      addToast(err.message || 'Lỗi lưu ca làm việc', 'error');
    } finally {
      setSubmittingShift(false);
    }
  };

  const handleDeleteShift = async (shiftId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa ca làm việc này?')) return;
    try {
      const res = await apiCall(`/api/admin/shifts/${shiftId}`, { method: 'DELETE' });
      if (res && res.success) {
        addToast('Đã xóa ca thành công!', 'success');
        loadAll();
      }
    } catch (err) {
      addToast(err.message || 'Lỗi xóa ca làm việc', 'error');
    }
  };

  return (
    <div className="ops-page">
      <div className="hc-page-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div className="hc-hero-badge" style={{ marginBottom: '8px' }}>
            <i className="bi bi-calendar2-week-fill"></i> NHÂN SỰ & CA TRỰC
          </div>
          <h2>Quản Lý Phân Ca & Lịch Làm Việc</h2>
          <p>Thiết lập khung giờ các ca làm việc và phân bổ lịch trực cho nhân viên khách sạn</p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {activeTab === 'SCHEDULES' ? (
            <button
              type="button"
              className="hc-btn hc-btn-primary"
              onClick={() => {
                setAssignForm({
                  accountId: accounts[0]?.accountId || accounts[0]?.id || '',
                  shiftId: shifts[0]?.shiftId || '',
                  workDate: new Date().toISOString().split('T')[0],
                  notes: ''
                });
                setScheduleModalOpen(true);
              }}
            >
              <i className="bi bi-person-check-fill"></i> Phân Ca Cho Nhân Viên
            </button>
          ) : (
            <button
              type="button"
              className="hc-btn hc-btn-primary"
              onClick={() => {
                setEditShiftId(null);
                setShiftForm({ shiftName: '', startTime: '06:00', endTime: '14:00', description: '' });
                setShiftModalOpen(true);
              }}
            >
              <i className="bi bi-plus-lg"></i> Thêm Ca Mới
            </button>
          )}
        </div>
      </div>

      <div className="hc-tab-group" style={{ marginBottom: '24px' }}>
        <button
          className={`hc-tab-btn ${activeTab === 'SCHEDULES' ? 'active' : ''}`}
          onClick={() => setActiveTab('SCHEDULES')}
        >
          <i className="bi bi-calendar3"></i> Lịch Phân Công Nhân Viên ({schedules.length})
        </button>
        <button
          className={`hc-tab-btn ${activeTab === 'SHIFTS' ? 'active' : ''}`}
          onClick={() => setActiveTab('SHIFTS')}
        >
          <i className="bi bi-clock"></i> Danh Mục Ca Làm Việc ({shifts.length})
        </button>
      </div>

      {activeTab === 'SCHEDULES' ? (
        /* Schedules Table */
        <div className="hc-card">
          <div className="hc-card-header">
            <div className="hc-card-title">
              <i className="bi bi-calendar-check text-primary" style={{ marginRight: '8px' }}></i>
              Lịch Làm Việc Đã Phân Công ({schedules.length})
            </div>
            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={loadAll}>
              <i className="bi bi-arrow-clockwise"></i> Làm mới
            </button>
          </div>

          <div className="hc-card-body flush">
            {loading ? (
              <div className="hc-loading-spinner">
                <div className="hc-spinner"></div>
              </div>
            ) : schedules.length === 0 ? (
              <div className="hc-empty-state">
                <i className="bi bi-calendar-x"></i>
                <p>Chưa có lịch phân công nào. Nhấn "Phân Ca Cho Nhân Viên" để tạo lịch mới.</p>
              </div>
            ) : (
              <table className="hc-table">
                <thead>
                  <tr>
                    <th>Ngày làm việc</th>
                    <th>Nhân viên</th>
                    <th>Vai trò</th>
                    <th>Ca trực</th>
                    <th>Thời gian</th>
                    <th>Ghi chú</th>
                    <th style={{ textAlign: 'right' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map(sch => (
                    <tr key={sch.scheduleId}>
                      <td>
                        <strong>{formatDate(sch.workDate)}</strong>
                      </td>
                      <td>
                        <strong>{sch.fullName || sch.username}</strong>
                      </td>
                      <td>
                        <span className="hc-badge hc-badge-primary">
                          {roleCodeOf(sch.role).replace('ROLE_', '') || '—'}
                        </span>
                      </td>
                      <td>
                        <span className="hc-badge hc-badge-warning">
                          {sch.shiftName}
                        </span>
                      </td>
                      <td>{sch.startTime} - {sch.endTime}</td>
                      <td style={{ color: 'var(--hc-text-secondary)', fontSize: '13px' }}>
                        {sch.notes || '---'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="hc-btn hc-btn-ghost hc-btn-sm"
                          style={{ color: 'var(--hc-error)' }}
                          onClick={() => handleDeleteSchedule(sch.scheduleId)}
                        >
                          <i className="bi bi-trash"></i> Hủy
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        /* Shifts Definition Table */
        <div className="hc-card">
          <div className="hc-card-header">
            <div className="hc-card-title">
              <i className="bi bi-clock-history text-primary" style={{ marginRight: '8px' }}></i>
              Định Nghĩa Các Khung Ca Trực ({shifts.length})
            </div>
          </div>

          <div className="hc-card-body flush">
            {loading ? (
              <div className="hc-loading-spinner">
                <div className="hc-spinner"></div>
              </div>
            ) : shifts.length === 0 ? (
              <div className="hc-empty-state">
                <i className="bi bi-clock"></i>
                <p>Chưa có ca làm việc nào được định nghĩa.</p>
              </div>
            ) : (
              <table className="hc-table">
                <thead>
                  <tr>
                    <th>Tên ca</th>
                    <th>Giờ bắt đầu</th>
                    <th>Giờ kết thúc</th>
                    <th>Mô tả ca trực</th>
                    <th style={{ textAlign: 'right' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.map(s => (
                    <tr key={s.shiftId}>
                      <td>
                        <strong>{s.shiftName}</strong>
                      </td>
                      <td>
                        <span className="hc-badge hc-badge-info">{s.startTime}</span>
                      </td>
                      <td>
                        <span className="hc-badge hc-badge-info">{s.endTime}</span>
                      </td>
                      <td style={{ color: 'var(--hc-text-secondary)' }}>{s.description || '---'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="hc-btn hc-btn-outline hc-btn-sm"
                            onClick={() => {
                              setEditShiftId(s.shiftId);
                              setShiftForm({
                                shiftName: s.shiftName,
                                startTime: s.startTime,
                                endTime: s.endTime,
                                description: s.description || ''
                              });
                              setShiftModalOpen(true);
                            }}
                          >
                            <i className="bi bi-pencil"></i> Sửa
                          </button>
                          <button
                            type="button"
                            className="hc-btn hc-btn-ghost hc-btn-sm"
                            style={{ color: 'var(--hc-error)' }}
                            onClick={() => handleDeleteShift(s.shiftId)}
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Assign Schedule Modal */}
      <Modal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        title="Phân Ca Làm Việc Cho Nhân Viên"
        maxWidth="500px"
        footer={
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => setScheduleModalOpen(false)}>
              Hủy
            </button>
            <button
              type="button"
              className="hc-btn hc-btn-primary hc-btn-sm"
              onClick={handleAssignSchedule}
              disabled={submittingSchedule}
            >
              {submittingSchedule ? 'Đang phân ca...' : 'Lưu lịch trực'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleAssignSchedule}>
          <div className="hc-form-group">
            <label className="hc-label">Chọn nhân viên <span style={{ color: 'var(--hc-error)' }}>*</span></label>
            <select
              className="hc-select"
              value={assignForm.accountId}
              onChange={(e) => setAssignForm({ ...assignForm, accountId: e.target.value })}
              required
            >
              <option value="">-- Chọn nhân viên --</option>
              {accounts.map(a => (
                <option key={a.accountId || a.id} value={a.accountId || a.id}>
                  {a.fullName || a.username} ({roleCodeOf(a.role).replace('ROLE_', '') || '—'})
                </option>
              ))}
            </select>
          </div>

          <div className="hc-form-group">
            <label className="hc-label">Chọn ca trực <span style={{ color: 'var(--hc-error)' }}>*</span></label>
            <select
              className="hc-select"
              value={assignForm.shiftId}
              onChange={(e) => setAssignForm({ ...assignForm, shiftId: e.target.value })}
              required
            >
              <option value="">-- Chọn ca trực --</option>
              {shifts.map(s => (
                <option key={s.shiftId} value={s.shiftId}>
                  {s.shiftName} ({s.startTime} - {s.endTime})
                </option>
              ))}
            </select>
          </div>

          <div className="hc-form-group">
            <label className="hc-label">Ngày làm việc <span style={{ color: 'var(--hc-error)' }}>*</span></label>
            <input
              type="date"
              className="hc-input"
              value={assignForm.workDate}
              onChange={(e) => setAssignForm({ ...assignForm, workDate: e.target.value })}
              required
            />
          </div>

          <div className="hc-form-group">
            <label className="hc-label">Ghi chú phân công</label>
            <input
              type="text"
              className="hc-input"
              placeholder="Ví dụ: Trực quầy chính sảnh..."
              value={assignForm.notes}
              onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      {/* Shift Definition Modal */}
      <Modal
        isOpen={shiftModalOpen}
        onClose={() => setShiftModalOpen(false)}
        title={editShiftId ? 'Chỉnh Sửa Ca Làm Việc' : 'Tạo Ca Làm Việc Mới'}
        maxWidth="500px"
        footer={
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
            <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={() => setShiftModalOpen(false)}>
              Hủy
            </button>
            <button
              type="button"
              className="hc-btn hc-btn-primary hc-btn-sm"
              onClick={handleSaveShift}
              disabled={submittingShift}
            >
              {submittingShift ? 'Đang lưu...' : 'Lưu ca'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleSaveShift}>
          <div className="hc-form-group">
            <label className="hc-label">Tên ca làm việc <span style={{ color: 'var(--hc-error)' }}>*</span></label>
            <input
              type="text"
              className="hc-input"
              placeholder="ví dụ: Ca Sáng, Ca Chiều, Ca Đêm..."
              value={shiftForm.shiftName}
              onChange={(e) => setShiftForm({ ...shiftForm, shiftName: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="hc-form-group">
              <label className="hc-label">Giờ bắt đầu</label>
              <input
                type="time"
                className="hc-input"
                value={shiftForm.startTime}
                onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })}
                required
              />
            </div>
            <div className="hc-form-group">
              <label className="hc-label">Giờ kết thúc</label>
              <input
                type="time"
                className="hc-input"
                value={shiftForm.endTime}
                onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="hc-form-group">
            <label className="hc-label">Mô tả nhiệm vụ</label>
            <textarea
              className="hc-textarea"
              rows="2"
              placeholder="Mô tả công việc trong ca..."
              value={shiftForm.description}
              onChange={(e) => setShiftForm({ ...shiftForm, description: e.target.value })}
            ></textarea>
          </div>
        </form>
      </Modal>
    </div>
  );
}
