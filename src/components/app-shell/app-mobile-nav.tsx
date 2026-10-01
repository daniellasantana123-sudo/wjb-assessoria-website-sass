"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp, Menu, X } from "lucide-react";

import { Logo } from "@/components/navigation/logo";
import { appAreas, type AppArea } from "@/components/app-shell/app-areas";
import { AppCredits } from "@/components/app-shell/app-credits";
import { isNavItemActive } from "@/config/portal-nav";
import { cn } from "@/lib/utils";

/**
 * Sidebar do Portal em telas estreitas — mesmo padrão de foco/scroll-lock/
 * Escape do menu mobile de marketing (`mobile-nav.tsx`), simplificado (sem
 * disclosures aninhadas, a navegação do Portal é uma lista plana de 5 itens).
 */
export function AppMobileNav({
  area,
  unreadCount = 0,
  organizationSwitcher,
}: {
  area: AppArea;
  unreadCount?: number;
  /**
   * Seletor de empresa - antes só existia na sidebar de desktop, então
   * abaixo de 1024px quem tinha duas empresas não conseguia trocar.
   */
  organizationSwitcher?: ReactNode;
}) {
  // Rota lida no cliente: o layout que renderiza este componente não é
  // refeito ao navegar, então uma prop vinda dele ficaria desatualizada.
  const activeHref = usePathname();
  const config = appAreas[area];
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);

  function handleClose() {
    setOpen(false);
    triggerButtonRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        handleClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled])",
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerButtonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="app-mobile-menu"
        aria-label={
          unreadCount > 0
            ? `${config.openMenuLabel} (${unreadCount} notificações não lidas)`
            : config.openMenuLabel
        }
        className="text-foreground hover:bg-muted focus-visible:ring-primary relative flex h-10 w-10 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <Menu aria-hidden="true" className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="bg-primary absolute top-1.5 right-1.5 h-2 w-2 rounded-full"
          />
        )}
      </button>

      {open
        ? createPortal(
            <div
              id="app-mobile-menu"
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label={config.menuLabel}
              className="animate-enter bg-background fixed inset-0 z-50 flex flex-col overflow-y-auto"
            >
              <div className="border-border flex items-center justify-between border-b px-4 py-3">
                <Logo href={config.rootHref} className="h-9 w-auto" />
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={handleClose}
                  aria-label="Fechar menu"
                  className="hover:bg-muted focus-visible:ring-primary text-foreground flex h-10 w-10 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <X aria-hidden="true" className="h-5 w-5" />
                </button>
              </div>

              <nav aria-label={config.navLabel} className="flex flex-1 flex-col gap-1 px-3 py-4">
                {config.items.map((item) => {
                  const active = isNavItemActive(activeHref, item.href, config.rootHref);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={handleClose}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "focus-visible:ring-primary flex min-h-11 items-center gap-3 rounded-md px-3 text-base font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-muted",
                      )}
                    >
                      <item.icon aria-hidden="true" className="h-5 w-5 shrink-0" />
                      {item.label}
                      {item.href === config.notificationsHref && unreadCount > 0 && (
                        <span className="bg-primary text-primary-foreground ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums">
                          {unreadCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>

              <div className="px-3 pb-2">
                <a
                  href={config.help.href}
                  target="_blank"
                  rel="noopener"
                  onClick={handleClose}
                  className="text-foreground hover:bg-muted focus-visible:ring-primary flex min-h-11 items-center gap-3 rounded-md px-3 text-base font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <CircleHelp aria-hidden="true" className="h-5 w-5 shrink-0" />
                  {config.help.label}
                </a>
              </div>

              {organizationSwitcher ? (
                <div className="border-border border-t p-4">{organizationSwitcher}</div>
              ) : null}

              <div className="border-border border-t px-4 py-3">
                <AppCredits />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
