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
 *
 * Atualizado em 2026-09-23, quando a Plataforma SaaS entrou no ar: 4 itens
 * saíram de "Planejado" para "Disponível" porque passaram a ter rota real e
 * funcional no Portal do Cliente. Cada linha abaixo aponta a rota que a
 * sustenta — ao mexer aqui, conferir que a rota existe de verdade, porque
 * esta lista é exibida em três lugares (Home, /contabilidade-digital e
 * /area-do-cliente) e um status errado vira promessa falsa nos três.
 */
export const digitalAccountingItems: DigitalAccountingItem[] = [
  // /portal/suporte + /portal/mensagens
  { title: "Atendimento e suporte humano", status: "Disponível", icon: Headset },
  // /portal/documentos
  { title: "Central de documentos", status: "Disponível", icon: FolderOpen },
  // /portal/guias + /portal/obrigacoes
  { title: "Guias e obrigações", status: "Disponível", icon: BookOpen },
  // /portal/calendario
  { title: "Calendário de obrigações", status: "Disponível", icon: CalendarClock },
  // /portal/notificacoes + /portal/suporte
  { title: "Solicitações e notificações", status: "Disponível", icon: Bell },
  // Sem rota no Portal — continua sendo promessa futura, não entregue.
  { title: "Relatórios e indicadores", status: "Planejado", icon: BarChart3 },
];
