import { Button } from "@/components/ui/button";
import { describeSimulation } from "@/lib/simulator/format";
import type { SimulationState } from "@/types/pricing";

export interface SimulatorSummaryProps {
  state: SimulationState;
  planName: string;
  onEdit: () => void;
}

/** Resumo editável das escolhas (seção 18/24) — permite voltar e trocar qualquer resposta. */
export function SimulatorSummary({ state, planName, onEdit }: SimulatorSummaryProps) {
  const lines = describeSimulation(state, planName);

  return (
    <div className="border-border rounded-md border p-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-muted-foreground text-sm font-medium">Resumo da simulação</p>
        <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
          Editar
        </Button>
      </div>
      <dl className="mt-3 flex flex-col gap-2">
        {lines.map((line) => (
          <div key={line.label} className="flex items-center justify-between gap-4 text-sm">
            <dt className="text-muted-foreground">{line.label}</dt>
            <dd className="text-foreground text-right font-medium">{line.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
