import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e', workers: 1, timeout: 45000,
  // Auth scenarios use signed synthetic JWTs; do not retain headers in traces.
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'off' },
  webServer: [
    { command: '.venv\\Scripts\\python.exe tests/integration/serve_d1_fake.py', cwd: '../ai-service',
      url: 'http://127.0.0.1:18006/health', reuseExistingServer: false, timeout: 30000 },
    { command: 'java -jar target-assistant-d1/pbl6-0.0.1-SNAPSHOT.jar --spring.profiles.active=local --server.port=19090 --spring.datasource.url=jdbc:h2:mem:d1e2e',
      cwd: '../BE', url: 'http://127.0.0.1:19090/api/public/rooms/room-types', timeout: 120000,
      reuseExistingServer: false,
      env: { AI_ASSISTANT_ENABLED: 'true', AI_CORPUS_MODE: 'demo_synthetic', AI_SERVICE_URL: 'http://127.0.0.1:18006', AI_SERVICE_AUTH_TOKEN: 'd1-e2e-test-only' } },
    { command: 'npm run dev -- --host 127.0.0.1 --port 3000 --strictPort',
      url: 'http://127.0.0.1:3000', reuseExistingServer: false,
      env: { VITE_ASSISTANT_ENABLED: 'true', BACKEND_DEV_URL: 'http://127.0.0.1:19090' } }
  ],
});
