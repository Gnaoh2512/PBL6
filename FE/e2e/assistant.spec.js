import { test, expect } from '@playwright/test';

test('labeled fake E2E: sources, demo badge, missing source and unavailable capability', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Trợ lý', exact: true }).click();
  await page.getByLabel('Câu hỏi', { exact: true }).fill('Wi-Fi ở đâu?');
  await page.getByRole('button', { name: 'Gửi', exact: true }).click();
  await expect(page.getByRole('note')).toContainText('Dữ liệu giả lập');
  await expect(page.getByRole('list', { name: 'Nguồn' })).toContainText('FAQ-WIFI');
  await expect(page.getByRole('log')).toContainText('không phải tiện ích đã được xác nhận');
  await page.locator('.resort-nav-book').click({ trial: true });
  await page.locator('.search-rooms').click({ trial: true });
  await page.screenshot({ path: 'test-results/assistant-desktop.png' });
  await page.getByLabel('Câu hỏi', { exact: true }).fill('astronaut rocket');
  await page.getByRole('button', { name: 'Gửi', exact: true }).click();
  await expect(page.getByRole('log')).toContainText('Chưa có đủ nguồn');
  await page.getByLabel('Câu hỏi', { exact: true }).fill('booking của tôi');
  await page.getByRole('button', { name: 'Gửi', exact: true }).click();
  await expect(page.getByRole('log')).toContainText('Chức năng này chưa được hỗ trợ');
  await page.setViewportSize({ width: 390, height: 844 });
  const panel = page.getByRole('region', { name: 'Hội thoại trợ lý' });
  const box = await panel.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(844);
  await page.screenshot({ path: 'test-results/assistant-mobile.png' });
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Trợ lý', exact: true })).toBeFocused();
});

test('real Spring boundary rejects bad JWT and extra identity, resets conversation', async ({ request }) => {
  const headers = { Origin: 'http://127.0.0.1:3000' };
  const body = { conversationId: null, clientMessageId: crypto.randomUUID(), message: 'wifi' };
  const badJwt = await request.post('/api/assistant/chat', { headers: { ...headers, Authorization: 'Bearer not-a-jwt' }, data: body });
  expect(badJwt.status()).toBe(401);
  const identity = await request.post('/api/assistant/chat', { headers, data: { ...body, username: 'victim' } });
  expect(identity.status()).toBe(422);
  const initial = await request.post('/api/assistant/chat', { headers, data: body });
  expect(initial.status()).toBe(200);
  const first = (await initial.json()).data;
  const reset = await request.delete('/api/assistant/session', { headers });
  expect(reset.status()).toBe(204);
  const stale = await request.post('/api/assistant/chat', { headers, data: { ...body, conversationId: first.conversationId, clientMessageId: crypto.randomUUID() } });
  expect(stale.status()).toBe(404);
});

test.describe('synthetic member binding', () => {
  test('member A can ask FAQ; member B cannot reuse A conversation', async ({ request }) => {
    const origin = { Origin: 'http://127.0.0.1:3000' };
    async function member() {
      const username = `d1-test-${crypto.randomUUID().slice(0, 8)}`;
      const password = 'd1-synthetic-test-only';
      const registration = await request.post('/api/auth/register', {
        data: { username, password, fullName: 'D1 Synthetic Test' }
      });
      expect(registration.status()).toBe(201);
      const login = await request.post('/api/auth/login', { data: { username, password } });
      expect(login.status()).toBe(200);
      return (await login.json()).data.accessToken;
    }
    const a = await member(), b = await member();
    const body = { conversationId: null, clientMessageId: crypto.randomUUID(), message: 'wifi' };
    const first = await request.post('/api/assistant/chat', { headers: { ...origin, Authorization: `Bearer ${a}` }, data: body });
    expect(first.status()).toBe(200);
    const conversation = (await first.json()).data.conversationId;
    const stolen = await request.post('/api/assistant/chat', {
      headers: { ...origin, Authorization: `Bearer ${b}` },
      data: { ...body, conversationId: conversation, clientMessageId: crypto.randomUUID() }
    });
    expect(stolen.status()).toBe(404);
  });
});
