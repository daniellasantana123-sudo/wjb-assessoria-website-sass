import { listLeads } from "@/lib/leads";
import { LeadStatusSelect } from "@/components/leads/lead-status-select";

export async function LeadsList() {
  const leads = await listLeads();

  if (leads.length === 0) {
    return (
      <p className="text-muted-foreground p-6 text-center text-sm">
        Nenhum lead recebido ainda.
      </p>
    );
  }

  return (
    <div className="border-border divide-border divide-y rounded-md border">
      {leads.map((lead) => (
        <div key={lead.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-foreground font-medium">{lead.name || lead.email}</p>
              <span className="text-muted-foreground text-xs">{lead.formContext}</span>
            </div>
            <p className="text-muted-foreground text-sm">
              {lead.email}
              {lead.phone ? ` · ${lead.phone}` : ""}
              {lead.serviceInterest ? ` · ${lead.serviceInterest}` : ""}
            </p>
            {lead.message && (
              <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{lead.message}</p>
            )}
            <p className="text-muted-foreground mt-1 text-xs">
              {new Date(lead.createdAt).toLocaleString("pt-BR")}
              {lead.sourcePath ? ` · ${lead.sourcePath}` : ""}
            </p>
          </div>

          <LeadStatusSelect leadId={lead.id} status={lead.status} />
        </div>
      ))}
    </div>
  );
}
