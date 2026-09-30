import Link from "next/link";

import { Logo } from "@/components/navigation/logo";
import { LogoutButton } from "@/components/auth/logout-button";
import { OrganizationSwitcher } from "@/components/portal/organization-switcher";
import { PortalMobileNav } from "@/components/portal/portal-mobile-nav";
import { PortalSidebarNav } from "@/components/portal/portal-sidebar-nav";
import { requireSession } from "@/lib/auth/dal";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { getActiveTenant, getMyOrganizations } from "@/lib/tenant";

/**
 * App shell do Portal do Cliente (SAAS FASE 2/4) — sidebar de navegação
 * fixa (desktop) / gaveta (mobile), no lugar do header/mega menu e rodapé
 * de marketing (escondidos pra `/portal` em `src/app/layout.tsx`, via
 * `x-pathname` do proxy). Aplica a todas as sub-rotas (`/portal/*`), não só
 * a `/portal` — clicar em "Documentos" na sidebar precisa manter a mesma
 * sidebar, não voltar pro header de marketing.
 */
export default async function PortalLayout({ children }: LayoutProps<"/portal">) {
  const session = await requireSession();
  const [organizations, activeTenant] = await Promise.all([
    getMyOrganizations(session.userId),
    getActiveTenant(session.userId),
  ]);
  const unreadCount = await getUnreadNotificationCount();
  const switcher = activeTenant ? (
    <OrganizationSwitcher
      organizations={organizations}
      activeId={activeTenant.id}
      userLabel={session.fullName ?? session.email}
    />
  ) : null;

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="border-border bg-background sticky top-0 z-30 hidden h-screen w-64 shrink-0 flex-col border-r lg:flex">
        <div className="border-border flex items-center border-b px-5 py-5">
          <Logo href="/portal" className="h-9 w-auto" />
        </div>

        <PortalSidebarNav unreadCount={unreadCount} />

        <div className="border-border flex flex-col gap-3 border-t p-4">
          {switcher}
          <div className="flex items-center justify-between gap-2 px-1">
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground focus-visible:ring-primary rounded-md text-xs underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              Voltar ao site
            </Link>
            <LogoutButton />
          </div>
        </div>
      </aside>

      <header className="border-border bg-background sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <PortalMobileNav unreadCount={unreadCount} organizationSwitcher={switcher} />
          <Logo href="/portal" className="h-8 w-auto" />
        </div>
        <LogoutButton />
      </header>

      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
