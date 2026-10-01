import Link from "next/link";
import { BookOpen } from "lucide-react";

import { AppCredits } from "@/components/app-shell/app-credits";
import { AppMobileNav } from "@/components/app-shell/app-mobile-nav";
import { AppSidebarNav } from "@/components/app-shell/app-sidebar-nav";
import { LogoutButton } from "@/components/auth/logout-button";
import { Logo } from "@/components/navigation/logo";
import { requireStaffSession } from "@/lib/auth/dal";
import { getUnreadNotificationCount } from "@/lib/notifications";

const roleLabels: Record<string, string> = {
  super_admin: "Super admin",
  contador: "Contador",
  atendimento: "Atendimento",
};

/**
 * App shell do Admin WJB (2026-09-30, decisão do usuário): barra lateral
 * igual à do Portal, no lugar do cabeçalho/rodapé do site institucional e
 * da navegação só pelos cards de /admin. As rotas saíram do grupo `(site)`
 * para `src/app/admin` - as URLs não mudaram.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const session = await requireStaffSession();
  const unreadCount = await getUnreadNotificationCount();
  const who = session.fullName ?? session.email;
  const role = session.staffRole ? roleLabels[session.staffRole] ?? session.staffRole : null;

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="border-border bg-background sticky top-0 z-30 hidden h-screen w-64 shrink-0 flex-col border-r lg:flex">
        <div className="border-border flex items-center gap-2 border-b px-5 py-5">
          <Logo href="/admin" className="h-9 w-auto" />
          <span className="bg-primary/10 text-primary rounded-md px-2 py-0.5 text-xs font-semibold">
            Admin
          </span>
        </div>

        <AppSidebarNav area="admin" unreadCount={unreadCount} />

        <div className="border-border flex flex-col gap-3 border-t p-4">
          {/* <a> e não <Link>: o manual é um route handler com documento próprio. */}
          <a
            href="/admin/manual"
            target="_blank"
            rel="noopener"
            className="text-foreground hover:bg-muted focus-visible:ring-primary flex min-h-10 items-center gap-3 rounded-md px-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <BookOpen aria-hidden="true" className="h-4.5 w-4.5 shrink-0" />
            Manual da plataforma
          </a>
          <div className="min-w-0 px-2">
            <p className="text-foreground truncate text-sm font-medium">{who}</p>
            {role && <p className="text-muted-foreground text-xs">{role}</p>}
          </div>
          <div className="flex items-center justify-between gap-2 px-1">
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground focus-visible:ring-primary rounded-md text-xs underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              Voltar ao site
            </Link>
            <LogoutButton />
          </div>
          <AppCredits />
        </div>
      </aside>

      <header className="border-border bg-background sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <AppMobileNav area="admin" unreadCount={unreadCount} />
          <Logo href="/admin" className="h-8 w-auto" />
        </div>
        <LogoutButton />
      </header>

      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
