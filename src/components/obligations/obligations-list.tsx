import Link from "next/link";

import { toggleObligationStatus, deleteObligation } from "@/actions/obligations";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/db/supabase/server";

function isOverdue(dueDate: string, status: string) {
  if (status === "done") return false;
  return new Date(dueDate + "T00:00:00") < new Date(new Date().toDateString());
}

/**
 * `detailHref` (2026-09-24): no Portal cada obrigação leva ao detalhe, que
 * mostra as etapas vindas do G-Click. No Admin a lista continua sem link -
 * a equipe acompanha o andamento no próprio G-Click, e um detalhe aqui
 * seria uma segunda tela para a mesma informação.
 */
export async function ObligationsList({
  tenantId,
  canManage = false,
  detailHref,
}: {
  tenantId: string;
  canManage?: boolean;
  detailHref?: (id: string) => string;
}) {
  const supabase = await createClient();
  const { data: obligations } = await supabase
    .from("obligations")
    .select("id, title, description, due_date, status, external_id")
    .eq("tenant_id", tenantId)
    .order("due_date", { ascending: true });

  if (!obligations || obligations.length === 0) {
    return (
      <p className="text-muted-foreground p-6 text-center text-sm">
        Nenhuma obrigação cadastrada ainda.
      </p>
    );
  }

  return (
    <div className="border-border divide-border divide-y rounded-md border">
      {obligations.map((obligation) => {
        const overdue = isOverdue(obligation.due_date, obligation.status);
        return (
          <div key={obligation.id} className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {detailHref ? (
                  <Link
                    href={detailHref(obligation.id)}
                    className="text-foreground hover:text-primary focus-visible:ring-primary rounded-md font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    {obligation.title}
                  </Link>
                ) : (
                  <p className="text-foreground font-medium">{obligation.title}</p>
                )}
                {obligation.status === "done" ? (
                  <Badge tone="success">Concluída</Badge>
                ) : overdue ? (
                  <Badge tone="danger">Atrasada</Badge>
                ) : (
                  <Badge tone="neutral">Pendente</Badge>
                )}
              </div>
              {obligation.description && (
                <p className="text-muted-foreground text-sm">{obligation.description}</p>
              )}
              <p className="text-muted-foreground text-sm">
                Vencimento:{" "}
                {new Date(obligation.due_date + "T00:00:00").toLocaleDateString("pt-BR")}
                {detailHref && obligation.external_id && " · acompanhe o andamento"}
              </p>
            </div>

            {canManage && (
              <div className="flex shrink-0 items-center gap-3">
                <form
                  action={async () => {
                    "use server";
                    await toggleObligationStatus(
                      obligation.id,
                      obligation.status === "done" ? "pending" : "done",
                    );
                  }}
                >
                  <button
                    type="submit"
                    className="text-primary hover:text-primary focus-visible:ring-primary rounded-md text-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    {obligation.status === "done" ? "Reabrir" : "Concluir"}
                  </button>
                </form>
                <form
                  action={async () => {
                    "use server";
                    await deleteObligation(obligation.id);
                  }}
                >
                  <button
                    type="submit"
                    className="text-danger hover:text-danger focus-visible:ring-primary rounded-md text-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    Apagar
                  </button>
                </form>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
