import { GoogleTagManager } from "@/components/analytics/google-tag-manager";
import { WJBAssistant } from "@/components/assistant/WJBAssistant";
import { ExitIntentPopup } from "@/components/marketing/exit-intent-popup";
import { FirstTouchCapture } from "@/components/marketing/first-touch-capture";
import { SiteFooter } from "@/components/layout/site-footer";
import { JsonLd } from "@/components/shared/json-ld";
import { MotionProvider } from "@/components/shared/motion-provider";
import { SiteHeader } from "@/components/navigation/site-header";
import { getGtmId } from "@/config/analytics";
import { buildConsentBootstrapScript } from "@/lib/consent/consent-mode";
import { getOrganizationSchema } from "@/lib/seo/schema";

/**
 * Chrome de marketing (header com mega menu, rodapé institucional,
 * Assistente Virtual) — todas as páginas institucionais + `/admin` (que
 * também usa este mesmo header/footer, sem redesenho pedido ainda). Grupo
 * de rotas (2026-09-16, ver `src/app/layout.tsx`): não muda nenhuma URL,
 * só separa o chrome de marketing do app shell de `/portal`. Isolado do
 * root layout de propósito — assim nenhuma página aqui embaixo precisa de
 * API dinâmica só por causa do chrome, e continuam estáticas no build.
 */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  // Medição só nas páginas públicas (Portal e Admin ficam de fora). Sem ID
  // configurado em `src/config/analytics.ts`, nada do Google é carregado.
  const gtmId = getGtmId();
  return (
    <>
      {gtmId ? (
        <script
          // Precisa rodar antes de qualquer tag: define o consentimento padrão
          // "negado" (Consent Mode v2). Ver `src/lib/consent/consent-mode.ts`.
          dangerouslySetInnerHTML={{ __html: buildConsentBootstrapScript(gtmId) }}
        />
      ) : null}
      <JsonLd data={getOrganizationSchema()} />
      <MotionProvider>
        <SiteHeader />
      </MotionProvider>
      {children}
      <SiteFooter />
      <WJBAssistant />
      <FirstTouchCapture />
      <ExitIntentPopup />
      {gtmId ? <GoogleTagManager gtmId={gtmId} /> : null}
    </>
  );
}
