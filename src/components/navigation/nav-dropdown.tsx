"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";

import { useDisclosure } from "@/hooks/use-disclosure";
import { cn } from "@/lib/utils";
import { type NavDropdownGroup } from "@/config/navigation";

export function NavDropdown({ label, items, footer }: NavDropdownGroup) {
  const { open, setOpen, rootRef } = useDisclosure();
  const panelId = `nav-dropdown-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={panelId}
        onClick={() => setOpen(true)}
        className="hover:text-primary focus-visible:ring-primary text-foreground flex items-center gap-1 rounded-md text-sm font-medium whitespace-nowrap focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        {label}
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "h-4 w-4 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <>
          {/* Ponte invisível — sem ela, o gap entre o botão e o painel faz o
              mouse "sair" do dropdown (mouseleave) antes de alcançar o
              painel, fechando o menu antes do usuário conseguir clicar num
              item. */}
          <div className="absolute inset-x-0 top-full h-3" aria-hidden="true" />
          <div
            id={panelId}
            className="animate-enter border-border bg-background absolute top-full left-0 z-40 mt-3 w-56 rounded-md border p-3 shadow-lg"
          >
            <ul className="flex flex-col gap-1">
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="hover:bg-muted hover:text-primary focus-visible:ring-primary text-foreground flex min-h-9 items-center rounded-md px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            {footer ? (
              <div className="border-border mt-2 border-t pt-2">
                <Link
                  href={footer.href}
                  onClick={() => setOpen(false)}
                  className="text-primary flex min-h-9 items-center rounded-md px-3 text-sm font-medium hover:underline"
                >
                  {footer.label} →
                </Link>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
