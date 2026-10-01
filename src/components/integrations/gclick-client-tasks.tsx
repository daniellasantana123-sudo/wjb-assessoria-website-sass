import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { getOmieGClickAdapter } from "@/integrations/omie-gclick";
import { loadClientGClickTasks } from "@/lib/integrations/gclick-client-tasks";
import {
  formatCompetence,
  formatGClickDate,
  gclickTaskStatus,
} from "@/lib/integrations/gclick-task-status";
import { cn } from "@/lib/utils";

const MAX_ROWS = 60;

/**
 * Tarefas deste cliente no G-Click, na ficha da empresa (2026-10-01).
 * Obrigações e solicitações, consultadas na hora; só leitura - o trabalho
 * continua sendo feito no G-Click. Falha do G-Click vira uma linha de aviso,
 * sem derrubar a ficha.
 */
export async function GClickClientTasks({
  tenantId,
  externalClientId,
  document,
  showAll,
}: {
  tenantId: string;
  externalClientId: string;
  document: string | null;
  showAll: boolean;
}) {
  const result = await loadClientGClickTasks(getOmieGClickAdapter(), {
    externalId: externalClientId,
    document,
  });

  if (!result.ok) {
    return (
      <p className="text-muted-foreground text-sm">
        Não foi possível consultar as tarefas no G-Click agora ({result.message}).
      </p>
    );
  }

  const openCount = result.tasks.filter((t) => gclickTaskStatus(t.status).open).length;
  const visible = (showAll ? result.tasks : result.tasks.filter((t) => gclickTaskStatus(t.status).open)).slice(0, MAX_ROWS);
  const base = `/admin/empresas/${tenantId}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {result.tasks.length} tarefa(s) nos últimos 12 meses · {openCount} em aberto
        </p>
        <nav aria-label="Filtrar tarefas" className="flex gap-2">
          {[
            { href: `${base}#tarefas-gclick`, label: "Em aberto", active: !showAll },
            { href: `${base}?tarefas=todas#tarefas-gclick`, label: "Todas", active: showAll },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              scroll={false}
              aria-current={item.active ? "true" : undefined}
              className={cn(
                "focus-visible:ring-primary inline-flex min-h-9 items-center rounded-full border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none",
                item.active
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      {visible.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-md border p-4 text-sm">
          {showAll ? "Nenhuma tarefa deste cliente no G-Click nos últimos 12 meses." : "Nenhuma tarefa em aberto para este cliente no G-Click."}
        </p>
      ) : (
        <ul className="border-border divide-border divide-y rounded-md border">
          {visible.map((task) => {
            const status = gclickTaskStatus(task.status);
            const due = formatGClickDate(task.dueDate);
            const competence = formatCompetence(task.competence);
            return (
              <li key={`${task.category}-${task.externalId}`}>
                <Link
                  href={`${base}/tarefas/${encodeURIComponent(task.externalId)}`}
                  className="hover:bg-muted/30 focus-visible:ring-primary flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-4 transition-colors focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
                >
                  <div className="min-w-0 flex-1 basis-60">
                    <p className="text-foreground font-medium break-words">{task.title || "Tarefa sem nome"}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {[
                        task.category === "Solicitacao" ? "Solicitação" : "Obrigação",
                        due && `vence ${due}`,
                        competence && `competência ${competence}`,
                        task.department?.name,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-3">
                    <Badge tone={status.tone}>{status.label}</Badge>
                    <span className="text-muted-foreground text-sm">Ver etapas →</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {(result.truncated || visible.length === MAX_ROWS) && (
        <p className="text-muted-foreground text-xs">
          Mostrando até {MAX_ROWS} tarefas. A lista completa fica no G-Click.
        </p>
      )}
    </div>
  );
}
