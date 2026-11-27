/**
 * Consent Mode v2 do Google + carregamento do GTM condicionado ao
 * consentimento (Fase 6 do plano comercial).
 *
 * Modo "básico": o script do GTM só é baixado depois que a pessoa clica em
 * "Aceitar todos". Antes disso nenhum pedido vai para o Google - nem os pings
 * sem cookie do modo "avançado". É a opção mais conservadora para a LGPD e a
 * que corresponde ao texto atual do banner. O custo é não haver modelagem de
 * conversões para quem recusa.
 *
 * Mesmo carregando só após o aceite, os sinais de consentimento são enviados
 * (exigência do Google Ads desde 2024) e voltam a "negado" se a pessoa
 * revogar em "Preferências de cookies".
 */

export const CONSENT_STORAGE_KEY = "wjb-cookie-consent";

export const DENIED_CONSENT = {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "denied",
} as const;

export const GRANTED_CONSENT = {
  ad_storage: "granted",
  ad_user_data: "granted",
  ad_personalization: "granted",
  analytics_storage: "granted",
} as const;

/**
 * Telas de senha ficam fora da medição: não há o que medir comercialmente
 * nelas, e qualquer tag mal configurada no GTM (ex.: captura de cliques em
 * formulário) poderia encostar em campos de senha.
 */
export const UNTRACKED_PATH_PATTERN = /^\/(login|recuperar-senha|definir-senha|verificar-mfa)(\/|$)/;

export function isTrackedPath(pathname: string): boolean {
  return !UNTRACKED_PATH_PATTERN.test(pathname);
}

/**
 * Hotfix de privacidade (Fase 10F): até esta correção, um envio feito antes
 * da hidratação caía no envio nativo do navegador (GET) e levava nome, e-mail,
 * telefone e mensagem para a URL. Links assim podem estar em histórico,
 * favoritos ou mensagens. Antes de qualquer tag, os campos dos formulários do
 * site são retirados da URL (os parâmetros de campanha, como `utm_*` e
 * `gclid`, ficam). Assim o GTM/GA4 nunca recebe esses dados em `page_location`.
 */
export const PII_FORM_FIELDS = [
  "name",
  "email",
  "phone",
  "cnpj",
  "company",
  "message",
  "city",
  "state",
  "businessActivity",
  "serviceInterest",
  "consent",
  "website",
  "formContext",
  "code",
  // pré-cadastro da emissão de notas (Fase 8)
  "perfil",
  "volume",
  "objetivo",
  "marketing",
] as const;

export function buildPiiQueryScrubSource(): string {
  const fields = JSON.stringify(PII_FORM_FIELDS);
  return (
    "try{if(location.search){var __u=new URL(location.href),__c=0;" +
    `${fields}.forEach(function(k){if(__u.searchParams.has(k)){__u.searchParams.delete(k);__c=1;}});` +
    "if(__c){history.replaceState(history.state,'',__u.pathname+(__u.search||'')+__u.hash);}}}catch(e){}"
  );
}

/**
 * Fase 10G (achado em produção): a URL da página já saía limpa, mas a
 * ORIGEM (`document.referrer`, enviada ao GA4 como `dr`) ainda podia trazer
 * os campos, por exemplo quando o desafio anti-robô do CDN recarrega a página
 * que chegou com dados na URL. O `document.referrer` não pode ser alterado;
 * então a origem informada ao Google (`page_referrer`) é a mesma origem
 * sem os campos. Roda depois de `gtag` existir e antes de qualquer tag.
 */
export function buildPiiReferrerScrubSource(): string {
  const fields = JSON.stringify(PII_FORM_FIELDS);
  return (
    "try{if(document.referrer){var __r=new URL(document.referrer),__d=0;" +
    `${fields}.forEach(function(k){if(__r.searchParams.has(k)){__r.searchParams.delete(k);__d=1;}});` +
    "if(__d){gtag('set',{page_referrer:__r.origin+__r.pathname+(__r.search||'')});}}}catch(e){}"
  );
}

type GtagWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };

/**
 * Script embutido no `<head>`, antes de qualquer outro: define o padrão
 * "negado", reaplica uma escolha já salva e, se ela for "aceito", já começa a
 * baixar o GTM sem esperar o React.
 */
export function buildConsentBootstrapScript(gtmId: string): string {
  const denied = JSON.stringify({ ...DENIED_CONSENT, functionality_storage: "granted", security_storage: "granted", wait_for_update: 500 });
  const granted = JSON.stringify(GRANTED_CONSENT);
  return [
    buildPiiQueryScrubSource(),
    "window.dataLayer=window.dataLayer||[];",
    "function gtag(){dataLayer.push(arguments);}",
    "window.gtag=gtag;",
    buildPiiReferrerScrubSource(),
    `gtag('consent','default',${denied});`,
    "gtag('set','ads_data_redaction',true);",
    "try{",
    `if(!${UNTRACKED_PATH_PATTERN.toString()}.test(location.pathname)&&localStorage.getItem(${JSON.stringify(CONSENT_STORAGE_KEY)})==='accepted'){`,
    `gtag('consent','update',${granted});`,
    `${loadGtmSource(gtmId)}`,
    "}",
    "}catch(e){}",
  ].join("");
}

function loadGtmSource(gtmId: string): string {
  const id = JSON.stringify(gtmId);
  return (
    "if(!window.__wjbGtm){window.__wjbGtm=1;" +
    "dataLayer.push({'gtm.start':new Date().getTime(),event:'gtm.js'});" +
    "var s=document.createElement('script');s.async=true;" +
    `s.src='https://www.googletagmanager.com/gtm.js?id='+${id};` +
    "document.head.appendChild(s);}"
  );
}

function getGtag(): ((...args: unknown[]) => void) | null {
  if (typeof window === "undefined") return null;
  const w = window as GtagWindow;
  w.dataLayer = w.dataLayer ?? [];
  if (!w.gtag) {
    w.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params -- o GTM exige o objeto `arguments`, não um array.
      w.dataLayer!.push(arguments);
    };
  }
  return w.gtag;
}

/** Carrega o GTM uma única vez (mesma trava do script embutido). */
export function loadGtm(gtmId: string) {
  if (typeof window === "undefined") return;
  const w = window as GtagWindow & { __wjbGtm?: number };
  if (w.__wjbGtm || !isTrackedPath(window.location.pathname)) return;
  w.__wjbGtm = 1;
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmId)}`;
  document.head.appendChild(script);
}

export function updateConsentMode(accepted: boolean) {
  getGtag()?.("consent", "update", accepted ? GRANTED_CONSENT : DENIED_CONSENT);
}

/**
 * Ao revogar, apaga os cookies que GA4 e Google Ads já tinham gravado
 * (`_ga*`, `_gcl*`, `_gid`). O Consent Mode impede novas gravações, mas não
 * apaga as existentes.
 */
export function clearGoogleCookies() {
  if (typeof document === "undefined") return;
  const host = window.location.hostname;
  const domains = ["", host, `.${host}`, `.${host.replace(/^www\./, "")}`];
  for (const pair of document.cookie.split(";")) {
    const name = pair.split("=")[0]?.trim();
    if (!name || !/^(_ga|_gid|_gcl|_gac)/.test(name)) continue;
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ""}`;
    }
  }
}
