import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { loginAs } from "./helpers/login";

/**
 * Fase 10F em STAGING (homologação real, usuários fictícios): conferência do
 * certificado PÚBLICO no Admin. Certificado FICTÍCIO gerado na hora, sem
 * cadeia ICP-Brasil: o esperado é a RECUSA (verificação real não configurada).
 * Arquivo com chave privada é recusado sem ser lido. Só via staging.sh.
 */
const enabled = process.env.HOMOLOG_STAGING === "1" && !process.env.HOMOLOG_PAYMENTS;
test.skip(!enabled, "Só no staging da homologação (staging.sh).");
test.describe.configure({ mode: "serial" });
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Staging roda só no projeto chromium.");
});

const admin = () => createClient(process.env.SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false } });

test("certificado: chave privada recusada; certificado fictício conferido e recusado por falta de cadeia real; nada gravado", async ({ browser }) => {
  const dir = mkdtempSync(path.join(tmpdir(), "wjb-10f-"));
  try {
    // Certificado de usuário final (não AC), sem cadeia ICP-Brasil.
    writeFileSync(path.join(dir, "c.cnf"), "[req]\ndistinguished_name=dn\nprompt=no\n[dn]\nCN=CERTIFICADO FICTICIO DE TESTE\n[ext]\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,nonRepudiation\nextendedKeyUsage=clientAuth\n");
    execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", path.join(dir, "k.pem"), "-out", path.join(dir, "c.pem"), "-days", "30", "-config", path.join(dir, "c.cnf"), "-extensions", "ext"], { stdio: "ignore" });
    const inicio = new Date(Date.now() - 1000).toISOString();
    const { count: antes } = await admin().from("fiscal_certificates").select("id", { count: "exact", head: true });

    const sa = await loginAs(browser, "SUPERADMIN");
    await sa.goto("/admin/nfse/certificados");
    const sec = sa.locator("section[aria-labelledby=conferir]");
    await expect(sec.getByRole("heading", { name: /Conferir certificado novo/ })).toBeVisible();

    await sec.getByLabel("Certificado público").setInputFiles({ name: "chave.pem", mimeType: "application/x-pem-file", buffer: readFileSync(path.join(dir, "k.pem")) });
    await sec.getByRole("button", { name: "Conferir certificado" }).click();
    await expect(sec.getByRole("alert").filter({ hasText: "O arquivo tem chave privada" })).toBeVisible();

    await sec.getByLabel("Certificado público").setInputFiles({ name: "certificado.pem", mimeType: "application/x-pem-file", buffer: readFileSync(path.join(dir, "c.pem")) });
    await sec.getByRole("button", { name: "Conferir certificado" }).click();
    const alerta = sec.getByRole("alert").filter({ hasText: "Não pode ser cadastrado" });
    await expect(alerta).toBeVisible();
    await expect(alerta).toContainText(/impressão digital [0-9a-f]{16}…/);

    const { count: depois } = await admin().from("fiscal_certificates").select("id", { count: "exact", head: true });
    expect(depois).toBe(antes);
    const { data: logs } = await admin().from("audit_log").select("metadata").eq("action", "fiscal.certificate_upload_checked").gte("created_at", inicio);
    expect(logs?.length).toBe(2);
    expect(JSON.stringify(logs)).not.toMatch(/BEGIN|PRIVATE|FICTICIO/);
    expect(logs?.every((l) => (l.metadata as { ok: boolean }).ok === false)).toBe(true);

    // Contador não vê o formulário.
    const c = await loginAs(browser, "CONTADOR");
    await c.goto("/admin/nfse/certificados");
    await expect(c.getByRole("heading", { name: /Conferir certificado novo/ })).toHaveCount(0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
