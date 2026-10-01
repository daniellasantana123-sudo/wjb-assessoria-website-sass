import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Clock, UserRound } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { getOmieGClickAdapter } from "@/integrations/omie-gclick";
import type { ExternalPerson } from "@/integrations/omie-gclick/types";
import { requireStaffSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/db/supabase/server";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { loadClientGClickTasks } from "@/lib/integrations/gclick-client-tasks";
import {
  formatCompetence,
  formatGClickDate,
  gclickTaskStatus,
} from "@/lib/integrations/gclick-task-status";
import { getObligationProgress, getOmieMapping } from "@/lib/omie-gclick";

export const metadata: Metadata = {
  title: "Tarefa no G-Click",
  robots: { index: false, follow: false },
};

function People({ title, people }: { title: string; people: ExternalPerson[] }) {
  if (people.length === 0) return null;
  return (
    <div>
      <h2 className="text-muted-foreground text-xs font-medium uppercase">{title}</h2>
      <ul className="mt-2 flex flex-wrap gap-3">
        {people.map((person) => (
          <li key={person.externalId} className="text-foreground flex items-center gap-2 text-sm">
            <span className="bg-primary/10 text-primary flex h-7 w-7 items-center justify-center rounded-full">
              <UserRound aria-hidden="true" className="h-3.5 w-3.5" />
            </span>
            <span>
              {person.name}
              {person.role && <span className="text-muted-foreground"> · {person.role}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Detalhe de uma tarefa do G-Click no Admin (2026-10-01): etapas,
 * responsáveis e convidados, consultados na hora. A tarefa só abre se for
 * mesmo do cliente desta empresa - trocar o id na URL por o de outro
 * cliente dá 404.
 */
export default async function AdminGClickTaskPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  await requireStaffSession();
  const { id, taskId: rawTaskId } = await params;
  const taskId = decodeURIComponent(rawTaskId);

  const supabase = await createClient();
  const { data: tenant } = await supabase.from("tenants").select("id, name, cnpj").eq("id", id).maybeSingle();
  if (!tenant) notFound();

  const mapping = await getOmieMapping(tenant.id);
  if (!mapping?.externalClientId || !(await isFeatureEnabled("omie_gclick"))) notFound();

  const loaded = await loadClientGClickTasks(getOmieGClickAdapter(), {
    externalId: mapping.externalClientId,
    document: tenant.cnpj,
  });
  const task = loaded.ok ? loaded.tasks.find((t) => t.externalId === taskId) : undefined;
  if (!task) notFound();

  const status = gclickTaskStatus(task.status);
  const progress = await getObligationProgress(task.externalId);
  const details = [
    ["Categoria", task.category === "Solicitacao" ? "Solicitação" : "Obrigação"],
    ["Departamento", task.department?.name ?? null],
    ["Vencimento", formatGClickDate(task.dueDate)],
    ["Competência", formatCompetence(task.competence)],
    ["Concluída em", formatGClickDate(task.completedAt)],
    ["Id no G-Click", task.externalId],
  ].filter((row): row is [string, string] => Boolean(row[1]));

  return (
    <Container className="flex flex-1 flex-col gap-8 py-16">
      <Breadcrumb
        items={[
          { label: "Admin WJB", href: "/admin" },
          { label: "Empresas", href: "/admin/empresas" },
          { label: tenant.name, href: `/admin/empresas/${tenant.id}` },
          { label: "Tarefa no G-Click" },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-foreground text-2xl font-semibold break-words">{task.title || "Tarefa sem nome"}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{tenant.name}</p>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      <dl className="border-border grid gap-x-8 gap-y-3 rounded-md border p-6 sm:grid-cols-3">
        {details.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-muted-foreground text-xs">{label}</dt>
            <dd className="text-foreground text-sm font-medium break-words">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="border-border flex flex-col gap-6 rounded-md border p-6">
        <h2 className="text-foreground text-sm font-semibold">Andamento</h2>
        {progress === null ? (
          <p className="text-muted-foreground text-sm">O andamento detalhado está indisponível no momento.</p>
        ) : (
          <>
            {progress.activities.length === 0 ? (
              <p className="text-muted-foreground text-sm">Esta tarefa ainda não tem etapas registradas.</p>
            ) : (
              <ol className="flex flex-col gap-3">
                {progress.activities.map((activity) => (
                  <li key={activity.externalId} className="flex items-start gap-3">
                    <span
                      className={
                        activity.answered
                          ? "bg-success-bg text-success-text flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                          : "bg-muted text-muted-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                      }
                    >
                      {activity.answered ? <Check aria-hidden="true" className="h-4 w-4" /> : <Clock aria-hidden="true" className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-foreground text-sm font-medium break-words">{activity.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {activity.answered
                          ? [
                              "Concluída",
                              activity.answeredAt && `em ${activity.answeredAt}`,
                              activity.answeredBy && `por ${activity.answeredBy}`,
                            ]
                              .filter(Boolean)
                              .join(" ")
                          : "Em andamento"}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <People title="Responsáveis" people={progress.responsibles} />
            <People title="Convidados" people={progress.guests} />
          </>
        )}
      </div>

      <Link
        href={`/admin/empresas/${tenant.id}#tarefas-gclick`}
        className="text-primary inline-flex items-center gap-2 self-start text-sm font-medium underline underline-offset-4"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Voltar para a empresa
      </Link>
    </Container>
  );
}
