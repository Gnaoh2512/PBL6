import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AssistantWidget, { AssistantChat } from './AssistantWidget';
import { apiCall } from '../../services/api';

vi.mock('../../services/api', () => ({ apiCall: vi.fn(), waitForAssistantSessionReset: () => Promise.resolve() }));
const auth = vi.hoisted(() => ({ token: '', isAuthenticated: false, hasRole: () => false }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => auth }));

const answer = { success: true, data: { status: 'answered', answer: 'Wi-Fi giả lập tại sảnh.',
  conversationId: 'conversation', corpusMode: 'demo_synthetic',
  citations: [{ citationId: 'c1', title: 'FAQ demo', sectionId: 'FAQ-WIFI', version: '1' }] } };

async function open(user) {
  await user.click(screen.getByRole('button', { name: 'Trợ lý', exact: true }));
}

describe('FAQ widget', () => {
  it('sends only the public contract and renders clean text without demo banner or technical citation footer', async () => {
    apiCall.mockResolvedValue({
      ...answer,
      data: {
        ...answer.data,
        answer: '[Azure Bay — Chính sách demo đã duyệt] Wi-Fi miễn phí tại sảnh.',
      },
    });
    const user = userEvent.setup(); render(<AssistantChat />); await open(user);
    await user.type(screen.getByLabelText('Câu hỏi'), 'Wi-Fi ở đâu?');
    await user.click(screen.getByRole('button', { name: 'Gửi', exact: true }));
    expect(await screen.findByText('Wi-Fi miễn phí tại sảnh.')).toBeInTheDocument();
    expect(screen.queryByText(/Dữ liệu giả lập — chỉ dùng demo/)).not.toBeInTheDocument();
    expect(screen.queryByText(/FAQ demo · FAQ-WIFI · v1/)).not.toBeInTheDocument();
    const [url, options] = apiCall.mock.calls[0];
    expect(url).toBe('/api/assistant/chat');
    expect(Object.keys(options.body).sort()).toEqual(['clientMessageId', 'conversationId', 'message']);
    expect(options.signal).toBeInstanceOf(AbortSignal);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: 'Hội thoại trợ lý' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trợ lý', exact: true })).toHaveFocus();
  });

  it('does not insert HTML, duplicate a pending request or publish after unmount', async () => {
    let resolve;
    apiCall.mockImplementation(() => new Promise(done => { resolve = done; }));
    const user = userEvent.setup(); const view = render(<AssistantChat />); await open(user);
    await user.type(screen.getByLabelText('Câu hỏi'), 'wifi');
    fireEvent.submit(screen.getByRole('button', { name: 'Gửi', exact: true }).closest('form'));
    fireEvent.submit(screen.getByRole('button', { name: 'Gửi', exact: true }).closest('form'));
    await waitFor(() => expect(apiCall).toHaveBeenCalledTimes(1));
    const signal = apiCall.mock.calls[0][1].signal;
    view.unmount(); expect(signal.aborted).toBe(true);
    resolve({ ...answer, data: { ...answer.data, answer: '<img src=x onerror=alert(1)>' } });
    render(<AssistantChat />); await open(user);
    expect(screen.queryByText(/onerror/)).not.toBeInTheDocument();
  });

  it('shows errors cleanly when backend fails', async () => {
    apiCall.mockRejectedValue(new Error('Dịch vụ tạm thời chưa sẵn sàng.'));
    const user = userEvent.setup(); render(<AssistantChat />); await open(user);
    await user.type(screen.getByLabelText('Câu hỏi'), 'wifi');
    await user.click(screen.getByRole('button', { name: 'Gửi', exact: true }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Dịch vụ tạm thời');
  });

  it('omits floating callout text and adapts the 4th quick pill by customer login state', async () => {
    vi.stubEnv('VITE_ASSISTANT_ENABLED', 'true');
    auth.token = '';
    auth.isAuthenticated = false;
    auth.hasRole = () => false;
    const user = userEvent.setup();
    const view = render(<MemoryRouter><AssistantWidget /></MemoryRouter>);

    expect(screen.queryByText('Hỏi đáp về khách sạn')).not.toBeInTheDocument();
    await open(user);
    expect(screen.getByRole('button', { name: 'Quy định nhận / trả phòng?', exact: true })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Đơn đặt phòng của tôi', exact: true })).not.toBeInTheDocument();

    auth.token = 'customer-jwt';
    auth.isAuthenticated = true;
    auth.hasRole = roles => roles.includes('CUSTOMER');
    view.rerender(<MemoryRouter><AssistantWidget /></MemoryRouter>);
    await open(user);
    expect(screen.getByRole('button', { name: 'Đơn đặt phòng của tôi', exact: true })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Quy định nhận / trả phòng?', exact: true })).not.toBeInTheDocument();

    auth.token = 'staff-jwt';
    auth.isAuthenticated = true;
    auth.hasRole = () => false;
    view.rerender(<MemoryRouter><AssistantWidget /></MemoryRouter>);
    await open(user);
    expect(screen.getByRole('button', { name: 'Quy định nhận / trả phòng?', exact: true })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Đơn đặt phòng của tôi', exact: true })).not.toBeInTheDocument();

    auth.token = '';
    auth.isAuthenticated = false;
    auth.hasRole = () => false;
  });

  it('handles D3 requires_login and renders personal booking cards cleanly', async () => {
    apiCall
      .mockResolvedValueOnce({
        success: true,
        data: {
          status: 'requires_login',
          answer: 'Để xem danh sách đơn đặt phòng của bạn, vui lòng đăng nhập tài khoản khách hàng trước nhé.',
          conversationId: 'conv-d3',
          corpusMode: 'production',
          citations: [],
          cards: [],
          actions: [{ type: 'open_login', label: 'Đăng nhập tài khoản', targetId: null }],
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          status: 'answered',
          answer: 'Thông tin đơn đặt phòng BK-CUSTOMER1-DEMO:',
          conversationId: 'conv-d3',
          corpusMode: 'production',
          citations: [],
          cards: [{
            type: 'booking',
            retrievedAt: '2026-11-25T21:00:00+07:00',
            data: {
              bookingCode: 'BK-CUSTOMER1-DEMO',
              bookingStatus: 'CHECKED_IN',
              roomTypeName: 'Phòng Standard',
              checkInDate: '2026-11-24',
              checkOutDate: '2026-11-27',
              nights: 3,
              guestCount: 2,
              depositRequired: '450000',
              depositPaid: '450000',
              totalAmount: '1650000',
              remainingBalance: '1200000',
              currency: 'VND',
            },
          }],
          actions: [],
        },
      });
    const user = userEvent.setup();
    const guestView = render(<MemoryRouter><AssistantChat /></MemoryRouter>);
    await open(user);
    expect(screen.queryByRole('button', { name: 'Đơn đặt phòng của tôi', exact: true })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Câu hỏi'), 'Xem danh sách đơn đặt phòng của tôi');
    await user.click(screen.getByRole('button', { name: 'Gửi', exact: true }));
    expect(await screen.findByRole('link', { name: 'Đăng nhập tài khoản' })).toHaveAttribute('href', '/login');
    guestView.unmount();

    render(<MemoryRouter><AssistantChat isCustomer /></MemoryRouter>);
    await open(user);
    await user.click(screen.getByRole('button', { name: 'Đơn đặt phòng của tôi', exact: true }));
    expect(screen.getByLabelText('Câu hỏi')).toHaveValue('Xem danh sách đơn đặt phòng của tôi');
    await user.click(screen.getByRole('button', { name: 'Gửi', exact: true }));
    expect(await screen.findByText('BK-CUSTOMER1-DEMO')).toBeInTheDocument();
    expect(screen.getByText('Đang lưu trú')).toBeInTheDocument();
    expect(screen.getByText(/1\.650\.000 VND/)).toBeInTheDocument();
    expect(screen.getByText(/1\.200\.000 VND/)).toBeInTheDocument();
  });

  it('hides in staff/admin routes', () => {
    vi.stubEnv('VITE_ASSISTANT_ENABLED', 'true');
    render(<MemoryRouter initialEntries={['/admin/rooms']}><AssistantWidget /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: 'Trợ lý' })).not.toBeInTheDocument();
  });
  it('clears old messages and aborts work when account changes', async () => {
    vi.stubEnv('VITE_ASSISTANT_ENABLED', 'true');
    auth.token = 'account-a';
    let resolve;
    apiCall.mockImplementation(() => new Promise(done => { resolve = done; }));
    const user = userEvent.setup();
    const tree = () => <MemoryRouter><AssistantWidget /></MemoryRouter>;
    const view = render(tree()); await open(user);
    await user.type(screen.getByLabelText('Câu hỏi'), 'old account question');
    await user.click(screen.getByRole('button', { name: 'Gửi', exact: true }));
    await waitFor(() => expect(apiCall).toHaveBeenCalledTimes(1));
    const signal = apiCall.mock.calls[0][1].signal;
    auth.token = 'account-b'; view.rerender(tree());
    expect(signal.aborted).toBe(true);
    resolve(answer); await open(user);
    expect(screen.queryByText('old account question')).not.toBeInTheDocument();
    expect(screen.queryByText(answer.data.answer)).not.toBeInTheDocument();
    auth.token = '';
  });
  it('renders provider HTML as literal text', async () => {
    apiCall.mockResolvedValue({ ...answer, data: { ...answer.data, answer: '<img src=x onerror=alert(1)>' } });
    const user = userEvent.setup(); render(<AssistantChat />); await open(user);
    await user.type(screen.getByLabelText('Câu hỏi'), 'wifi');
    await user.click(screen.getByRole('button', { name: 'Gửi', exact: true }));
    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('renders D2 room cards, service cards, and allowlisted action links only', async () => {
    apiCall.mockResolvedValueOnce({
      success: true,
      data: {
        status: 'answered',
        answer: 'Tìm thấy 1 phòng trống phù hợp.',
        conversationId: 'conv-d2',
        corpusMode: 'production',
        citations: [],
        cards: [{
          type: 'room',
          retrievedAt: '2026-11-25T10:00:00+07:00',
          data: {
            roomId: 101,
            roomTypeId: 1,
            typeName: 'Deluxe Sea View',
            capacity: 2,
            checkInDate: '2026-12-01',
            checkOutDate: '2026-12-03',
            nights: 2,
            pricePerNight: '1500000',
            totalRoomCharge: '3000000',
            depositPercentage: 30,
            estimatedDeposit: '900000',
            currency: 'VND',
            priceScope: 'room_charge_estimate',
          },
        }],
        actions: [
          { type: 'open_room_search', label: 'Mở trang tìm & đặt phòng', targetId: null },
          { type: 'evil_redirect', label: 'Phishing link', targetId: null, href: 'https://evil.invalid' },
        ],
      },
    });
    const user = userEvent.setup();
    render(<MemoryRouter><AssistantChat /></MemoryRouter>);
    await open(user);
    await user.click(screen.getByRole('button', { name: 'Giá phòng hiện tại?', exact: true }));
    expect(screen.getByLabelText('Câu hỏi')).toHaveValue('Tìm phòng trống và giá hiện tại cho 2 khách');
    await user.click(screen.getByRole('button', { name: 'Gửi', exact: true }));
    expect(await screen.findByText('Deluxe Sea View')).toBeInTheDocument();
    expect(screen.getByText(/1\.500\.000 VND\/đêm/)).toBeInTheDocument();
    expect(screen.getByText(/3\.000\.000 VND/)).toBeInTheDocument();
    expect(screen.getByText(/Giá phòng dự kiến · Chưa gồm VAT & dịch vụ/)).toBeInTheDocument();
    const roomLink = screen.getByRole('link', { name: 'Chọn phòng' });
    expect(roomLink).toHaveAttribute('href', '/booking?roomId=101&checkIn=2026-12-01&checkOut=2026-12-03');
    expect(screen.getByRole('link', { name: 'Mở trang tìm & đặt phòng' })).toHaveAttribute('href', '/booking');
    expect(screen.queryByText('Phishing link')).not.toBeInTheDocument();
  });

  it('accepts needs_clarification and no_results statuses with service cards', async () => {
    apiCall
      .mockResolvedValueOnce({
        success: true,
        data: {
          status: 'needs_clarification',
          answer: 'Bạn vui lòng cho biết ngày nhận phòng và ngày trả phòng.',
          conversationId: 'conv-d2',
          corpusMode: 'production',
          missingFields: ['checkInDate', 'checkOutDate'],
          citations: [],
          cards: [],
          actions: [{ type: 'open_room_search', label: 'Mở trang tìm phòng', targetId: null }],
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          status: 'answered',
          answer: 'Danh sách dịch vụ đang hoạt động:',
          conversationId: 'conv-d2',
          corpusMode: 'production',
          citations: [],
          cards: [{
            type: 'service',
            retrievedAt: '2026-11-25T10:05:00+07:00',
            data: {
              serviceId: 5,
              categoryName: 'Spa',
              serviceName: 'Massage thư giãn',
              unitPrice: '450000',
              unit: 'Lần',
              isActive: true,
              currency: 'VND',
            },
          }],
          actions: [{ type: 'open_services', label: 'Xem trang dịch vụ', targetId: null }],
        },
      });
    const user = userEvent.setup();
    render(<MemoryRouter><AssistantChat /></MemoryRouter>);
    await open(user);
    await user.type(screen.getByLabelText('Câu hỏi'), 'Giá phòng?');
    await user.click(screen.getByRole('button', { name: 'Gửi', exact: true }));
    expect(await screen.findByText(/ngày nhận phòng và ngày trả phòng/)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Câu hỏi'), 'Dịch vụ');
    await user.click(screen.getByRole('button', { name: 'Gửi', exact: true }));
    expect(await screen.findByText('Massage thư giãn')).toBeInTheDocument();
    expect(screen.getByText(/450\.000 VND/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem trang dịch vụ' })).toHaveAttribute('href', '/guest/services');
  });
});
