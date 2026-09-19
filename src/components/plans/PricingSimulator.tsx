"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/shared/modal";
import {
  activityOptions,
  brazilianStates,
  calculatePrice,
  employeeOptions,
  formatBRL,
  getRevenueOptions,
  meiEmployeeOptions,
  partnerOptions,
} from "@/config/pricing";
import { getPlan, plans } from "@/config/plans";
import { trackPlanEvent } from "@/lib/analytics/plan-events";
import {
  clearStoredSimulation,
  getServerSimulationSnapshot,
  hasStoredSimulationSnapshot,
  readStoredSimulation,
  saveStoredSimulation,
  subscribeSimulationStorage,
} from "@/lib/simulator/storage";
import type { Regime, SimulationState } from "@/types/pricing";

import { AddonsSelector } from "./AddonsSelector";
import { PlanIncludedServices } from "./PlanIncludedServices";
import { PlanLeadForm } from "./PlanLeadForm";
import { SimulatorField } from "./SimulatorField";
import { SimulatorResult } from "./SimulatorResult";
import { SimulatorStepper } from "./SimulatorStepper";
import { SimulatorSummary } from "./SimulatorSummary";
import { SpecialSituationsSelector } from "./SpecialSituationsSelector";

const emptyState: SimulationState = {
  regime: null,
  state: "",
  activity: null,
  hasStateRegistration: null,
  partners: null,
  employees: null,
  monthlyRevenue: null,
  specialSituations: [],
  addons: { invoiceIssuance: false, invoiceVolume: null, fiscalMonitor: false },
};

export interface PricingSimulatorProps {
  initialRegime?: Regime | null;
}

interface SimulatorStep {
  id: string;
  isValid: boolean;
  render: () => React.ReactNode;
}

/**
 * Orquestrador do simulador (seção 10 de WJB_Planos_Simulador_
 * Implementacao_Claude.md). Funciona tanto em /planos/simulador quanto
 * embutido em /planos (seção 10, item 2). O regime pode vir por query
 * string (`initialRegime`, lido pela página a partir de `?regime=`) ou ser
 * escolhido no seletor abaixo — sempre possível trocar depois.
 */
export function PricingSimulator({ initialRegime = null }: PricingSimulatorProps) {
  const [state, setState] = useState<SimulationState>({ ...emptyState, regime: initialRegime });
  const [currentStep, setCurrentStep] = useState(0);
  const [attemptedNext, setAttemptedNext] = useState(false);
  const [leadFormOpen, setLeadFormOpen] = useState(false);
  const [includedOpen, setIncludedOpen] = useState(false);
  const hasStoredSimulation = useSyncExternalStore(
    subscribeSimulationStorage,
    hasStoredSimulationSnapshot,
    getServerSimulationSnapshot,
  );
  const showRestorePrompt = hasStoredSimulation && !initialRegime && !state.regime;

  useEffect(() => {
    if (state.regime) saveStoredSimulation(state);
  }, [state]);

  const plan = state.regime ? getPlan(state.regime) : null;
  const estimate = useMemo(() => calculatePrice(state), [state]);

  const steps: SimulatorStep[] = useMemo(() => {
    if (!state.regime) return [];
    const list: SimulatorStep[] = [];

    list.push({
      id: "state",
      isValid: state.state !== "",
      render: () => (
        <SimulatorField
          id="sim-state"
          label="Qual é o seu estado?"
          value={state.state}
          onChange={(value) => setState((prev) => ({ ...prev, state: value }))}
          options={brazilianStates.map((uf) => ({ value: uf, label: uf }))}
          placeholder="Selecione a UF"
          error={attemptedNext && state.state === "" ? "Selecione o estado." : undefined}
        />
      ),
    });

    list.push({
      id: "activity",
      isValid: state.activity !== null,
      render: () => (
        <SimulatorField
          id="sim-activity"
          label="Qual é o tipo de atividade?"
          value={state.activity ?? ""}
          onChange={(value) =>
            setState((prev) => ({ ...prev, activity: value as SimulationState["activity"] }))
          }
          options={activityOptions}
          error={attemptedNext && state.activity === null ? "Selecione a atividade." : undefined}
        />
      ),
    });

    list.push({
      id: "stateRegistration",
      isValid: state.hasStateRegistration !== null,
      render: () => (
        <SimulatorField
          id="sim-state-registration"
          label="Sua empresa possui Inscrição Estadual ativa?"
          hint="A inscrição estadual pode alterar o nível de complexidade fiscal da operação e será considerada na validação da proposta."
          value={state.hasStateRegistration ?? ""}
          onChange={(value) =>
            setState((prev) => ({
              ...prev,
              hasStateRegistration: value as SimulationState["hasStateRegistration"],
            }))
          }
          options={[
            { value: "yes", label: "Sim" },
            { value: "no", label: "Não" },
            { value: "unknown", label: "Não sei" },
          ]}
          error={
            attemptedNext && state.hasStateRegistration === null
              ? "Selecione uma opção."
              : undefined
          }
        />
      ),
    });

    if (state.regime !== "mei") {
      list.push({
        id: "partners",
        isValid: state.partners !== null,
        render: () => (
          <SimulatorField
            id="sim-partners"
            label="Quantidade de sócios"
            value={state.partners ?? ""}
            onChange={(value) =>
              setState((prev) => ({ ...prev, partners: value as SimulationState["partners"] }))
            }
            options={partnerOptions}
            error={attemptedNext && state.partners === null ? "Selecione a quantidade de sócios." : undefined}
          />
        ),
      });
    }

    list.push({
      id: "employees",
      isValid: state.employees !== null,
      render: () => (
        <SimulatorField
          id="sim-employees"
          label={state.regime === "mei" ? "Possui empregado?" : "Quantidade de empregados"}
          value={state.employees ?? ""}
          onChange={(value) =>
            setState((prev) => ({ ...prev, employees: value as SimulationState["employees"] }))
          }
          options={state.regime === "mei" ? meiEmployeeOptions : employeeOptions}
          error={attemptedNext && state.employees === null ? "Selecione uma opção." : undefined}
        />
      ),
    });

    if (state.regime !== "mei") {
      list.push({
        id: "revenue",
        isValid: state.monthlyRevenue !== null,
        render: () => (
          <SimulatorField
            id="sim-revenue"
            label="Faturamento mensal"
            value={state.monthlyRevenue ?? ""}
            onChange={(value) =>
              setState((prev) => ({
                ...prev,
                monthlyRevenue: value as SimulationState["monthlyRevenue"],
              }))
            }
            options={getRevenueOptions(state.regime)}
            error={
              attemptedNext && state.monthlyRevenue === null ? "Selecione a faixa de faturamento." : undefined
            }
          />
        ),
      });
    }

    list.push({
      id: "specialSituations",
      isValid: true,
      render: () => (
        <div>
          <p className="text-foreground mb-1 font-medium">
            Alguma dessas situações se aplica à sua empresa hoje?
          </p>
          <p className="text-muted-foreground mb-4 text-sm">
            Nenhuma é obrigatória - marque apenas o que já faz parte da operação da sua
            empresa.
          </p>
          <SpecialSituationsSelector
            value={state.specialSituations}
            onChange={(specialSituations) =>
              setState((prev) => ({ ...prev, specialSituations }))
            }
          />
        </div>
      ),
    });

    list.push({
      id: "addons",
      isValid: !state.addons.invoiceIssuance || !!state.addons.invoiceVolume,
      render: () => (
        <div>
          <p className="text-foreground mb-4 font-medium">Serviços adicionais</p>
          <AddonsSelector
            value={state.addons}
            onChange={(addons) => setState((prev) => ({ ...prev, addons }))}
            invoiceVolumeError={
              attemptedNext && state.addons.invoiceIssuance && !state.addons.invoiceVolume
                ? "Selecione o volume de notas fiscais."
                : undefined
            }
          />
        </div>
      ),
    });

    return list;
  }, [state, attemptedNext]);

  function handleSelectRegime(regime: Regime) {
    setState({ ...emptyState, regime });
    setCurrentStep(0);
    setAttemptedNext(false);
    trackPlanEvent("plan_simulation_start", { regime });
  }

  function handleChangeRegime() {
    clearStoredSimulation();
    setState(emptyState);
    setCurrentStep(0);
    setAttemptedNext(false);
  }

  function handleNext() {
    const step = steps[currentStep];
    if (!step.isValid) {
      setAttemptedNext(true);
      return;
    }
    setAttemptedNext(false);
    if (currentStep === steps.length - 1) {
      trackPlanEvent("plan_simulation_complete", { regime: state.regime ?? "" });
      if (estimate?.requiresCustomQuote) {
        trackPlanEvent("plan_simulation_custom_quote", { regime: state.regime ?? "" });
      }
    } else {
      trackPlanEvent("plan_simulation_step", { step: currentStep + 1 });
    }
    setCurrentStep((prev) => prev + 1);
  }

  function handleBack() {
    setAttemptedNext(false);
    setCurrentStep((prev) => Math.max(0, prev - 1));
  }

  function handleContinueStored() {
    const stored = readStoredSimulation();
    if (!stored?.regime) return;
    setState(stored);
    setCurrentStep(0);
  }

  function handleDiscardStored() {
    clearStoredSimulation();
  }

  return (
    <div>
      {showRestorePrompt ? (
        <div className="border-border bg-muted/30 mb-6 flex flex-col items-start gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-foreground text-sm">
            Encontramos uma simulação salva. Deseja continuar de onde parou?
          </p>
          <div className="flex shrink-0 gap-2">
            <Button type="button" size="sm" onClick={handleContinueStored}>
              Continuar minha simulação
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleDiscardStored}>
              Recomeçar
            </Button>
          </div>
        </div>
      ) : null}

      {!state.regime ? (
        <div className="border-border rounded-md border p-6">
          <p className="text-foreground text-lg font-medium">Escolha o regime da sua empresa</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Selecione o regime para começar a simulação.
          </p>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {plans.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectRegime(item.id)}
                className="border-border hover:border-primary hover:bg-muted focus-visible:ring-primary rounded-md border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <p className="text-foreground font-semibold">{item.name}</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  A partir de {formatBRL(item.startingPrice)}/mês
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between gap-4">
              <p className="text-muted-foreground text-sm">
                Simulando: <span className="text-foreground font-medium">{plan?.name}</span>
              </p>
              <button
                type="button"
                onClick={handleChangeRegime}
                className="text-primary shrink-0 text-sm font-medium hover:underline"
              >
                Trocar regime
              </button>
            </div>

            {currentStep < steps.length ? (
              <>
                {steps[currentStep].render()}
                <SimulatorStepper
                  currentStep={currentStep}
                  totalSteps={steps.length + 1}
                  onBack={handleBack}
                  onNext={handleNext}
                  nextLabel={currentStep === steps.length - 1 ? "Ver resultado" : "Continuar"}
                />
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setCurrentStep(steps.length - 1)}
                  className="text-primary self-start text-sm font-medium hover:underline"
                >
                  Voltar para as perguntas
                </button>
                {plan ? (
                  <SimulatorSummary
                    state={state}
                    planName={plan.name}
                    onEdit={() => setCurrentStep(0)}
                  />
                ) : null}
                <div className="lg:hidden">
                  {plan && estimate ? (
                    <SimulatorResult
                      plan={plan}
                      estimate={estimate}
                      onContract={() => setLeadFormOpen(true)}
                      onShowIncluded={() => setIncludedOpen(true)}
                    />
                  ) : null}
                </div>
              </>
            )}
          </div>

          <div className="hidden lg:block">
            {plan && estimate ? (
              <SimulatorResult
                plan={plan}
                estimate={estimate}
                onContract={() => setLeadFormOpen(true)}
                onShowIncluded={() => setIncludedOpen(true)}
              />
            ) : null}
          </div>
        </div>
      )}

      {plan && estimate ? (
        <PlanLeadForm
          open={leadFormOpen}
          onClose={() => setLeadFormOpen(false)}
          plan={plan}
          state={state}
          estimate={estimate}
        />
      ) : null}

      {plan ? (
        <Modal
          open={includedOpen}
          onClose={() => setIncludedOpen(false)}
          title={`O que está incluso no ${plan.name}`}
        >
          <PlanIncludedServices services={plan.detail.wjbServices} />
        </Modal>
      ) : null}
    </div>
  );
}
