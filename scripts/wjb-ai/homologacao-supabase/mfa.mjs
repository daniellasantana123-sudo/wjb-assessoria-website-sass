// Fase 10A.1: MFA (TOTP) dos usuários FICTÍCIOS da homologação.
// `ensureTotp` deixa a sessão do cliente em aal2 (senha + código): reaproveita
// o fator se o segredo é conhecido; senão apaga os fatores pela API admin
// (service role; um fator verificado não pode ser removido só com senha) e
// cadastra outro. Devolve o segredo para gravar no arquivo local.
import { readFileSync, writeFileSync } from "node:fs";

import { totp } from "./totp.mjs";

export async function ensureTotp({ admin, client, secret, label }) {
  const { data: u } = await client.auth.getUser();
  const userId = u.user.id;
  const { data: factors } = await client.auth.mfa.listFactors();
  const verified = (factors?.totp ?? []).find((f) => f.status === "verified");
  if (verified && secret) {
    const { error } = await client.auth.mfa.challengeAndVerify({ factorId: verified.id, code: totp(secret) });
    if (!error) return secret;
  }
  const { data: all } = await admin.auth.admin.mfa.listFactors({ userId });
  for (const f of all?.factors ?? []) await admin.auth.admin.mfa.deleteFactor({ userId, id: f.id });
  const { data: enroll, error: e1 } = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: `homolog-${label}-${Date.now()}` });
  if (e1) throw new Error(`enroll ${label}: ${e1.message}`);
  const { error: e2 } = await client.auth.mfa.challengeAndVerify({ factorId: enroll.id, code: totp(enroll.totp.secret) });
  if (e2) throw new Error(`verificação ${label}: ${e2.message}`);
  return enroll.totp.secret;
}

/** Grava/atualiza HOMOLOG_TOTP_<KEY> no arquivo local (600), preservando o resto. */
export function saveTotpSecret(file, key, secret) {
  let s = readFileSync(file, "utf8");
  const line = `HOMOLOG_TOTP_${key}=${secret}`;
  const re = new RegExp(`^HOMOLOG_TOTP_${key}=.*$`, "m");
  s = re.test(s) ? s.replace(re, line) : `${s.trimEnd()}\n${line}\n`;
  writeFileSync(file, s, { mode: 0o600 });
}
