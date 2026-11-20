/**
 * Barreira contra colar segredo em campo de texto (Fase 5). Certificados,
 * chaves e senhas nunca vão para o Supabase nem para o GitHub: só a
 * referência ao cofre (`vault://...`) e metadados públicos do certificado.
 * O banco tem a mesma barreira em CHECK (migration 0027); esta é a primeira
 * linha, com mensagem clara para a equipe.
 */
const SECRET_PATTERNS: RegExp[] = [
  /-----BEGIN [A-Z ]+-----/, // PEM (certificado, chave)
  /PRIVATE KEY/i,
  /\b(senha|password|passwd|pwd)\b\s*[:=]/i,
  /\bsb_secret_[A-Za-z0-9_-]{10,}/, // chave secreta do Supabase
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./, // JWT
  /\bMII[A-Za-z0-9+/]{60,}/, // DER/PFX em base64
  /[A-Za-z0-9+/]{200,}={0,2}/, // blob base64 longo
];

export function looksLikeSecret(value: string): boolean {
  return SECRET_PATTERNS.some((re) => re.test(value));
}

export const VAULT_REFERENCE = /^vault:\/\/[A-Za-z0-9._/-]{3,200}$/;
export const SHA256_HEX = /^[0-9a-f]{64}$/;
