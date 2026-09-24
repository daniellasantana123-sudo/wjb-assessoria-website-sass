import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { toggleObligationStatus, deleteObligation } from "@/actions/obligations";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/db/supabase/server";

function isOverdue(dueDate: string, status: string) {
  if (status === "done") return false;
  return new Date(dueDate + "T00:00:00") < new Date(new Date().toDateString());
}

interface ObligationRow {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  status: string;
}

/** Miolo compartilhado pelos dois formatos de linha (com e sem link). */
function ObligationSummary({ obligation }: { obligation: ObligationRow }) {
  const overdue = isOverdue(obligation.due_date, obligation.status);
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-foreground font-medium">{obligation.title}</p>
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
      </p>
    </div>
  );
}

/**
 * `detailHref` (2026-09-24): no Portal a linha inteira leva ao detalhe, que
 * mostra as etapas vindas do G-Click. No Admin a lista continua sem link -
 * a equipe acompanha o andamento no próprio G-Click, e as ações de staff
 * (Concluir/Apagar) não podem viver dentro de um `<a>`.
 *
 * São dois ramos explícitos em vez de um componente polimórfico: `Link`
 * exige `href` obrigatório, e um `href` opcional não satisfaz o tipo dele.
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
    .select("id, title, description, due_date, status")
    .eq("tenant_id", tenantId)
    .order("due_date", { ascending: true });

  if (!obligations || obligations.length === 0) {
    return (
      <p className="text-muted-foreground p-6 text-center text-sm">
        Nenhuma obrigação cadastrada ainda.
      </p>
    );
  }

  const linkable = Boolean(detailHref) && !canManage;

  return (
    <div className="border-border divide-border divide-y rounded-md border">
      {obligations.map((obligation) =>
        linkable && detailHref ? (
          <Link
            key={obligation.id}
            href={detailHref(obligation.id)}
            className="hover:bg-muted/40 focus-visible:ring-primary flex items-center justify-between gap-4 p-4 transition-colors focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
          >
            <ObligationSummary obligation={obligation} />
            <ChevronRight
              aria-hidden="true"
              className="text-muted-foreground h-4 w-4 shrink-0"
            />
          </Link>
        ) : (
          <div
            key={obligation.id}
            className="flex items-center justify-between gap-4 p-4"
          >
            <ObligationSummary obligation={obligation} />

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
        ),
      )}
    </div>
  );
}
