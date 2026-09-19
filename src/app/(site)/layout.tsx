import { MotionConfig } from "framer-motion";

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
      {/* `reducedMotion="user"` (2026-09-19, header/menu mobile ganharam
          framer-motion) — a regra global de `prefers-reduced-motion` em
          globals.css só zera `animation`/`transition` via CSS; as animações
          do framer-motion são orquestradas por JS e não são cobertas por
          ela, então precisam desse opt-in próprio pra respeitar a mesma
          preferência do usuário. */}
      <MotionConfig reducedMotion="user">
        <SiteHeader />
      </MotionConfig>
      {children}
      <SiteFooter />
      <WJBAssistant />
    </>
  );
}
