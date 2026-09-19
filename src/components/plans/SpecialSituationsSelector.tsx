import { Label } from "@/components/ui/label";
import { specialSituationOptions } from "@/config/pricing";
import type { SpecialSituation } from "@/types/pricing";

export interface SpecialSituationsSelectorProps {
  value: SpecialSituation[];
  onChange: (value: SpecialSituation[]) => void;
}

/**
 * Checklist da aba "Excecoes" da planilha oficial — qualquer item marcado
 * tira a simulação do cálculo automático e encaminha para proposta
 * personalizada (seção "PROPOSTA PERSONALIZADA"). Nenhum item é
 * obrigatório: o cliente pode simplesmente não marcar nada e seguir com o
 * cálculo automático.
 */
export function SpecialSituationsSelector({ value, onChange }: SpecialSituationsSelectorProps) {
  function toggle(situation: SpecialSituation, checked: boolean) {
    onChange(checked ? [...value, situation] : value.filter((item) => item !== situation));
  }

  return (
    <div className="flex flex-col gap-3">
      {specialSituationOptions.map((option) => {
        const id = `special-situation-${option.value}`;
        const checked = value.includes(option.value);
        return (
          <div key={option.value} className="border-border flex items-start gap-3 rounded-md border p-4">
            <input
              id={id}
              type="checkbox"
              checked={checked}
              onChange={(event) => toggle(option.value, event.target.checked)}
              className="border-border text-primary focus-visible:ring-primary mt-0.5 h-4 w-4 shrink-0 rounded focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            />
            <Label htmlFor={id}>{option.label}</Label>
          </div>
        );
      })}
    </div>
  );
}
