/**
 * Medição (GTM -> GA4 e Google Ads). Fase 6 do plano comercial
 * (`docs/comercial/PLANO_TRACKING_GA4_GTM_WJB.md`).
 *
 * O ID do contêiner fica no código, não em variável de ambiente: as páginas
 * são geradas no build, e o build da Hostinger não recebe as variáveis do
 * painel (ver CLAUDE.md). Um ID de contêiner GTM é público por natureza - ele
 * aparece no HTML de qualquer site que usa GTM -, então não há segredo aqui.
 *
 * Vazio = medição desligada: nenhum script do Google é carregado. Nunca
 * preencher com um ID inventado ou de exemplo.
 *
 * GA4 e Google Ads NÃO são instalados no código: as tags deles são criadas
 * dentro do contêiner GTM, que lê os eventos desta camada (`dataLayer`).
 */
export const analyticsConfig = {
  /** Contêiner Web do Google Tag Manager, formato `GTM-XXXXXXX`. */
  gtmId: "",
} as const;

const GTM_ID_PATTERN = /^GTM-[A-Z0-9]{4,12}$/;

export function getGtmId(): string | null {
  const id = analyticsConfig.gtmId.trim();
  return GTM_ID_PATTERN.test(id) ? id : null;
}
