import Link from "next/link";
import { headers } from "next/headers";
import { Building2 } from "lucide-react";

import { Logo } from "@/components/navigation/logo";
import { LogoutButton } from "@/components/auth/logout-button";
import { PortalMobileNav } from "@/components/portal/portal-mobile-nav";
import { isPortalNavItemActive, portalNavItems } from "@/config/portal-nav";
import { requireSession } from "@/lib/auth/dal";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { getMyPrimaryTenant } from "@/lib/tenant";
import { cn } from "@/lib/utils";

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
  const tenant = await getMyPrimaryTenant(session.userId);
  const pathname = (await headers()).get("x-pathname") ?? "/portal";
  const unreadCount = await getUnreadNotificationCount();

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="border-border bg-background sticky top-0 z-30 hidden h-screen w-64 shrink-0 flex-col border-r lg:flex">
        <div className="border-border flex items-center border-b px-5 py-5">
          <Logo href="/portal" className="h-9 w-auto" />
        </div>

        <nav aria-label="Navegação do Portal" className="flex flex-1 flex-col gap-1 px-3 py-4">
          {portalNavItems.map((item) => {
            const active = isPortalNavItemActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-primary flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                  active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted",
                )}
              >
                <item.icon aria-hidden="true" className="h-4.5 w-4.5 shrink-0" />
                {item.label}
                {item.href === "/portal/notificacoes" && unreadCount > 0 && (
                  <span className="bg-primary text-primary-foreground ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-border flex flex-col gap-3 border-t p-4">
          {tenant && (
            <div className="flex items-center gap-2.5 px-1">
              <span className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
                <Building2 aria-hidden="true" className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="text-foreground block truncate text-sm font-medium">
                  {tenant.name}
                </span>
                <span className="text-muted-foreground block truncate text-xs">
                  {session.fullName ?? session.email}
                </span>
              </span>
            </div>
          )}
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
          <PortalMobileNav activeHref={pathname} unreadCount={unreadCount} />
          <Logo href="/portal" className="h-8 w-auto" />
        </div>
        <LogoutButton />
      </header>

      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
