import Link from "next/link";

import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin/nfse", label: "Solicitações" },
  { href: "/admin/nfse/perfis", label: "Perfis fiscais e autorizações" },
  { href: "/admin/nfse/permissoes", label: "Permissão de aprovação" },
  { href: "/admin/nfse/certificados", label: "Certificados" },
];

export function NfseAdminNav({ current }: { current: string }) {
  return (
    <nav
      aria-label="Seções de NFS-e"
      className="border-border flex flex-wrap gap-2 border-b pb-3"
    >
      {ITEMS.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={current === i.href ? "page" : undefined}
          className={cn(
            "focus-visible:ring-primary rounded-md px-3 py-1.5 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none",
            current === i.href
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
