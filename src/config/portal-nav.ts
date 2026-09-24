import {
  BarChart3,
  Bell,
  CalendarDays,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  MessageCircle,
  Receipt,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface PortalNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Itens da sidebar do Portal do Cliente — mesma ordem do antigo grid de navCards em /portal. */
export const portalNavItems: PortalNavItem[] = [
  { href: "/portal", label: "Visão geral", icon: LayoutDashboard },
  { href: "/portal/notificacoes", label: "Notificações", icon: Bell },
  { href: "/portal/documentos", label: "Documentos", icon: FileText },
  { href: "/portal/guias", label: "Guias", icon: Receipt },
  { href: "/portal/usuarios", label: "Usuários", icon: Users },
  { href: "/portal/obrigacoes", label: "Obrigações", icon: ClipboardCheck },
  { href: "/portal/calendario", label: "Calendário", icon: CalendarDays },
  { href: "/portal/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/portal/mensagens", label: "Mensagens", icon: MessageCircle },
  { href: "/portal/suporte", label: "Suporte", icon: LifeBuoy },
  { href: "/portal/seguranca", label: "Segurança", icon: ShieldCheck },
];

/**
 * "Visão geral" só ativa na rota exata; os demais também ativam em
 * sub-rotas (ex.: "Suporte" continua destacado dentro de um chamado
 * específico, `/portal/suporte/[id]`).
 */
export function isPortalNavItemActive(pathname: string, href: string): boolean {
  if (href === "/portal") return pathname === "/portal";
  return pathname === href || pathname.startsWith(`${href}/`);
}
