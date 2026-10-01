/**
 * Normalização do texto de busca de cliente no G-Click (2026-09-24).
 *
 * Pura e separada porque resolve um problema concreto e fácil de errar: a
 * API guarda a inscrição **sem pontuação** (`"inscricao": "12345678000123"`,
 * conforme as respostas de exemplo da coleção oficial), enquanto qualquer
 * pessoa digita o CNPJ como ele aparece no cartão - com ponto, barra e
 * traço. Buscar o texto cru simplesmente não acharia nada, e o erro
 * pareceria "o cliente não existe no G-Click".
 */

/** Um texto é tratado como documento quando é quase só dígito. */
export function looksLikeDocument(text: string): boolean {
  const digits = text.replace(/\D/g, "");
  if (digits.length < 11) return false;
  // Nome de empresa raramente tem 11+ dígitos; pontuação de CNPJ/CPF, sim.
  const nonDigits = text.replace(/[\d.\-/\s]/g, "");
  return nonDigits.length === 0;
}

/**
 * Devolve o texto pronto para o parâmetro `texto` da busca.
 *
 * Só remove pontuação quando o texto parece um CNPJ ou CPF - buscar por
 * nome precisa preservar as letras, e tirar os dígitos de "Loja 24h"
 * estragaria a busca.
 */
export function normalizeClientSearch(raw: string): string {
  const text = raw.trim();
  return looksLikeDocument(text) ? text.replace(/\D/g, "") : text;
}

/** Busca curta demais não vale uma chamada de rede nem uma lista gigante. */
export const MIN_SEARCH_LENGTH = 3;

export function isSearchable(raw: string): boolean {
  return normalizeClientSearch(raw).length >= MIN_SEARCH_LENGTH;
}

/**
 * Dois documentos são o mesmo se os dígitos baterem.
 *
 * Comparar as strings cruas falharia entre sistemas: o mesmo CNPJ aparece
 * como `35.673.259/0001-88` num lugar e `35673259000188` no outro.
 */
export function documentsMatch(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const left = a.replace(/\D/g, "");
  const right = b.replace(/\D/g, "");
  return left.length > 0 && left === right;
}

/** Minúsculas e sem acento: "Pimpolha" acha "PIMPOLHA" e "São" acha "SAO". */
export function foldText(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/**
 * Um cliente do G-Click combina com a busca (2026-10-01).
 *
 * A busca da própria API olha só a razão social (`nome`) e ignora o CNPJ e
 * o nome fantasia (`apelido`) - e a equipe costuma conhecer o cliente pelo
 * nome fantasia ("PIMPOLHA"), que muitas vezes nem aparece na razão
 * social. Por isso a plataforma filtra a lista completa aqui:
 * - documento: compara só os dígitos, aceitando parte do CNPJ;
 * - texto: todas as palavras digitadas precisam aparecer na razão social
 *   OU no nome fantasia, sem diferenciar maiúscula nem acento.
 */
export function clientMatches(
  client: { name: string; tradeName?: string | null; document: string | null },
  rawQuery: string,
): boolean {
  const query = rawQuery.trim();
  if (!query) return false;

  const digits = query.replace(/\D/g, "");
  if (looksLikeDocument(query) || (digits.length >= 5 && digits.length === query.replace(/[.\-/\s]/g, "").length)) {
    return (client.document ?? "").replace(/\D/g, "").includes(digits);
  }

  const haystack = foldText(`${client.name} ${client.tradeName ?? ""}`);
  return foldText(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

/**
 * CNPJ/CPF só com dígitos (como o G-Click guarda) no formato que a equipe
 * lê no cartão. Qualquer outro conteúdo volta como veio.
 */
export function formatDocument(document: string | null | undefined): string | null {
  const digits = (document ?? "").replace(/\D/g, "");
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }
  if (digits.length === 11) return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return document?.trim() || null;
}
