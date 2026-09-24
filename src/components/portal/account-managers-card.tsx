import { UserRound } from "lucide-react";

import type { ExternalPerson } from "@/integrations/omie-gclick";

/**
 * "Quem cuida da sua empresa" (2026-09-24) - os responsáveis pela conta,
 * lidos do G-Click.
 *
 * Só aparece quando há gente para mostrar. Um portal que diz o nome de
 * quem atende a empresa é bem diferente de um portal anônimo; um bloco
 * vazio dizendo "nenhum responsável" seria pior que não ter o bloco.
 */
export function AccountManagersCard({ people }: { people: ExternalPerson[] }) {
  return (
    <div className="border-border bg-background rounded-md border p-6">
      <h2 className="text-foreground text-sm font-semibold">Quem cuida da sua empresa</h2>
      <p className="text-muted-foreground mt-0.5 text-xs">
        Time da WJB responsável pela sua contabilidade
      </p>

      <ul className="mt-4 flex flex-col gap-3">
        {people.map((person) => (
          <li key={person.externalId} className="flex items-center gap-3">
            <span className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
              <UserRound aria-hidden="true" className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-foreground truncate text-sm font-medium">{person.name}</p>
              {person.role && (
                <p className="text-muted-foreground truncate text-xs">{person.role}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
