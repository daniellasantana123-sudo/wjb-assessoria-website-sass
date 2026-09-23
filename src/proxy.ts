import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { getSupabaseEnv } from "@/lib/db/supabase/env";
import { isSaasPublicEnabled } from "@/lib/saas-gate";

/**
 * `proxy.ts` (2026-09-16) — nesta versão do Next.js o antigo `middleware.ts`
 * foi descontinuado e renomeado para `proxy.ts` (ver
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
 *
 * Duas responsabilidades, seguindo o padrão oficial do Supabase SSR:
 * 1. Renovar o token de sessão a cada request (senão ele expira em uso).
 * 2. Checagem OTIMISTA de autenticação (só lê o cookie, sem bater no banco)
 *    pra redirecionar visitante deslogado tentando abrir /portal ou /admin.
 *
 * A checagem de verdade (sessão + RBAC por papel/tenant) acontece na DAL
 * (`src/lib/auth/dal.ts`), chamada em cada layout/page/Server Action de
 * /portal e /admin — a própria documentação do Next.js avisa para nunca
 * depender só do proxy: "Always verify authentication and authorization
 * inside each Server Function rather than relying on Proxy alone."
 */
/**
 * SAAS V2 (Portal do Cliente/Admin WJB/Login) ainda em desenvolvimento —
 * FASE 5 (Integrações) em andamento, FASE 6 (Segurança e Piloto) sem
 * pentest completo/monitoramento/piloto controlado. Decisão do usuário em
 * 2026-09-18: publicar o domínio real só com o site institucional (V1) por
 * enquanto, mantendo o código do SaaS no repo (não apagar nada) até a
 * plataforma estar pronta para acesso público real.
 *
 * `NEXT_PUBLIC_SAAS_PUBLIC_ENABLED` (não é secret — só um interruptor)
 * também esconde o item "Entrar na Plataforma" do menu (`src/config/
 * navigation.ts`) e a entrada de `/login` no sitemap (`src/app/
 * sitemap.ts`), pra nunca deixar um link/URL público apontando pra uma
 * rota bloqueada. Alternar essa env var pra "true" no deploy religa as
 * três coisas de uma vez, sem tocar em nenhum componente.
 */
const GATED_PREFIXES = [
  "/login",
  "/definir-senha",
  "/recuperar-senha",
  "/verificar-mfa",
  "/portal",
  "/admin",
  "/auth",
  "/api/me",
  "/api/documents",
  "/api/notifications",
];

function isSaasGated(pathname: string) {
  if (isSaasPublicEnabled()) return false;
  return GATED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function proxy(request: NextRequest) {
  if (isSaasGated(request.nextUrl.pathname)) {
    return NextResponse.rewrite(
      new URL(`/saas-indisponivel${request.nextUrl.pathname}`, request.url),
      {
        status: 404,
      },
    );
  }

  /*
   * Encaminha o pathname atual como header de request (`x-pathname`) —
   * padrão oficial do Next pra layouts de Server Component saberem a rota
   * atual sem virar Client Component só por isso (`headers()` em
   * `layout.tsx`, ver `src/app/layout.tsx`). Usado pra esconder o header/
   * footer/assistente de marketing nas rotas de app (`/portal`).
   */
  request.headers.set("x-pathname", request.nextUrl.pathname);

  // Lidas em tempo de execução (2026-09-23, ver `db/supabase/env.ts`): o
  // build desta hospedagem não recebe as variáveis do painel, então a
  // referência literal a `process.env.NEXT_PUBLIC_*` virava `undefined` no
  // código compilado e a sessão nunca era renovada em produção.
  const { url: supabaseUrl, anonKey: supabaseAnonKey } = getSupabaseEnv();

  /*
   * Sem projeto Supabase configurado ainda (SAAS FASE 1 em andamento — ver
   * roadmap), o proxy roda em toda rota do site, incluindo as páginas de
   * marketing da V1. Sem este guard, o site inteiro cairia com erro de
   * runtime só por faltar env var — passa direto até as credenciais
   * existirem, e só então a sessão passa a ser renovada/checada de verdade.
   */
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtectedRoute =
    pathname.startsWith("/portal") || pathname.startsWith("/admin");
  const isAuthRoute = pathname === "/login" || pathname === "/recuperar-senha";

  if (isProtectedRoute && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL("/portal", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Roda em tudo, exceto assets estáticos, imagens do Next e arquivos de
     * metadata — mesmo padrão negativo usado no `next.config.ts` do resto
     * do site.
     */
    "/((?!_next/static|_next/image|favicon.ico|apple-icon.png|icon.png|sitemap.xml|robots.txt).*)",
  ],
};
