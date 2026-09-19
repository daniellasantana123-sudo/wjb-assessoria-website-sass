import "server-only";

import { createClient } from "@/lib/db/supabase/server";

export interface MessageItem {
  id: string;
  authorName: string | null;
  authorIsStaff: boolean;
  body: string;
  createdAt: string;
}

/** Toda a conversa de uma empresa, mais antiga primeiro (ordem de leitura natural de um chat). */
export async function listMessages(tenantId: string): Promise<MessageItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select("id, body, created_at, profiles(full_name, is_wjb_staff)")
    .eq("tenant_id", tenantId)
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

export interface ConversationListItem {
  tenantId: string;
  tenantName: string;
  messageCount: number;
  lastMessageAt: string | null;
}

/**
 * Uma linha por empresa (Admin WJB) — inclui empresas sem nenhuma mensagem
 * ainda (staff pode puxar conversa primeiro), ordenadas por última
 * atividade; sem nenhuma mensagem ainda, ficam no fim, por nome.
 */
export async function listConversations(): Promise<ConversationListItem[]> {
  const supabase = await createClient();
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name")
    .order("name", { ascending: true });

  if (!tenants || tenants.length === 0) return [];

  const { data: messages } = await supabase
    .from("messages")
    .select("tenant_id, created_at")
    .in(
      "tenant_id",
      tenants.map((t) => t.id),
    );

  const stats = new Map<string, { count: number; lastAt: string }>();
  for (const message of messages ?? []) {
    const existing = stats.get(message.tenant_id);
    if (!existing) {
      stats.set(message.tenant_id, { count: 1, lastAt: message.created_at });
    } else {
      existing.count += 1;
      if (message.created_at > existing.lastAt) existing.lastAt = message.created_at;
    }
  }

  const conversations: ConversationListItem[] = tenants.map((tenant) => {
    const tenantStats = stats.get(tenant.id);
    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      messageCount: tenantStats?.count ?? 0,
      lastMessageAt: tenantStats?.lastAt ?? null,
    };
  });

  return conversations.sort((a, b) => {
    if (a.lastMessageAt && b.lastMessageAt) return a.lastMessageAt < b.lastMessageAt ? 1 : -1;
    if (a.lastMessageAt) return -1;
    if (b.lastMessageAt) return 1;
    return a.tenantName.localeCompare(b.tenantName, "pt-BR");
  });
}
