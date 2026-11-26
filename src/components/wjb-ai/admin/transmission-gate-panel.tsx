import { Badge } from "@/components/ui/badge";
import {
  currentGateState,
  evaluateTransmissionGate,
} from "@/lib/wjb-ai/fiscal/national/transmission-gate";

/**
 * Estado do portão da transmissão oficial (Fase 10B). Só leitura: mostra à
 * equipe o que ainda impede um envio ao governo. Nenhum botão aqui libera
 * nada: cada condição depende de decisão e configuração fora do sistema.
 */
export function TransmissionGatePanel() {
  const decision = evaluateTransmissionGate(
    currentGateState("producao_restrita"),
  );
  return (
    <section
      aria-labelledby="gate-title"
      className="border-border rounded-md border p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="gate-title" className="text-foreground text-base font-semibold">
          Transmissão oficial (produção restrita)
        </h2>
        {decision.open ? (
          <Badge tone="success">Liberada</Badge>
        ) : (
          <Badge tone="warning">Bloqueada</Badge>
        )}
      </div>
      {!decision.open && (
        <>
          <p className="text-muted-foreground mt-2 text-sm">
            Nenhuma nota é enviada ao governo enquanto houver um item abaixo.
            Produção continua bloqueada em qualquer caso.
          </p>
          <ul className="text-foreground mt-2 list-disc space-y-1 pl-5 text-sm">
            {decision.blockers.map((b) => (
              <li key={b.code} className="break-words">
                {b.message}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
