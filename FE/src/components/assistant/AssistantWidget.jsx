import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { apiCall, waitForAssistantSessionReset } from '../../services/api';
import './AssistantWidget.css';

export default function AssistantWidget() {
  const { token } = useAuth();
  const { pathname } = useLocation();
  if (import.meta.env.VITE_ASSISTANT_ENABLED !== 'true') return null;
  if (pathname.startsWith('/admin') || pathname.startsWith('/staff')) return null;
  return <AssistantChat key={token || 'guest'} />;
}

export function AssistantChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('');
  const conversation = useRef(null);
  const request = useRef(null);
  const launcher = useRef(null);
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
      if (!result?.success || !data || !['answered', 'insufficient_evidence', 'capability_unavailable'].includes(data.status)
          || !['production', 'demo_synthetic'].includes(data.corpusMode) || typeof data.answer !== 'string'
          || !Array.isArray(data.citations)) throw new Error('Phản hồi trợ lý không hợp lệ.');
      conversation.current = data.conversationId; setMode(data.corpusMode);
      setMessages(old => [...old, { role: 'assistant', text: data.answer, citations: data.citations }]);
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
    if (label === 'FAQ' || label === 'Chính sách') { setInput(label === 'FAQ' ? 'Wi-Fi ở đâu?' : 'Có quy định gửi hành lý không?'); composer.current?.focus(); }
    else setError('Chức năng này chưa được hỗ trợ trong D1. Bạn có thể dùng màn hình nghiệp vụ hiện có.');
  }
  return <aside className="assistant-widget" aria-label="Trợ lý khách sạn">
    {open && <section id="assistant-panel" className="assistant-panel" role="region" aria-label="Hội thoại trợ lý"
      onKeyDown={event => { if (event.key === 'Escape') close(); }}>
      <header><div><strong>Trợ lý khách sạn</strong><small>Hỗ trợ FAQ có nguồn</small></div>
        <button type="button" onClick={close} aria-label="Thu gọn trợ lý">×</button></header>
      {mode === 'demo_synthetic' && <p className="assistant-demo" role="note">Dữ liệu giả lập — chỉ dùng demo</p>}
      {!mode && <p className="assistant-note">D1 hỗ trợ FAQ; nguồn và chế độ được xác nhận trong phản hồi.</p>}
      <div className="assistant-suggestions">{['FAQ', 'Phòng', 'Giá phòng', 'Dịch vụ', 'Booking của tôi', 'Chính sách'].map(label =>
        <button key={label} type="button" disabled={busy} onClick={() => suggestion(label)}>{label}</button>)}</div>
      <div className="assistant-messages" ref={list} role="log" aria-label="Tin nhắn" aria-live="polite"
        onScroll={event => { const el = event.currentTarget; stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40; }}>
        {messages.length === 0 && <p>Xin chào! Tôi hỗ trợ tra cứu FAQ từ nguồn đã cấu hình.</p>}
        {messages.map((item, i) => <article key={i} className={`assistant-message ${item.role}`}>
          <strong>{item.role === 'user' ? 'Bạn' : 'Trợ lý'}</strong><p>{item.text}</p>
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
