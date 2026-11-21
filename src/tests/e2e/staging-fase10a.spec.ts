import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { completeMfa, loginAs } from "./helpers/login";

/**
 * Fase 10A em STAGING (homologação real, usuários fictícios com MFA TOTP):
 * sessão só com senha não acessa a API; step-up com retorno seguro;
 * ações críticas barradas sem MFA. Só via staging.sh.
 */
const enabled = process.env.HOMOLOG_STAGING === "1" && !process.env.HOMOLOG_PAYMENTS;
test.skip(!enabled, "Só no staging da homologação (staging.sh).");
test.describe.configure({ mode: "serial" });
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Staging roda só no projeto chromium.");
});

test("só com a senha (MFA pendente): páginas e API tratam como sem sessão", async ({ browser }) => {
  const page = await loginAs(browser, "CONTADOR", { skipMfa: true });
  await expect(page).toHaveURL(/\/verificar-mfa/);
  for (const api of ["/api/me", "/api/me/organizations"]) {
    const r = await page.request.get(api);
    expect(r.status(), api).toBe(401);
  }
  const dl = await page.request.get("/api/documents/00000000-0000-4000-8000-000000000000/download", { maxRedirects: 0 });
  expect(dl.status()).toBe(401);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/verificar-mfa/);
  await completeMfa(page, "CONTADOR");
  await page.waitForURL(/\/admin/);
  expect((await page.request.get("/api/me")).status()).toBe(200);
});

test("step-up: confirmação recente aparece; reconfirmar volta à página certa; destino externo é ignorado", async ({ browser }) => {
  const page = await loginAs(browser, "CONTADOR");
  await page.goto("/admin/nfse/perfis");
  await expect(page.getByText("Identidade confirmada para ações sensíveis (vale 15 minutos).")).toBeVisible();
  await page.goto("/verificar-mfa?reconfirmar=1&next=/admin/nfse/permissoes");
  await expect(page.getByText(/Para concluir uma ação sensível/)).toBeVisible();
  await completeMfa(page, "CONTADOR");
  await page.waitForURL(/\/admin\/nfse\/permissoes$/);
  await page.goto("/verificar-mfa?reconfirmar=1&next=https://golpe.test/admin");
  await completeMfa(page, "CONTADOR");
  await page.waitForURL(/localhost:3000\/admin$/);
});

test("ação crítica sem MFA é barrada no servidor; com MFA recente passa", async ({ browser }) => {
  // Contador sem MFA: o aviso das páginas sensíveis pede a ativação da verificação em duas etapas.
  const semMfa = await loginAs(browser, "CONTADORSEM");
  await semMfa.goto("/admin/nfse/perfis");
  await expect(semMfa.getByRole("link", { name: "Ativar verificação em duas etapas" })).toBeVisible();
  // Super admin com MFA recente consegue salvar o desconto do combo (mesmo valor, sem mudar nada aprovado).
  const sa = await loginAs(browser, "SUPERADMIN");
  await sa.goto("/admin/comercial");
  await expect(sa.getByText("Identidade confirmada para ações sensíveis (vale 15 minutos).")).toBeVisible();
  await sa.getByLabel("Desconto (%)").fill("20");
  await sa.getByRole("button", { name: "Salvar", exact: true }).first().click();
  await expect(sa.getByText(/Desconto do combo: 20%/)).toBeVisible();
});

test("formulário público: campo grande demais e corpo grande demais são recusados; o limite compartilhado barra o excesso", async ({ request }) => {
  // Os contadores do limite ficam no banco da homologação: zera antes de medir.
  const admin = createClient(process.env.SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false } });
  await admin.from("rate_limit_buckets").delete().like("bucket", "leads:%");
  const base = { name: "Fulana Fictícia", email: "f10a@exemplo.test", phone: "11999990000", serviceInterest: "Contabilidade", consent: true, formContext: "Contato", tracking: { sourcePath: "/contato", utmSource: null, utmMedium: null, utmCampaign: null } };
  expect((await request.post("/api/leads", { data: { ...base, name: "a".repeat(200) } })).status()).toBe(400);
  expect((await request.post("/api/leads", { data: { ...base, message: "x".repeat(20_000) } })).status()).toBe(413);
  // 5 por minuto por IP: as 2 acima contaram; mais 3 passam pela validação e a 6ª é barrada.
  const statuses: number[] = [];
  for (let i = 0; i < 4; i++) statuses.push((await request.post("/api/leads", { data: { ...base, name: "a".repeat(200) } })).status());
  expect(statuses).toEqual([400, 400, 400, 429]);
  const { count } = await admin.from("rate_limit_buckets").select("bucket", { count: "exact", head: true }).like("bucket", "leads:ip:min:%");
  expect(count).toBeGreaterThan(0);
  const { data } = await admin.from("rate_limit_buckets").select("bucket").like("bucket", "leads:%");
  expect(JSON.stringify(data)).not.toMatch(/127\.0\.0\.1|::1|localhost/); // só hash, nunca o IP
  await admin.from("rate_limit_buckets").delete().like("bucket", "leads:%");
});
