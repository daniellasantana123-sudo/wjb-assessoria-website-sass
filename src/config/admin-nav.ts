import {
  Bell,
  Building2,
  Contact,
  LayoutDashboard,
  LifeBuoy,
  MessageCircle,
  Plug,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react";

import type { PortalNavItem } from "@/config/portal-nav";

/**
 * Itens da barra lateral do Admin WJB (2026-09-30, decisão do usuário: menu
 * igual ao do Portal, no lugar de navegar só pelos cards de /admin).
 * Ordem pelo uso no dia a dia: clientes e atendimento primeiro.
 */
export const adminNavItems: PortalNavItem[] = [
  { href: "/admin", label: "Início", icon: LayoutDashboard },
  { href: "/admin/empresas", label: "Empresas", icon: Building2 },
  { href: "/admin/tickets", label: "Tickets", icon: LifeBuoy },
  { href: "/admin/mensagens", label: "Mensagens", icon: MessageCircle },
  { href: "/admin/notificacoes", label: "Notificações", icon: Bell },
  { href: "/admin/leads", label: "Leads", icon: Contact },
  { href: "/admin/usuarios", label: "Usuários", icon: Users },
  { href: "/admin/integracoes", label: "Integrações", icon: Plug },
  { href: "/admin/logs", label: "Logs", icon: ScrollText },
  { href: "/admin/seguranca", label: "Segurança", icon: ShieldCheck },
];
