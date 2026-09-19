import { Button } from "@/components/ui/button";

export interface SimulatorStepperProps {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
}

export function SimulatorStepper({
  currentStep,
  totalSteps,
  onBack,
  onNext,
  nextDisabled,
  nextLabel = "Continuar",
}: SimulatorStepperProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-muted-foreground text-sm">
          Etapa {currentStep + 1} de {totalSteps}
        </p>
        <div className="bg-muted mt-2 h-1.5 w-full overflow-hidden rounded-full">
          <div
            className="bg-primary h-full rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        {currentStep > 0 ? (
          <Button type="button" variant="outline" onClick={onBack}>
            Voltar
          </Button>
        ) : null}
        <Button type="button" onClick={onNext} disabled={nextDisabled}>
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}
