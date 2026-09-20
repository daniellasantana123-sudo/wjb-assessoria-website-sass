import type { Metadata } from "next";
import Link from "next/link";
import {
  Bell,
  Building2,
  Contact,
  LifeBuoy,
  MessageCircle,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react";

import { Container } from "@/components/layout/container";
import { LogoutButton } from "@/components/auth/logout-button";
import { requireStaffSession } from "@/lib/auth/dal";
import { getUnreadNotificationCount } from "@/lib/notifications";

export const metadata: Metadata = {
  title: "Admin WJB",
  robots: { index: false, follow: false },
};

const navCards = [
  {
    href: "/admin/empresas",
    icon: Building2,
    label: "Empresas",
    description: "Cadastrar empresas clientes e convidar pessoas para o Portal do Cliente",
  },
  {
    href: "/admin/leads",
    icon: Contact,
    label: "Leads",
    description: "Contato, proposta, simulador, assistente virtual e newsletter",
  },
  {
    href: "/admin/usuarios",
    icon: Users,
    label: "Usuários",
    description: "Time interno da WJB - conceder acesso e papel (super_admin)",
  },
  {
    href: "/admin/tickets",
    icon: LifeBuoy,
    label: "Tickets",
    description: "Chamados de suporte de todas as empresas clientes",
  },
  {
    href: "/admin/mensagens",
    icon: MessageCircle,
    label: "Mensagens",
    description: "Conversa contínua com cada empresa cliente",
  },
  {
    href: "/admin/notificacoes",
    icon: Bell,
    label: "Notificações",
    description: "Avisos de tickets e mensagens de todas as empresas",
  },
  {
    href: "/admin/logs",
    icon: ScrollText,
    label: "Logs",
    description: "Auditoria de ações sensíveis (empresas, documentos, obrigações, leads)",
  },
  {
    href: "/admin/seguranca",
    icon: ShieldCheck,
    label: "Segurança",
    description: "Verificação em duas etapas para a sua conta",
  },
];

/**
 * SAAS FASE 4 completa (empresas, usuários, leads, documentos, obrigações,
 * tickets, logs — ver roadmap) + Mensagens (SAAS FASE 3, staff também
 * acessa por aqui). `requireStaffSession` já bloqueia quem não é time WJB
 * (redireciona pro /portal).
 */
export default async function AdminPage() {
  const session = await requireStaffSession();
  const unreadCount = await getUnreadNotificationCount();

  return (
    <Container className="flex flex-1 flex-col gap-6 py-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-foreground text-2xl font-semibold">
            Olá, {session.fullName ?? session.email}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {session.email}
            {session.staffRole ? ` · ${session.staffRole}` : ""}
          </p>
        </div>
        <LogoutButton />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {navCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="border-border hover:bg-muted/30 focus-visible:ring-primary flex items-center gap-4 rounded-md border p-6 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <span className="bg-primary/10 text-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-md">
              <card.icon aria-hidden="true" className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-foreground flex items-center gap-2 font-medium">
                {card.label}
                {card.href === "/admin/notificacoes" && unreadCount > 0 && (
                  <span className="bg-primary text-primary-foreground flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </span>
              <span className="text-muted-foreground block text-sm">{card.description}</span>
            </span>
          </Link>
        ))}
      </div>
    </Container>
  );
}
