/**
 * Seção 38 — baseline de segurança. CSP permite 'unsafe-inline' em script/style
 * porque o JSON-LD (seção 20) usa <script> inline e o Next injeta estilos
 * inline em alguns casos; uma CSP com nonce via middleware é um upgrade
 * possível depois, não bloqueante para o lançamento da V1.
 *
 * `'unsafe-eval'` (2026-09-14, a pedido do usuário — badge "N · 1 Issue"
 * aparecendo sempre no modo dev) — só em desenvolvimento
 * (`process.env.NODE_ENV === "development"`), nunca em produção. O React
 * em modo dev usa `eval()` internamente pro Fast Refresh/reconstrução de
 * call stack; sem isso, o navegador bloqueia por causa do CSP e o React
 * loga um `console.error` a cada carregamento de página, que o overlay de
 * dev do Next conta como "Issue" — cosmético, nunca afeta produção
 * ("React will never use eval() in production mode", confirmado no
 * próprio erro). Liberar isso só em dev não muda a postura de segurança
 * do site publicado.
 *
 * Convertido de next.config.ts para next.config.mjs em 2026-09-18: o
 * ambiente de build da Hostinger usa um glibc mais antigo que o exigido
 * pelo binário nativo do SWC (@next/swc-linux-x64-gnu), o que quebrava a
 * transpilação do next.config.ts durante `next build`. Um config em JS
 * puro não precisa de transpilação nenhuma para ser carregado.
 */
const isDev = process.env.NODE_ENV === "development";
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    /**
     * 2026-09-14, a pedido do usuário ("aumente a resolução/qualidade das
     * imagens") — o Next.js 16 tornou `images.qualities` obrigatório e usa
     * `[75]` como padrão quando omitido (mudança de segurança da v16.0.0).
     * Sem essa config, TODA imagem do site era recomprimida pelo otimizador
     * do Next para qualidade 75 na hora de servir, mesmo as fontes já
     * sendo geradas em qualidade 82 pelos scripts de `sharp` — essa
     * segunda recompressão (webp -> webp) era o principal fator de perda
     * visível. Um único valor na lista (sem incluir 75) força toda
     * requisição — mesmo as que não passam `quality` no `<Image>` (que
     * usa 75 como padrão implícito) — a ser arredondada pro valor mais
     * próximo permitido, ou seja, 90, sem precisar adicionar `quality={90}`
     * em cada um dos ~21 arquivos que usam `next/image`.
     */
    qualities: [90],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      {
        source: "/legal-e-societaria",
        destination: "/servicos/legalizacao-societario",
        permanent: true,
      },
      {
        source: "/contabilidade-completa",
        destination: "/servicos/contabilidade-completa",
        permanent: true,
      },
      {
        source: "/fiscal-e-tributario",
        destination: "/servicos/fiscal-tributario",
        permanent: true,
      },
      {
        source: "/certidoes",
        destination: "/servicos/certidoes-regularizacao",
        permanent: true,
      },
      {
        source: "/trabalhista-e-previdenciaria",
        destination: "/servicos/departamento-pessoal",
        permanent: true,
      },
      {
        source: "/consultoria",
        destination: "/servicos/consultoria-contabil",
        permanent: true,
      },
      {
        source: "/blog/simples-nacional-como-funciona",
        destination: "/blog/simples-nacional-guia-empresas",
        permanent: true,
      },
      {
        source: "/blog/esocial-o-que-sua-empresa-precisa-saber",
        destination: "/blog/departamento-pessoal-folha",
        permanent: true,
      },
      {
        source: "/blog/reforma-tributaria-o-que-muda",
        destination: "/blog/reforma-tributaria-como-preparar-empresa",
        permanent: true,
      },
      {
        source: "/planos/simulador",
        destination: "/planos",
        permanent: true,
      },
      /**
       * Link direto e memorizável pra Daniella, a assistente virtual do site
       * (2026-09-22, nome trocado de "Bia" pra "Daniella" no mesmo dia a
       * pedido do usuário) - pensado pra bio do Instagram, QR code impresso
       * e assinatura de e-mail. `permanent: false` (307, não 301) de
       * propósito - diferente dos redirects acima (conteúdo que mudou de
       * lugar pra sempre), este é um atalho de produto que pode mudar de
       * mecanismo no futuro, então não deve ser cacheado como permanente por
       * navegador/buscador. `WJBAssistant.tsx` lê "?assistente=aberto" no
       * destino e abre o painel automaticamente. Sem redirect de
       * compatibilidade a partir de "/bia" - a rota nunca chegou a ser
       * divulgada fora do código (implementada e renomeada no mesmo dia).
       */
      {
        source: "/daniella",
        destination: "/?assistente=aberto",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
