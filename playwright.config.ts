import { defineConfig, devices } from "@playwright/test";

/*
 * `process.loadEnvFile` é nativo do Node (estável desde 20.6, sem precisar
 * da dependência `dotenv`) — carrega as credenciais de teste E2E
 * permanentes (`E2E_TEST_EMAIL_CLIENT`/`_STAFF`/`_PASSWORD`, ver
 * `.env.example`) pro processo do Playwright, que não herda `.env.local`
 * sozinho (diferente do `next dev`, que carrega pra si mesmo). Em CI ou
 * numa máquina sem `.env.local`, simplesmente não carrega nada — os specs
 * que dependem dessas variáveis (`portal-auth.spec.ts`, `tickets.spec.ts`)
 * pulam sozinhos nesse caso, o resto da suíte roda normal.
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local não existe (CI, checkout limpo) — segue sem essas env vars.
}

export default defineConfig({
  testDir: "./src/tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"], channel: "chrome" },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
