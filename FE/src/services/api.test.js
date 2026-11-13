import { afterEach, expect, it, vi } from 'vitest';
import { apiCall } from './api';

afterEach(() => vi.unstubAllGlobals());
it('preserves existing auth behavior and forwards explicit cancellation/credentials', async () => {
  localStorage.setItem('auth_token', 'test-browser-jwt');
  const controller = new AbortController();
  const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true }) });
  vi.stubGlobal('fetch', fetch);
  await apiCall('/api/assistant/chat', { method: 'POST', body: { message: 'wifi' }, signal: controller.signal, credentials: 'same-origin' });
  expect(fetch.mock.calls[0][1]).toMatchObject({ signal: controller.signal, credentials: 'same-origin', headers: { Authorization: 'Bearer test-browser-jwt' } });
});
it('preserves structured failure codes without converting AbortError into network errors', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({ message: 'Unavailable', data: { code: 'DEPENDENCY_UNAVAILABLE', retryable: true } }) }));
  await expect(apiCall('/api/assistant/chat')).rejects.toMatchObject({ status: 503, code: 'DEPENDENCY_UNAVAILABLE', retryable: true });
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')));
  await expect(apiCall('/api/assistant/chat')).rejects.toMatchObject({ name: 'AbortError' });
});
