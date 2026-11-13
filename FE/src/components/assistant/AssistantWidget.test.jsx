import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AssistantWidget, { AssistantChat } from './AssistantWidget';
import { apiCall } from '../../services/api';

vi.mock('../../services/api', () => ({ apiCall: vi.fn(), waitForAssistantSessionReset: () => Promise.resolve() }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ token: '' }) }));

const answer = { success: true, data: { status: 'answered', answer: 'Wi-Fi giả lập tại sảnh.',
  conversationId: 'conversation', corpusMode: 'demo_synthetic',
  citations: [{ citationId: 'c1', title: 'FAQ demo', sectionId: 'FAQ-WIFI', version: '1' }] } };

async function open(user) {
  await user.click(screen.getByRole('button', { name: 'Trợ lý', exact: true }));
}

describe('FAQ widget', () => {
  it('sends only the public contract and renders text, sources and demo label', async () => {
    apiCall.mockResolvedValue(answer);
    const user = userEvent.setup(); render(<AssistantChat />); await open(user);
    await user.type(screen.getByLabelText('Câu hỏi'), 'Wi-Fi ở đâu?');
    await user.click(screen.getByRole('button', { name: 'Gửi', exact: true }));
    expect(await screen.findByText('Wi-Fi giả lập tại sảnh.')).toBeInTheDocument();
    expect(screen.getByText(/Dữ liệu giả lập — chỉ dùng demo/)).toBeInTheDocument();
    expect(screen.getByText(/FAQ demo · FAQ-WIFI · v1/)).toBeInTheDocument();
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

  it('shows errors and marks unsupported groups without calling backend', async () => {
    apiCall.mockRejectedValue(new Error('Dịch vụ tạm thời chưa sẵn sàng.'));
    const user = userEvent.setup(); render(<AssistantChat />); await open(user);
    await user.click(screen.getByRole('button', { name: 'Booking của tôi' }));
    expect(screen.getByRole('alert')).toHaveTextContent('chưa được hỗ trợ');
    expect(apiCall).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('Câu hỏi'), 'wifi');
    await user.click(screen.getByRole('button', { name: 'Gửi', exact: true }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Dịch vụ tạm thời');
  });

  it('hides in staff/admin routes', () => {
    vi.stubEnv('VITE_ASSISTANT_ENABLED', 'true');
    render(<MemoryRouter initialEntries={['/admin/rooms']}><AssistantWidget /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: 'Trợ lý' })).not.toBeInTheDocument();
  });
});
