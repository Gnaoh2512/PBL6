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

function AzureBayLogo() {
  return (
    <span className="assistant-logo-badge" aria-hidden="true">
      <svg className="assistant-logo-svg" viewBox="0 0 777 494" width="32" height="20" fill="none">
        <path
          d="M664.18 172.49C660.84 170.07 658.2 166.24 655.23 163.34C650.78 159.01 645.72 154.98 640.76 151.24C626.53 140.5 609.5 132.3 592.54 127.01C572.17 120.66 550.97 117.51 529.59 117.83C464.07 118.82 407.41 152.29 361.81 196.96C342.98 215.41 327.95 237.29 309.82 256.37C291.27 275.9 269.48 292.83 246.44 306.69C195.68 337.24 131.27 356.22 72.52 340.08C58.8 336.31 46.03 331.18 33.76 323.89C29.52 321.37 22.75 317.77 20.14 313.57C22.87 313.94 25.47 315.63 28.07 316.58C34.73 319 41.58 321.19 48.5 322.66C70.87 327.43 94.99 326.98 117.19 321.54C181.47 305.8 236.39 261.8 283.11 216.66C310.06 190.61 336.35 162.9 367.03 141.12C399.64 117.97 435.46 100.4 474.77 92.27C527.8 81.29 594.04 92.91 634.37 131.02C643.55 139.69 651.63 148.98 658.13 159.86C660.21 163.34 664.38 168.4 664.18 172.49ZM477.36 272.97C477.38 273.31 477.4 273.65 477.42 273.99C476.68 274.74 475.93 275.49 475.19 276.25C475.74 276.32 476.28 276.39 476.83 276.46C472.18 280.11 467.52 283.77 462.86 287.43C462.23 294.05 464.47 301.57 465.74 308.06C468.33 321.25 470.96 334.59 475.21 347.37C477.21 353.4 480.89 359.45 482.24 365.6C480.58 369.08 475.92 371.89 472.86 374.18C465.49 379.68 453.05 389.07 444.2 391.12C440.99 387.15 438.28 374.27 435.7 368.69C427.92 351.9 413.46 338.45 396.07 332.04C377.03 325.02 356.61 325.84 337.18 330.6C333.16 331.58 323.5 333.02 320.49 335.47C316.7 338.54 310.16 349.94 306.69 354.49C298.31 365.47 288.13 375.03 276.55 382.56C240.55 405.95 189.89 408.76 149.95 394.96C140.1 391.56 122.53 384.97 114.89 378.04C117.81 377.33 125.75 380.8 129.3 381.54C138.85 383.55 148.85 384.89 158.62 384.89C193.86 384.88 226.19 371.79 254.56 351.51C278.83 334.14 299.61 311.87 319.24 289.55C333.61 273.23 348.05 256.91 362.81 240.95C378.33 224.17 393.59 207.32 411.08 192.52C425.73 180.13 440.8 168.35 458.01 159.7C462.51 157.44 471.7 151.54 476.41 152.4C457.34 175.8 458.22 219.24 458.92 248.01C459.12 256.29 459.55 264.68 460.71 272.88C461.11 275.73 460.75 279.5 462.3 281.87C467.32 278.9 472.34 275.93 477.36 272.97ZM421.02 323.18C421.97 317.26 418.07 307.11 417.09 300.74C414.24 282.38 411.35 263.77 411.22 245.15C411.18 239.37 411.49 233.39 410.92 227.64C410.72 225.59 409.63 222.4 407.4 221.75C404.48 220.89 401.37 223.05 399.17 224.73C392.9 229.5 387.73 236.21 382.9 242.38C367.61 261.91 353.52 282.42 340.65 303.62C337.48 308.84 334.2 314.12 330.82 319.21C329.11 321.78 326.03 325.04 325.45 328.05C329.25 327.53 332.79 325.93 336.47 324.89C345.63 322.3 355.02 320.25 364.47 319.02C376.1 317.5 388.46 317.4 400.09 318.97C407.17 319.93 414.01 322.02 421.02 323.18Z"
          fill="#7DD0E2"
          fillRule="evenodd"
        />
        <path
          d="M476.83 276.46C476.28 276.39 475.74 276.32 475.19 276.25C475.93 275.49 476.68 274.74 477.42 273.99C477.4 273.65 477.38 273.31 477.36 272.97C482.79 270.49 488.1 265.65 492.99 262C501.35 255.75 509.86 249.79 518.54 244C553.86 220.46 595.19 201.22 638.17 199.19C643.62 198.93 649.14 199.02 654.57 199.49C677.76 201.54 721.6 212.38 715.41 244.59C714.64 248.6 713.48 252.45 711.62 256.11C704.87 269.41 690.87 279.27 677.79 285.65C672.88 288.05 667.52 289.58 662.7 292.08C668.89 293.95 676.88 292.47 683.4 293.11C696 294.34 708.9 297.39 720.68 302.03C727.98 304.91 735.61 308.75 741.6 313.89C746.17 317.8 750.73 321.96 753.66 327.29C771.1 358.92 746.67 388.68 720.49 404.63C696.33 419.35 666.7 425.37 638.73 426.51C616.7 427.4 594.55 425.53 572.57 427.92C555.34 429.8 538.58 433.32 521.93 437.98C515.99 439.64 508.08 443.87 502.19 444.2C526.4 428.68 553.1 415.22 581.17 407.93C612.24 399.85 645.08 396.99 671.69 377.34C691.58 362.66 706.81 333.66 683.7 314.14C676.46 308.02 666.59 304.9 657.51 302.9C642.38 299.58 625.74 301.05 610.69 303.95C606.36 304.78 593.29 309.23 590.02 308.48C597.55 302.77 607.54 299.74 615.98 295.62C633.22 287.19 651.75 274.36 661.37 257.3C668.7 244.29 671.95 227.52 658.66 217.02C647.01 207.81 630.39 209.48 616.68 210.79C583.45 213.99 540.87 233.67 513.04 252.06C504.97 257.39 496.79 262.49 488.85 268.02C485.71 270.2 480.39 274.72 477 275.4C476.94 275.75 476.89 276.1 476.83 276.46ZM617.57 222.53C613.92 227.45 609.34 231.25 606.25 236.72C599.37 248.89 595.52 262.94 590.67 276C578.8 307.99 566.49 344.68 547.62 373.17C502.7 441.01 409.28 455.97 334.7 440.84C318.22 437.5 301.3 433.08 285.95 426.11C291.24 425.17 300.52 427.97 306.22 428.59C318.59 429.95 331.1 430.19 343.54 429.8C372.33 428.9 401.81 422.18 428.65 411.98C448.09 404.6 467.92 395.56 483.67 381.6C505.34 362.38 516.55 343.03 527.88 316.68C536.38 296.94 541.69 274.87 553.24 256.62C563.26 240.8 581.65 231.81 598.98 226.54C604.76 224.78 611.49 222.2 617.57 222.53Z"
          fill="#2D7181"
          fillRule="evenodd"
        />
      </svg>
    </span>
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
              <AzureBayLogo />
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
