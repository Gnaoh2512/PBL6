import React, { useEffect, useRef, useState } from 'react';
import { Link, useInRouterContext, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { apiCall, waitForAssistantSessionReset } from '../../services/api';
import './AssistantWidget.css';

const ALLOWED_STATUSES = [
  'answered',
  'needs_clarification',
  'no_results',
  'requires_login',
  'insufficient_evidence',
  'capability_unavailable',
];

const ACTION_ROUTES = {
  open_room_search: '/booking',
  open_services: '/guest/services',
  open_login: '/login',
};

const PUBLIC_QUICK_PILLS = [
  {
    id: 'rooms',
    label: 'Giá phòng hiện tại?',
    prompt: 'Tìm phòng trống và giá hiện tại cho 2 khách',
    icon: 'bed',
  },
  {
    id: 'services',
    label: 'Các tiện ích khách sạn?',
    prompt: 'Khách sạn hiện có những dịch vụ nào và giá bao nhiêu?',
    icon: 'star',
  },
  {
    id: 'policy',
    label: 'Chính sách đặt phòng?',
    prompt: 'Chính sách hủy đặt phòng hoàn cọc thế nào?',
    icon: 'doc',
  },
];

const GUEST_FOURTH_PILL = {
  id: 'checkin',
  label: 'Quy định nhận / trả phòng?',
  prompt: 'Giờ nhận phòng tiêu chuẩn và phí nhận phòng sớm tính thế nào?',
  icon: 'clock',
};

const CUSTOMER_FOURTH_PILL = {
  id: 'bookings',
  label: 'Đơn đặt phòng của tôi',
  prompt: 'Xem danh sách đơn đặt phòng của tôi',
  icon: 'booking',
};

const BOOKING_STATUS_LABELS = {
  PENDING_DEPOSIT: 'Chờ cọc',
  CONFIRMED: 'Đã xác nhận',
  CHECKED_IN: 'Đang lưu trú',
  CHECKED_OUT: 'Đã trả phòng',
  CANCELED: 'Đã hủy',
  EXPIRED: 'Đã hết hạn',
};

function formatVnd(raw) {
  if (typeof raw !== 'string' && typeof raw !== 'number') return '';
  const text = String(raw).trim();
  if (!/^(0|[1-9][0-9]*)(\.[0-9]{1,2})?$/.test(text)) return text;
  const [intPart, fracPart] = text.split('.');
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return fracPart ? `${formattedInt},${fracPart} VND` : `${formattedInt} VND`;
}

function formatRetrievedAt(iso) {
  if (typeof iso !== 'string' || !iso) return '';
  return iso.replace('T', ' ').replace(/\+07:00$/, ' (GMT+7)');
}

function SafeNavLink({ to, className, children, onClick }) {
  const inRouter = useInRouterContext();
  if (inRouter) {
    return <Link to={to} className={className} onClick={onClick}>{children}</Link>;
  }
  return <a href={to} className={className} onClick={onClick}>{children}</a>;
}

function buildRoomBookingHref(room) {
  const params = new URLSearchParams();
  if (Number.isInteger(room?.roomId) && room.roomId > 0) params.set('roomId', String(room.roomId));
  if (typeof room?.checkInDate === 'string') params.set('checkIn', room.checkInDate);
  if (typeof room?.checkOutDate === 'string') params.set('checkOut', room.checkOutDate);
  const query = params.toString();
  return query ? `/booking?${query}` : '/booking';
}

function LotusLogo() {
  return (
    <svg className="assistant-logo-svg" viewBox="0 0 36 26" width="28" height="20" fill="none" aria-hidden="true">
      <path d="M18 3C15.5 7.5 14.5 13 18 19.5C21.5 13 20.5 7.5 18 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M18 19.5C13.5 16.5 10.5 12 10 6.5C14.5 8.5 17 13.2 18 19.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M18 19.5C22.5 16.5 25.5 12 26 6.5C21.5 8.5 19 13.2 18 19.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M18 19.5C12.2 19.5 7.5 16.5 4 12C9 12 13.8 14.8 18 19.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M18 19.5C23.8 19.5 28.5 16.5 32 12C27 12 22.2 14.8 18 19.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7 22.5C11.2 21.5 14.5 23.2 18 22.5C21.5 21.8 24.8 23.2 29 22.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function ConciergeAvatar({ compact = false }) {
  return (
    <span className={compact ? 'assistant-avatar assistant-avatar-sm' : 'assistant-avatar'} aria-hidden="true">
      <svg viewBox="0 0 48 48" width={compact ? 22 : 44} height={compact ? 22 : 44} fill="none">
        <circle cx="24" cy="24" r="22" fill="#e8f3f8" />
        <line x1="24" y1="8" x2="24" y2="13" stroke="#3c7d8e" strokeWidth="2" strokeLinecap="round" />
        <circle cx="24" cy="7" r="2.2" fill="#58b4cc" />
        <rect x="11" y="13" width="26" height="19" rx="9.5" fill="#ffffff" stroke="#b9d4dd" strokeWidth="1.6" />
        <rect x="14.5" y="17" width="19" height="11" rx="5.5" fill="#173a47" />
        <circle cx="20" cy="22.5" r="2.2" fill="#7ce3f8" />
        <circle cx="28" cy="22.5" r="2.2" fill="#7ce3f8" />
        <path d="M21 25.6C22.4 26.8 25.6 26.8 27 25.6" stroke="#7ce3f8" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M16 37.5C16 34.4 19.4 33 24 33C28.6 33 32 34.4 32 37.5" fill="#ffffff" stroke="#b9d4dd" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="9.5" cy="22.5" r="2" fill="#78b7c7" />
        <circle cx="38.5" cy="22.5" r="2" fill="#78b7c7" />
      </svg>
    </span>
  );
}

function PillIcon({ name }) {
  if (name === 'bed') {
    return (
      <svg className="assistant-pill-icon icon-bed" viewBox="0 0 20 20" width="17" height="17" fill="none" aria-hidden="true">
        <path d="M3 14.5V6.5M3 11.5H17V14.5M17 11.5V9.5C17 8.4 16.1 7.5 15 7.5H9.5V11.5M7 9.5C7 8.7 6.3 8 5.5 8C4.7 8 4 8.7 4 9.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === 'star') {
    return (
      <svg className="assistant-pill-icon icon-star" viewBox="0 0 20 20" width="17" height="17" fill="currentColor" aria-hidden="true">
        <path d="M10 2.5L12.3 7.2L17.5 7.9L13.7 11.6L14.6 16.8L10 14.3L5.4 16.8L6.3 11.6L2.5 7.9L7.7 7.2L10 2.5Z" />
      </svg>
    );
  }
  if (name === 'doc') {
    return (
      <svg className="assistant-pill-icon icon-doc" viewBox="0 0 20 20" width="17" height="17" fill="none" aria-hidden="true">
        <path d="M6 2.8H11.5L15 6.3V16.2C15 16.8 14.5 17.2 14 17.2H6C5.4 17.2 5 16.8 5 16.2V3.8C5 3.2 5.4 2.8 6 2.8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M7.5 10H12.5M7.5 13H11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === 'clock') {
    return (
      <svg className="assistant-pill-icon icon-clock" viewBox="0 0 20 20" width="17" height="17" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 6.2V10L12.6 11.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg className="assistant-pill-icon icon-booking" viewBox="0 0 20 20" width="17" height="17" fill="none" aria-hidden="true">
      <rect x="3.5" y="4.5" width="13" height="12" rx="2.2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 2.8V5.5M13 2.8V5.5M3.5 8.5H16.5M7.5 12H10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function LauncherBubbleIcon() {
  return (
    <svg viewBox="0 0 28 28" width="26" height="26" fill="none" aria-hidden="true">
      <path d="M14 4C8.48 4 4 7.96 4 12.85C4 15.65 5.48 18.14 7.8 19.76L6.7 23.6L10.95 21.38C11.92 21.6 12.94 21.7 14 21.7C19.52 21.7 24 17.74 24 12.85C24 7.96 19.52 4 14 4Z" fill="currentColor" />
      <circle cx="10.2" cy="12.9" r="1.45" fill="#1b5e6b" />
      <circle cx="14" cy="12.9" r="1.45" fill="#1b5e6b" />
      <circle cx="17.8" cy="12.9" r="1.45" fill="#1b5e6b" />
    </svg>
  );
}

function SendPlaneIcon() {
  return (
    <svg viewBox="0 0 20 20" width="17" height="17" fill="none" aria-hidden="true">
      <path d="M17.5 3.2L9.2 11.5M17.5 3.2L12.1 17.2L9.2 11.5L3.2 8.7L17.5 3.2Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true">
      <path d="M8 1.6L13.2 3.7V7.7C13.2 10.9 11 13.4 8 14.4C5 13.4 2.8 10.9 2.8 7.7V3.7L8 1.6Z" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M5.7 8.1L7.3 9.7L10.4 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AssistantCard({ card }) {
  if (!card || typeof card !== 'object' || !card.data || typeof card.data !== 'object') return null;
  if (card.type === 'room') {
    const room = card.data;
    return (
      <div className="assistant-card assistant-card-room">
        <div className="assistant-card-head">
          <strong>{room.typeName}</strong>
          <span>Tối đa {room.capacity} khách</span>
        </div>
        <p className="assistant-card-meta">
          {room.checkInDate} → {room.checkOutDate} · {room.nights} đêm
        </p>
        <p className="assistant-card-price">
          {formatVnd(room.pricePerNight)}/đêm · Tiền phòng dự kiến: <strong>{formatVnd(room.totalRoomCharge)}</strong>
        </p>
        <p className="assistant-card-meta">
          Cọc dự kiến ({room.depositPercentage}%): {formatVnd(room.estimatedDeposit)}
        </p>
        <p className="assistant-card-disclaimer">
          Giá phòng dự kiến · Chưa gồm VAT &amp; dịch vụ
        </p>
        <div className="assistant-card-footer">
          {card.retrievedAt && <small>Cập nhật: {formatRetrievedAt(card.retrievedAt)}</small>}
          <SafeNavLink to={buildRoomBookingHref(room)} className="assistant-action-link">
            Chọn phòng
          </SafeNavLink>
        </div>
      </div>
    );
  }
  if (card.type === 'service') {
    const svc = card.data;
    return (
      <div className="assistant-card assistant-card-service">
        <div className="assistant-card-head">
          <strong>{svc.serviceName}</strong>
          <span>{svc.categoryName}</span>
        </div>
        <p className="assistant-card-price">
          <strong>{formatVnd(svc.unitPrice)}</strong> / {svc.unit}
        </p>
        {card.retrievedAt && (
          <div className="assistant-card-footer">
            <small>Cập nhật: {formatRetrievedAt(card.retrievedAt)}</small>
          </div>
        )}
      </div>
    );
  }
  if (card.type === 'booking') {
    const bk = card.data;
    const statusLabel = BOOKING_STATUS_LABELS[bk.bookingStatus] || bk.bookingStatus;
    const hasFinancials = bk.depositRequired != null || bk.depositPaid != null
      || bk.totalAmount != null || bk.remainingBalance != null;
    return (
      <div className="assistant-card assistant-card-booking">
        <div className="assistant-card-head">
          <strong>{bk.bookingCode}</strong>
          <span className="assistant-status-badge">{statusLabel}</span>
        </div>
        {bk.roomTypeName && <p className="assistant-card-meta">{bk.roomTypeName}</p>}
        <p className="assistant-card-meta">
          {bk.checkInDate} → {bk.checkOutDate} · {bk.nights} đêm · {bk.guestCount} khách
        </p>
        {hasFinancials && (
          <p className="assistant-card-price">
            {bk.totalAmount != null && <>Tổng: <strong>{formatVnd(bk.totalAmount)}</strong> · </>}
            {bk.depositPaid != null && <>Đã cọc: {formatVnd(bk.depositPaid)} · </>}
            {bk.remainingBalance != null && <>Còn lại: <strong>{formatVnd(bk.remainingBalance)}</strong></>}
          </p>
        )}
        {card.retrievedAt && (
          <div className="assistant-card-footer">
            <small>Cập nhật: {formatRetrievedAt(card.retrievedAt)}</small>
          </div>
        )}
      </div>
    );
  }
  return null;
}

export default function AssistantWidget() {
  const { token, isAuthenticated, hasRole } = useAuth();
  const { pathname } = useLocation();
  if (import.meta.env.VITE_ASSISTANT_ENABLED !== 'true') return null;
  if (pathname.startsWith('/admin') || pathname.startsWith('/staff')) return null;
  const isCustomer = Boolean(isAuthenticated ?? token) && (typeof hasRole === 'function' ? hasRole(['CUSTOMER']) : false);
  return <AssistantChat key={token || 'guest'} routeKey={pathname} isCustomer={isCustomer} />;
}

export function AssistantChat({ routeKey = '', isCustomer = false }) {
  const quickPills = [...PUBLIC_QUICK_PILLS, isCustomer ? CUSTOMER_FOURTH_PILL : GUEST_FOURTH_PILL];
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('');
  const conversation = useRef(null);
  const request = useRef(null);
  const launcher = useRef(null);
  const widget = useRef(null);
  const composer = useRef(null);
  const list = useRef(null);
  const stickToBottom = useRef(true);
  const active = useRef(true);
  const pending = useRef(false);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; request.current?.abort(); };
  }, []);
  useEffect(() => { if (open) composer.current?.focus(); }, [open]);
  useEffect(() => {
    const avoidActions = () => {
      if (!launcher.current || !widget.current) return;
      const box = launcher.current.getBoundingClientRect();
      const old = parseFloat(widget.current.style.getPropertyValue('--assistant-clearance')) || 0;
      const top = box.top + old, bottom = box.bottom + old;
      let clearance = 0;
      document.querySelectorAll('a[href="/booking"], .search-rooms, .booking-search-card button, .booking-customer-card button').forEach(action => {
        const rect = action.getBoundingClientRect();
        if (rect.width && rect.left < box.right && rect.right > box.left && rect.top < bottom && rect.bottom > top)
          clearance = Math.max(clearance, bottom - rect.top + 12);
      });
      widget.current.style.setProperty('--assistant-clearance', `${clearance}px`);
    };
    avoidActions();
    window.addEventListener('scroll', avoidActions, { passive: true });
    window.addEventListener('resize', avoidActions);
    return () => { window.removeEventListener('scroll', avoidActions); window.removeEventListener('resize', avoidActions); };
  }, [open, routeKey]);
  useEffect(() => {
    if (!open) return undefined;
    const escape = event => {
      if (event.key === 'Escape') { setOpen(false); launcher.current?.focus(); }
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [open]);
  useEffect(() => {
    if (stickToBottom.current && list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [messages, busy]);

  function close() { setOpen(false); launcher.current?.focus(); }
  async function send(event) {
    event.preventDefault();
    const message = input.trim();
    if (!message || pending.current) return;
    pending.current = true; setBusy(true); setError(''); setInput('');
    setMessages(old => [...old, { role: 'user', text: message }]);
    const controller = new AbortController(); request.current = controller;
    const timer = setTimeout(() => controller.abort(), 22000);
    try {
      await waitForAssistantSessionReset();
      if (!active.current || controller.signal.aborted) return;
      const result = await apiCall('/api/assistant/chat', {
        method: 'POST', credentials: 'same-origin', signal: controller.signal,
        body: { conversationId: conversation.current, clientMessageId: crypto.randomUUID(), message },
        silentError: true
      });
      if (!active.current || controller.signal.aborted) return;
      const data = result?.data;
      const cards = data?.cards === undefined ? [] : data.cards;
      const actions = data?.actions === undefined ? [] : data.actions;
      if (!result?.success || !data || !ALLOWED_STATUSES.includes(data.status)
          || !['production', 'demo_synthetic'].includes(data.corpusMode) || typeof data.answer !== 'string'
          || !Array.isArray(data.citations) || !Array.isArray(cards) || !Array.isArray(actions))
        throw new Error('Phản hồi trợ lý không hợp lệ.');
      conversation.current = data.conversationId; setMode(data.corpusMode);
      setMessages(old => [...old, {
        role: 'assistant',
        status: data.status,
        text: data.answer,
        citations: data.citations,
        cards,
        actions: actions.filter(a => a && typeof a.type === 'string' && ACTION_ROUTES[a.type] && typeof a.label === 'string'),
      }]);
    } catch (failure) {
      if (!active.current) return;
      if (failure.code === 'CONVERSATION_NOT_FOUND') conversation.current = null;
      setError(failure.name === 'AbortError' ? 'Yêu cầu đã hủy hoặc hết thời gian chờ.' : failure.message);
    } finally {
      clearTimeout(timer); pending.current = false;
      if (active.current) setBusy(false);
    }
  }

  function pickSuggestion(prompt) {
    setError('');
    setInput(prompt);
    composer.current?.focus();
  }

  return (
    <aside className="assistant-widget" ref={widget} aria-label="Trợ lý khách sạn">
      {open && (
        <section
          id="assistant-panel"
          className="assistant-panel"
          role="region"
          aria-label="Hội thoại trợ lý"
          onKeyDown={event => { if (event.key === 'Escape') close(); }}
        >
          <header className="assistant-header">
            <div className="assistant-brand">
              <LotusLogo />
              <span className="assistant-brand-name">AZURE BAY</span>
            </div>
            <div className="assistant-header-controls">
              <button type="button" onClick={close} aria-label="Thu gọn trợ lý" title="Thu gọn">
                <span aria-hidden="true">−</span>
              </button>
              <button type="button" onClick={close} aria-label="Đóng trợ lý" title="Đóng">
                <span aria-hidden="true">×</span>
              </button>
            </div>
          </header>

          {mode === 'demo_synthetic' && (
            <p className="assistant-demo" role="note">Dữ liệu giả lập — chỉ dùng demo</p>
          )}

          <div
            className="assistant-messages"
            ref={list}
            role="log"
            aria-label="Tin nhắn"
            aria-live="polite"
            onScroll={event => {
              const el = event.currentTarget;
              stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
            }}
          >
            {messages.length === 0 ? (
              <div className="assistant-welcome">
                <div className="assistant-welcome-hero">
                  <ConciergeAvatar />
                  <div className="assistant-welcome-copy">
                    <strong>Xin chào! 👋</strong>
                    <p>Tôi là AI Concierge của Azure Bay. Bạn cần hỗ trợ gì hôm nay?</p>
                  </div>
                </div>
                <div className="assistant-pill-list">
                  {quickPills.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      className="assistant-pill-btn"
                      disabled={busy}
                      onClick={() => pickSuggestion(item.prompt)}
                    >
                      <PillIcon name={item.icon} />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((item, i) => (
                  <article key={i} className={`assistant-message ${item.role}`}>
                    {item.role === 'assistant' && (
                      <div className="assistant-msg-sender">
                        <ConciergeAvatar compact />
                        <strong>AI Concierge</strong>
                      </div>
                    )}
                    <p className="assistant-msg-text">{item.text}</p>
                    {item.cards?.length > 0 && (
                      <div className="assistant-cards" aria-label="Kết quả nghiệp vụ">
                        {item.cards.map((card, idx) => <AssistantCard key={`${card.type}-${idx}`} card={card} />)}
                      </div>
                    )}
                    {item.actions?.length > 0 && (
                      <div className="assistant-actions" aria-label="Hành động gợi ý">
                        {item.actions.map((action, idx) => (
                          <SafeNavLink
                            key={`${action.type}-${idx}`}
                            to={ACTION_ROUTES[action.type]}
                            className="assistant-action-link"
                          >
                            {action.label}
                          </SafeNavLink>
                        ))}
                      </div>
                    )}
                    {item.citations?.length > 0 && (
                      <ul className="assistant-citations" aria-label="Nguồn">
                        {item.citations.map(citation => (
                          <li key={citation.citationId}>
                            {citation.title} · {citation.sectionId} · v{citation.version}
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                ))}
              </>
            )}
            {busy && (
              <p className="assistant-loading" role="status">
                <span className="assistant-dots" aria-hidden="true"><i /><i /><i /></span>
                Đang tra cứu…
                <button type="button" onClick={() => request.current?.abort()}>Hủy</button>
              </p>
            )}
          </div>

          {error && <p className="assistant-error" role="alert">{error}</p>}

          <div className="assistant-composer-wrap">
            <form className="assistant-composer" onSubmit={send}>
              <label className="visually-hidden" htmlFor="assistant-input">Câu hỏi</label>
              <input
                id="assistant-input"
                ref={composer}
                value={input}
                onChange={e => setInput(e.target.value)}
                maxLength={2000}
                placeholder="Nhập câu hỏi của bạn..."
                disabled={busy}
              />
              <button
                type="submit"
                className="assistant-send-btn"
                aria-label="Gửi"
                disabled={busy || !input.trim()}
              >
                <SendPlaneIcon />
              </button>
            </form>
            <p className="assistant-trust-note">
              <ShieldCheckIcon />
              <span>
                {mode === 'demo_synthetic'
                  ? 'Thông tin từ nguồn demo đã cấu hình · Chỉ dùng cho demo'
                  : 'Thông tin được trích xuất từ nguồn chính thức của khách sạn'}
              </span>
            </p>
          </div>
        </section>
      )}

      <button
        type="button"
        className="assistant-launcher"
        ref={launcher}
        aria-label="Trợ lý"
        aria-controls="assistant-panel"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <LauncherBubbleIcon />
      </button>
    </aside>
  );
}
