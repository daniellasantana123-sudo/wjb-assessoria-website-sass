"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Check, ChevronDown, Menu, X } from "lucide-react";

import {
  clientAreaNav,
  empresaDropdown,
  mainNavLinks,
  solucoesDropdown,
} from "@/config/navigation";
import { servicePages } from "@/config/service-pages";
import { cn } from "@/lib/utils";

/**
 * Mesma ordem de categorias do mega menu desktop (mega-menu.tsx) — mantém
 * os dois lugares consistentes sem duplicar a lista de categorias em si
 * (a ordem aqui é só pra agrupar visualmente, os dados vêm de servicePages).
 */
const serviceCategoryOrder = [
  "Fiscal e Tributário",
  "Societário e Legalização",
  "Contabilidade",
  "Departamento Pessoal",
  "Consultoria",
];

const serviceCategories = serviceCategoryOrder
  .map((category) => ({
    category,
    items: servicePages.filter((service) => service.category === category),
  }))
  .filter((group) => group.items.length > 0);

interface MobileDisclosureProps {
  label: string;
  contentId: string;
  open: boolean;
  onToggle: () => void;
  bordered?: boolean;
  children: React.ReactNode;
}

function MobileDisclosure({
  label,
  contentId,
  open,
  onToggle,
  bordered = false,
  children,
}: MobileDisclosureProps) {
  return (
    <div className={cn(bordered && "border-border border-t pt-1")}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={contentId}
        className="hover:bg-muted text-foreground flex min-h-11 w-full items-center justify-between rounded-md px-3 text-base font-medium transition-colors"
      >
        {label}
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "h-5 w-5 transition-transform duration-300",
            open && "rotate-180",
          )}
        />
      </button>
      <div
        id={contentId}
        aria-hidden={!open}
        inert={!open}
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [empresaOpen, setEmpresaOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [solucoesOpen, setSolucoesOpen] = useState(false);
  const [clientAreaOpen, setClientAreaOpen] = useState(false);
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
    <div className="xl:hidden">
      <button
        ref={triggerButtonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label="Abrir menu"
        className="text-foreground hover:bg-muted focus-visible:ring-primary flex h-11 w-11 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <Menu aria-hidden="true" className="h-6 w-6" />
      </button>

      {/*
       * `createPortal` (2026-09-14, bug real encontrado em teste responsivo)
       * — o header é `sticky` + `z-index`, o que cria um stacking context
       * próprio; sem o portal, este diálogo em tela cheia (`z-50`) fica
       * "preso" dentro do stacking context do header (efetivamente no
       * mesmo nível do header), e o banner de cookies/Assistente Virtual
       * (montados depois, fora do header, em layout.tsx) pintam por cima
       * dele mesmo sendo `aria-modal="true"`. O portal renderiza o diálogo
       * direto em `document.body`, fora da árvore do header.
       */}
      {open
        ? createPortal(
            <div
              id="mobile-menu"
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label="Menu principal"
              className="animate-enter bg-background fixed inset-0 z-50 flex flex-col overflow-y-auto"
            >
              <div className="border-border flex items-center justify-between border-b px-4 py-3">
                <span className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
                  Menu
                </span>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={handleClose}
                  aria-label="Fechar menu"
                  className="hover:bg-muted focus-visible:ring-primary text-foreground flex h-11 w-11 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <X aria-hidden="true" className="h-6 w-6" />
                </button>
              </div>

              <nav
                aria-label="Menu mobile"
                className="flex flex-1 flex-col gap-1 px-4 py-4"
              >
                {/*
                 * Empresa (2026-09-14, a pedido do usuário, print de
                 * referência) — antes os 4 itens (Sobre/Como
                 * funciona/Conteúdos/Dúvidas) apareciam soltos como links
                 * planos no meio do menu mobile, fora de ordem em relação
                 * ao dropdown "Empresa" do desktop. Agora viram uma seção
                 * expansível própria (mesmo padrão de Serviços/Soluções/
                 * Área do Cliente), lendo direto de `empresaDropdown.items`
                 * — mesma fonte de dados do desktop, então a ordem
                 * (Sobre, Como funciona, Conteúdos, Dúvidas) nunca diverge
                 * entre os dois. Posicionada primeiro na lista, espelhando
                 * a ordem do header desktop (Empresa, Serviços, Soluções).
                 */}
                <MobileDisclosure
                  label={empresaDropdown.label}
                  contentId="mobile-empresa"
                  open={empresaOpen}
                  onToggle={() => setEmpresaOpen((v) => !v)}
                >
                  <div className="flex flex-col gap-1 pt-1 pb-2 pl-3">
                    {empresaDropdown.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={handleClose}
                        className="text-muted-foreground hover:bg-muted hover:text-foreground flex min-h-11 items-center rounded-md px-3 text-sm transition-colors"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </MobileDisclosure>

                <MobileDisclosure
                  label="Serviços"
                  contentId="mobile-services"
                  open={servicesOpen}
                  onToggle={() => setServicesOpen((v) => !v)}
                >
                  <div className="flex flex-col gap-4 pt-1 pb-2 pl-3">
                    {serviceCategories.map((group) => (
                      <div key={group.category}>
                        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                          {group.category}
                        </p>
                        <div className="mt-1 flex flex-col gap-1">
                          {group.items.map((service) => (
                            <Link
                              key={service.slug}
                              href={`/servicos/${service.slug}`}
                              onClick={handleClose}
                              className="text-muted-foreground hover:bg-muted hover:text-foreground flex min-h-11 items-center gap-2 rounded-md px-3 text-sm transition-colors"
                            >
                              <Check
                                aria-hidden="true"
                                className="text-primary h-3.5 w-3.5 shrink-0"
                              />
                              {service.title}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                    <Link
                      href="/servicos"
                      onClick={handleClose}
                      className="text-primary hover:bg-muted flex min-h-11 items-center rounded-md px-3 text-sm font-medium transition-colors"
                    >
                      Ver todos os serviços →
                    </Link>
                  </div>
                </MobileDisclosure>

                <MobileDisclosure
                  label="Soluções"
                  contentId="mobile-solucoes"
                  open={solucoesOpen}
                  onToggle={() => setSolucoesOpen((v) => !v)}
                >
                  <div className="flex flex-col gap-1 pt-1 pb-2 pl-3">
                    {solucoesDropdown.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={handleClose}
                        className="text-muted-foreground hover:bg-muted hover:text-foreground flex min-h-11 items-center rounded-md px-3 text-sm transition-colors"
                      >
                        {item.label}
                      </Link>
                    ))}
                    {solucoesDropdown.footer ? (
                      <Link
                        href={solucoesDropdown.footer.href}
                        onClick={handleClose}
                        className="text-primary hover:bg-muted flex min-h-11 items-center rounded-md px-3 text-sm font-medium transition-colors"
                      >
                        {solucoesDropdown.footer.label} →
                      </Link>
                    ) : null}
                  </div>
                </MobileDisclosure>

                {mainNavLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={handleClose}
                    className="hover:bg-muted text-foreground flex min-h-11 items-center rounded-md px-3 text-base font-medium transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}

                <MobileDisclosure
                  label={clientAreaNav.label}
                  contentId="mobile-client-area"
                  open={clientAreaOpen}
                  onToggle={() => setClientAreaOpen((v) => !v)}
                  bordered
                >
                  <div className="flex flex-col gap-1 pt-1 pb-2 pl-3">
                    {clientAreaNav.children.map((item) => (
                      <Link
                        key={item.label}
                        href={item.href}
                        onClick={handleClose}
                        className="text-muted-foreground hover:bg-muted hover:text-foreground flex min-h-11 items-center rounded-md px-3 text-sm transition-colors"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </MobileDisclosure>
              </nav>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
