import type { LucideIcon } from "lucide-react";
import { BarChart3, Bell, BookOpen, CalendarClock, FolderOpen, Headset } from "lucide-react";

export type DigitalAccountingStatus = "Disponível" | "Em implantação" | "Planejado";

export interface DigitalAccountingItem {
  title: string;
  status: DigitalAccountingStatus;
  icon: LucideIcon;
}

/**
 * Itens da Contabilidade Digital — seção 17 de Wjb-Website.md.
 * Status reflete o estado real do produto (não prometer módulos que ainda não existem).
 * Ver src/config/features.ts para os feature flags correspondentes.
 */
export const digitalAccountingItems: DigitalAccountingItem[] = [
  { title: "Atendimento e suporte humano", status: "Disponível", icon: Headset },
  { title: "Central de documentos", status: "Planejado", icon: FolderOpen },
  { title: "Guias e obrigações", status: "Planejado", icon: BookOpen },
  { title: "Calendário de obrigações", status: "Planejado", icon: CalendarClock },
  { title: "Solicitações e notificações", status: "Planejado", icon: Bell },
  { title: "Relatórios e indicadores", status: "Planejado", icon: BarChart3 },
];
