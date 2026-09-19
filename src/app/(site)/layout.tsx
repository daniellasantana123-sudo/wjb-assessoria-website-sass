import { WJBAssistant } from "@/components/assistant/WJBAssistant";
import { SiteFooter } from "@/components/layout/site-footer";
import { JsonLd } from "@/components/shared/json-ld";
import { SiteHeader } from "@/components/navigation/site-header";
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
  return (
    <>
      <JsonLd data={getOrganizationSchema()} />
      <SiteHeader />
      {children}
      <SiteFooter />
      <WJBAssistant />
    </>
  );
}
