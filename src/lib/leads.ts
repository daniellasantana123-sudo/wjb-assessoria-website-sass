import "server-only";

import { createClient } from "@/lib/db/supabase/server";
import type { LeadStatus } from "@/types/database";

export interface LeadListItem {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  serviceInterest: string | null;
  message: string | null;
  formContext: string;
  sourcePath: string | null;
  status: LeadStatus;
  createdAt: string;
}

/** Últimos 100 leads — sem paginação ainda, volume real não justifica por enquanto. */
export async function listLeads(): Promise<LeadListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select(
      "id, name, email, phone, service_interest, message, form_context, source_path, status, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (!data) return [];

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    serviceInterest: row.service_interest,
    message: row.message,
    formContext: row.form_context,
    sourcePath: row.source_path,
    status: row.status,
    createdAt: row.created_at,
  }));
}
