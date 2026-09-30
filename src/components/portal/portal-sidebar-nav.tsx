"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isPortalNavItemActive, portalNavItems } from "@/config/portal-nav";
import { cn } from "@/lib/utils";

/**
 * Navegação da sidebar do Portal (desktop). É client component para ler a
 * rota com `usePathname()`: o layout do App Router não é renderizado de
 * novo ao navegar, então o item ativo calculado lá (via header
 * `x-pathname`) ficava preso na primeira página aberta (revisão 2026-09-30).
 */
export function PortalSidebarNav({ unreadCount }: { unreadCount: number }) {
  const pathname = usePathname();

  return (
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
                <span className="sr-only"> não lidas</span>
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
