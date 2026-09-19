import "server-only";

import { createClient } from "@/lib/db/supabase/server";
import type { TicketStatus } from "@/types/database";

export interface TicketListItem {
  id: string;
  tenantId: string;
  tenantName: string | null;
  subject: string;
  status: TicketStatus;
  createdAt: string;
  messageCount: number;
  lastMessageAt: string | null;
}

/**
 * Lista de chamados — sem `tenantId`, lista de todos os tenants (uso do
 * Admin); com `tenantId`, só da empresa (uso do Portal, RLS também
 * restringe do lado do banco). `messageCount`/`lastMessageAt` vêm de uma
 * segunda query em `ticket_messages` (evita N+1 por ticket, mesmo
 * racional de outras listas do projeto que já aceitam uma query extra em
 * troca de não repetir round-trip por linha).
 */
export async function listTickets(tenantId?: string): Promise<TicketListItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("tickets")
    .select("id, tenant_id, subject, status, created_at, tenants(name)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (tenantId) query = query.eq("tenant_id", tenantId);

  const { data: tickets } = await query;
  if (!tickets || tickets.length === 0) return [];

  const { data: messages } = await supabase
    .from("ticket_messages")
    .select("ticket_id, created_at")
    .in(
      "ticket_id",
      tickets.map((t) => t.id),
    );

  const stats = new Map<string, { count: number; lastAt: string }>();
  for (const message of messages ?? []) {
    const existing = stats.get(message.ticket_id);
    if (!existing) {
      stats.set(message.ticket_id, { count: 1, lastAt: message.created_at });
    } else {
      existing.count += 1;
      if (message.created_at > existing.lastAt) existing.lastAt = message.created_at;
    }
  }

  return tickets.map((row) => {
    const tenant = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;
    const rowStats = stats.get(row.id);
    return {
      id: row.id,
      tenantId: row.tenant_id,
      tenantName: tenant?.name ?? null,
      subject: row.subject,
      status: row.status,
      createdAt: row.created_at,
      messageCount: rowStats?.count ?? 0,
      lastMessageAt: rowStats?.lastAt ?? null,
    };
  });
}

export interface TicketDetail {
  id: string;
  tenantId: string;
  tenantName: string | null;
  subject: string;
  status: TicketStatus;
  createdAt: string;
}

export async function getTicket(ticketId: string): Promise<TicketDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tickets")
    .select("id, tenant_id, subject, status, created_at, tenants(name)")
    .eq("id", ticketId)
    .maybeSingle();

  if (!data) return null;
  const tenant = Array.isArray(data.tenants) ? data.tenants[0] : data.tenants;
  return {
    id: data.id,
    tenantId: data.tenant_id,
    tenantName: tenant?.name ?? null,
    subject: data.subject,
    status: data.status,
    createdAt: data.created_at,
  };
}

export interface TicketMessageItem {
  id: string;
  authorName: string | null;
  authorIsStaff: boolean;
  body: string;
  createdAt: string;
}

export async function listTicketMessages(ticketId: string): Promise<TicketMessageItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ticket_messages")
    .select("id, body, created_at, profiles(full_name, is_wjb_staff)")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  if (!data) return [];

  return data.map((row) => {
    const author = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id,
      authorName: author?.full_name ?? null,
      authorIsStaff: author?.is_wjb_staff ?? false,
      body: row.body,
      createdAt: row.created_at,
    };
  });
}
