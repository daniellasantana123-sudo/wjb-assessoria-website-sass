"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import { Logo } from "@/components/navigation/logo";
import { isPortalNavItemActive, portalNavItems } from "@/config/portal-nav";
import { cn } from "@/lib/utils";

/**
 * Sidebar do Portal em telas estreitas — mesmo padrão de foco/scroll-lock/
 * Escape do menu mobile de marketing (`mobile-nav.tsx`), simplificado (sem
 * disclosures aninhadas, a navegação do Portal é uma lista plana de 5 itens).
 */
export function PortalMobileNav({
  activeHref,
  unreadCount = 0,
}: {
  activeHref: string;
  unreadCount?: number;
}) {
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
        aria-controls="portal-mobile-menu"
        aria-label="Abrir menu do Portal"
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
              id="portal-mobile-menu"
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label="Menu do Portal"
              className="animate-enter bg-background fixed inset-0 z-50 flex flex-col overflow-y-auto"
            >
              <div className="border-border flex items-center justify-between border-b px-4 py-3">
                <Logo href="/portal" className="h-9 w-auto" />
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

              <nav aria-label="Navegação do Portal" className="flex flex-1 flex-col gap-1 px-3 py-4">
                {portalNavItems.map((item) => {
                  const active = isPortalNavItemActive(activeHref, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={handleClose}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-md px-3 text-base font-medium transition-colors",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-muted",
                      )}
                    >
                      <item.icon aria-hidden="true" className="h-5 w-5 shrink-0" />
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
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
