import { adminNavItems } from "@/config/admin-nav";
import { portalNavItems, type PortalNavItem } from "@/config/portal-nav";

/**
 * As duas áreas logadas usam a mesma barra lateral (2026-09-30). A área é
 * passada como texto ("portal" | "admin") e resolvida aqui, no cliente: os
 * ícones são componentes e não podem ir de um Server Component para um
 * Client Component como prop.
 */
export type AppArea = "portal" | "admin";

export const appAreas: Record<
  AppArea,
  {
    items: PortalNavItem[];
    rootHref: string;
    notificationsHref: string;
    navLabel: string;
    openMenuLabel: string;
    menuLabel: string;
    help: { href: string; label: string };
  }
> = {
  portal: {
    items: portalNavItems,
    rootHref: "/portal",
    notificationsHref: "/portal/notificacoes",
    navLabel: "Navegação do Portal",
    openMenuLabel: "Abrir menu do Portal",
    menuLabel: "Menu do Portal",
    help: { href: "/ajuda", label: "Ajuda: guia do Portal" },
  },
  admin: {
    items: adminNavItems,
    rootHref: "/admin",
    notificationsHref: "/admin/notificacoes",
    navLabel: "Navegação do Admin",
    openMenuLabel: "Abrir menu do Admin",
    menuLabel: "Menu do Admin",
    help: { href: "/admin/manual", label: "Manual da plataforma" },
  },
};
