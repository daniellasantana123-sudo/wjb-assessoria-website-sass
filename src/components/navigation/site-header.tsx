import Link from "next/link";

import { Container } from "@/components/layout/container";
import { buttonVariants } from "@/components/ui/button";
import {
  clientAreaNav,
  empresaDropdown,
  headerCtas,
  mainNavLinks,
  solucoesDropdown,
} from "@/config/navigation";

import { Logo } from "./logo";
import { MegaMenu } from "./mega-menu";
import { MobileNav } from "./mobile-nav";
import { NavDropdown } from "./nav-dropdown";

export function SiteHeader() {
  return (
    <header className="border-border bg-background sticky top-0 z-40 border-b">
      {/*
       * `min-h-20 py-3` (2026-09-14, a pedido do usuário) — antes era
       * `h-20` fixo com o logo de 72px quase colado nas bordas (só 4px de
       * respiro acima/abaixo). Trocado por altura fluida baseada no
       * conteúdo: `py-3` (12px) soma ao alto do logo pra dar o respiro
       * vertical pedido, `min-h-20` é só um piso de segurança, não a
       * altura real (que agora vem do conteúdo + padding). `items-center`
       * garante logo/menu/CTAs alinhados verticalmente entre si.
       */}
      <Container className="flex min-h-20 items-center justify-between gap-4 py-3">
        <Logo />

        <nav aria-label="Menu principal" className="hidden items-center gap-6 xl:flex">
          <NavDropdown {...empresaDropdown} />
          <MegaMenu />
          <NavDropdown {...solucoesDropdown} />
          {mainNavLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hover:text-primary focus-visible:ring-primary text-foreground rounded-md text-sm font-medium whitespace-nowrap focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href={clientAreaNav.href}
            className="hover:text-primary focus-visible:ring-primary text-foreground rounded-md text-sm font-medium whitespace-nowrap focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {clientAreaNav.label}
          </Link>
        </nav>

        <div className="hidden items-center gap-3 xl:flex">
          <Link
            href={headerCtas.talkToAccountant.href}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {headerCtas.talkToAccountant.label}
          </Link>
          <Link
            href={headerCtas.requestProposal.href}
            className={buttonVariants({ variant: "cta", size: "sm" })}
          >
            {headerCtas.requestProposal.label}
          </Link>
        </div>

        <MobileNav />
      </Container>
    </header>
  );
}
