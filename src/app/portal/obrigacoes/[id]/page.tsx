import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Clock, UserRound } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { requireSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/db/supabase/server";
import { getObligationProgress } from "@/lib/omie-gclick";
import { getActiveTenant } from "@/lib/tenant";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Obrigação",
  robots: { index: false, follow: false },
};

function isOverdue(dueDate: string, status: string) {
  if (status === "done") return false;
  return new Date(dueDate + "T00:00:00") < new Date(new Date().toDateString());
}

const formatDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");

/**
 * O G-Click devolve a conclusão da etapa como `"2026-09-23 11:29"` - ISO
 * cru, que nenhum cliente brasileiro lê. Converte sem `new Date()`, que
 * interpretaria a string como UTC em alguns motores e mostraria a hora
 * errada. Se o formato vier diferente do esperado, devolve o original em
 * vez de arriscar uma data inventada.
 */
function formatActivityMoment(raw: string): string {
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!match) return raw;
  const [, year, month, day, hour, minute] = match;
  return `${day}/${month}/${year} às ${hour}:${minute}`;
}

/**
 * `respondidaPor` às vezes traz o nome da pessoa ("João Silva") e às vezes
 * o login ("admin.7348", "daniella.wjbassessoriacontabil"). Mostrar um
 * login para o cliente não informa nada e ainda expõe nome de usuário
 * interno, então só exibimos quando parece um nome de gente.
 */
function looksLikePersonName(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed.includes(" ")) return false;
  return !/[._@]|\d/.test(trimmed);
}

/**
 * Detalhe de uma obrigação do Portal (2026-09-24).
 *
 * O prazo e o status vêm do nosso banco; as **etapas** e o **responsável**
 * são consultados ao vivo no G-Click, e só existem para obrigações que
 * vieram de lá. Se a consulta falhar, a página continua mostrando a
 * obrigação e diz que o andamento está indisponível - a informação
 * essencial nunca depende de um sistema externo estar de pé.
 */
export default async function PortalObrigacaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const tenant = await getActiveTenant(session.userId);
  if (!tenant) notFound();

  const supabase = await createClient();
  // A RLS já limita ao tenant do usuário; o filtro explícito evita que uma
  // troca de empresa ativa mostre a obrigação de outra.
  const { data: obligation } = await supabase
    .from("obligations")
    .select(
      "id, title, description, due_date, status, external_id, external_source, external_synced_at",
    )
    .eq("id", id)
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  if (!obligation) notFound();

  const progress = obligation.external_id
    ? await getObligationProgress(obligation.external_id)
    : null;

  const overdue = isOverdue(obligation.due_date, obligation.status);
  const done = obligation.status === "done";

  return (
    <Container className="flex flex-1 flex-col gap-6 py-10">
      <Breadcrumb
        items={[
          { label: "Portal", href: "/portal" },
          { label: "Obrigações", href: "/portal/obrigacoes" },
          { label: obligation.title },
        ]}
      />

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-foreground text-2xl font-semibold">{obligation.title}</h1>
          {done ? (
            <Badge tone="success">Concluída</Badge>
          ) : overdue ? (
            <Badge tone="danger">Atrasada</Badge>
          ) : (
            <Badge tone="neutral">Pendente</Badge>
          )}
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          Vencimento em {formatDate(obligation.due_date)} · {tenant.name}
        </p>
        {obligation.description && (
          <p className="text-foreground mt-3 text-sm">{obligation.description}</p>
        )}
      </div>

      {obligation.external_id && (
        <div className="border-border bg-background rounded-md border p-6">
          <h2 className="text-foreground text-sm font-semibold">Andamento</h2>

          {progress === null ? (
            <p className="text-muted-foreground mt-2 text-sm">
              O andamento detalhado está indisponível no momento. O prazo e o status acima
              continuam válidos.
            </p>
          ) : (
            <>
              {progress.activities.length === 0 ? (
                <p className="text-muted-foreground mt-2 text-sm">
                  Esta obrigação ainda não tem etapas registradas.
                </p>
              ) : (
                <ol className="mt-4 flex flex-col gap-3">
                  {progress.activities.map((activity) => (
                    <li key={activity.externalId} className="flex items-start gap-3">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                          activity.answered
                            ? "bg-success/15 text-success"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {activity.answered ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Clock className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "text-sm",
                            activity.answered
                              ? "text-muted-foreground"
                              : "text-foreground font-medium",
                          )}
                        >
                          {activity.name}
                        </p>
                        {activity.answered && activity.answeredAt && (
                          <p className="text-muted-foreground text-xs">
                            Concluída em {formatActivityMoment(activity.answeredAt)}
                            {activity.answeredBy && looksLikePersonName(activity.answeredBy)
                              ? ` por ${activity.answeredBy}`
                              : ""}
                          </p>
                        )}
                        {!activity.answered && (
                          <p className="text-muted-foreground text-xs">Em andamento</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}

              {progress.responsibles.length > 0 && (
                <div className="border-border mt-5 border-t pt-4">
                  <p className="text-muted-foreground text-xs font-medium uppercase">
                    Quem está cuidando
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-3">
                    {progress.responsibles.map((person) => (
                      <li
                        key={person.externalId}
                        className="text-foreground flex items-center gap-2 text-sm"
                      >
                        <span className="bg-primary/10 text-primary flex h-7 w-7 items-center justify-center rounded-full">
                          <UserRound aria-hidden="true" className="h-3.5 w-3.5" />
                        </span>
                        <span>
                          {person.name}
                          {person.role && (
                            <span className="text-muted-foreground"> · {person.role}</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <Link
        href="/portal/obrigacoes"
        className="text-primary focus-visible:ring-primary inline-flex w-fit items-center gap-1.5 rounded-md text-sm font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Voltar para as obrigações
      </Link>
    </Container>
  );
}
