import { defineConfig, devices } from "@playwright/test";

import base from "./playwright.config";

/*
 * Fase 10C: mesma suíte de regressão em Firefox e WebKit (motor do Safari),
 * desktop e iPhone emulado. OPCIONAL e fora do CI: os navegadores ficam só
 * no cache local (`npx playwright install firefox webkit`), sem dependência
 * nova no projeto. Rodar contra um build de produção já em execução:
 *   npx next start -p 3000 &
 *   npx playwright test -c playwright.crossbrowser.config.ts
 * Limite: WebKit do Playwright não é o Safari da Apple (mesmo motor, outro
 * navegador); aparelho real continua sem teste. O Playwright 1.62 não
 * instala Firefox nem WebKit no macOS 13: use a CI (.github/workflows/qa.yml).
 */
export default defineConfig({
  ...base,
  // Os specs de staging/homologação pulam sozinhos fora do staging.sh.
  testIgnore: ["**/staging-*.spec.ts"],
  projects: [
    // Na CI (Linux) também o Chromium do Playwright (sem o Chrome do sistema).
    ...(process.env.CI ? [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }] : []),
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 14"] } },
  ],
  webServer: undefined,
});
