import { createHmac } from "node:crypto";

import type { Browser, Page } from "@playwright/test";

/**
 * Login dos E2E de homologação (Fase 10A): um helper só (antes copiado em 7
 * specs). Se o usuário fictício tiver MFA (HOMOLOG_TOTP_<CHAVE>), completa o
 * desafio em /verificar-mfa com um código TOTP calculado aqui.
 */
function base32(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of input.replace(/=+$/g, "").toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const out: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}
export function totpCode(secret: string, timeMs = Date.now()): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(Math.floor(timeMs / 30_000)));
  const h = createHmac("sha1", base32(secret)).update(buf).digest();
  const o = h[h.length - 1] & 0x0f;
  return ((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
}

// O Supabase aceita o mesmo código mais de uma vez dentro da janela de 30 s
// (conferido em 21/11/2026; registrado no relatório da Fase 10A): não é
// preciso esperar a próxima janela entre logins.
export async function completeMfa(page: Page, key: string) {
  const secret = process.env[`HOMOLOG_TOTP_${key}`];
  if (!secret) throw new Error(`usuário ${key} pediu MFA mas não há HOMOLOG_TOTP_${key}`);
  await page.getByLabel("Código do aplicativo autenticador").fill(totpCode(secret));
  await page.getByRole("button", { name: "Confirmar" }).click();
}

export async function loginAs(browser: Browser, key: string, opts: { reducedMotion?: boolean; skipMfa?: boolean } = {}): Promise<Page> {
  const context = await browser.newContext(opts.reducedMotion ? { reducedMotion: "reduce" } : {});
  await context.addInitScript(() => window.localStorage.setItem("wjb-cookie-consent", "declined"));
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env[`HOMOLOG_USER_${key}`] ?? "");
  await page.getByLabel("Senha", { exact: true }).fill(process.env[`HOMOLOG_PW_${key}`] ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(portal|admin|verificar-mfa)/);
  // O login passa por /admin ou /portal antes de o servidor mandar para /verificar-mfa: espera assentar.
  await page.waitForLoadState("networkidle");
  const mfaHeading = page.getByRole("heading", { name: "Verificação em duas etapas" });
  if (page.url().includes("/verificar-mfa") || (await mfaHeading.count()) > 0) {
    if (opts.skipMfa) return page;
    await completeMfa(page, key);
    await page.waitForURL(/\/(portal|admin)(\/|$|\?)/);
    await page.waitForLoadState("networkidle");
    if ((await mfaHeading.count()) > 0) throw new Error(`MFA de ${key} não foi aceito`);
  }
  return page;
}
