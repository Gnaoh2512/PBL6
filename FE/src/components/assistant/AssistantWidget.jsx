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

const SUGGESTION_PROMPTS = {
  FAQ: 'Wi-Fi ở đâu?',
  'Chính sách': 'Chính sách đặt cọc và hủy phòng thế nào?',
  'Phòng': 'Tìm phòng trống cho 2 khách',
  'Giá phòng': 'Kiểm tra giá phòng cho 2 khách',
  'Dịch vụ': 'Khách sạn hiện có những dịch vụ nào và giá bao nhiêu?',
  'Booking của tôi': 'Xem danh sách đơn đặt phòng của tôi',
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
  const { token } = useAuth();
  const { pathname } = useLocation();
  if (import.meta.env.VITE_ASSISTANT_ENABLED !== 'true') return null;
  if (pathname.startsWith('/admin') || pathname.startsWith('/staff')) return null;
  return <AssistantChat key={token || 'guest'} routeKey={pathname} />;
}

export function AssistantChat({ routeKey = '' }) {
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
  function suggestion(label) {
    if (SUGGESTION_PROMPTS[label]) {
      setError('');
      setInput(SUGGESTION_PROMPTS[label]);
      composer.current?.focus();
    } else {
      setError('Chức năng tra cứu booking cá nhân chưa được hỗ trợ ở phiên bản hiện tại. Bạn có thể dùng màn hình nghiệp vụ hiện có.');
    }
  }
  return <aside className="assistant-widget" ref={widget} aria-label="Trợ lý khách sạn">
    {open && <section id="assistant-panel" className="assistant-panel" role="region" aria-label="Hội thoại trợ lý"
      onKeyDown={event => { if (event.key === 'Escape') close(); }}>
      <header><div><strong>Trợ lý khách sạn</strong><small>Hỗ trợ FAQ, phòng, dịch vụ &amp; booking</small></div>
        <button type="button" onClick={close} aria-label="Thu gọn trợ lý">×</button></header>
      {mode === 'demo_synthetic' && <p className="assistant-demo" role="note">Dữ liệu giả lập — chỉ dùng demo</p>}
      {!mode && <p className="assistant-note">Hỗ trợ FAQ có nguồn, phòng trống, dịch vụ và đơn đặt phòng cá nhân (khi đã đăng nhập).</p>}
      <div className="assistant-suggestions">{['FAQ', 'Phòng', 'Giá phòng', 'Dịch vụ', 'Booking của tôi', 'Chính sách'].map(label =>
        <button key={label} type="button" disabled={busy} onClick={() => suggestion(label)}>{label}</button>)}</div>
      <div className="assistant-messages" ref={list} role="log" aria-label="Tin nhắn" aria-live="polite"
        onScroll={event => { const el = event.currentTarget; stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40; }}>
        {messages.length === 0 && <p>Xin chào! Tôi hỗ trợ tra cứu FAQ, tìm phòng trống và danh mục dịch vụ khách sạn.</p>}
        {messages.map((item, i) => <article key={i} className={`assistant-message ${item.role}`}>
          <strong>{item.role === 'user' ? 'Bạn' : 'Trợ lý'}</strong><p>{item.text}</p>
          {item.cards?.length > 0 && <div className="assistant-cards" aria-label="Kết quả nghiệp vụ">
            {item.cards.map((card, idx) => <AssistantCard key={`${card.type}-${idx}`} card={card} />)}
          </div>}
          {item.actions?.length > 0 && <div className="assistant-actions" aria-label="Hành động gợi ý">
            {item.actions.map((action, idx) => (
              <SafeNavLink key={`${action.type}-${idx}`} to={ACTION_ROUTES[action.type]} className="assistant-action-link">
                {action.label}
              </SafeNavLink>
            ))}
          </div>}
          {item.citations?.length > 0 && <ul aria-label="Nguồn">{item.citations.map(citation =>
            <li key={citation.citationId}>{citation.title} · {citation.sectionId} · v{citation.version}</li>)}</ul>}
        </article>)}
        {busy && <p role="status">Đang tra cứu… <button type="button" onClick={() => request.current?.abort()}>Hủy</button></p>}
      </div>
      {error && <p className="assistant-error" role="alert">{error}</p>}
      <form onSubmit={send}><label className="visually-hidden" htmlFor="assistant-input">Câu hỏi</label>
        <input id="assistant-input" ref={composer} value={input} onChange={e => setInput(e.target.value)} maxLength={2000} placeholder="Nhập câu hỏi…" disabled={busy} />
        <button type="submit" disabled={busy || !input.trim()}>Gửi</button></form>
    </section>}
    <button type="button" className="assistant-launcher" ref={launcher} aria-controls="assistant-panel" aria-expanded={open}
      onClick={() => open ? close() : setOpen(true)}>Trợ lý</button>
  </aside>;
}
