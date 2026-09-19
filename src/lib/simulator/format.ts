import {
  activityOptions,
  employeeOptions,
  getRevenueOptions,
  invoiceVolumeOptions,
  meiEmployeeOptions,
  partnerOptions,
  specialSituationOptions,
} from "@/config/pricing";
import type { SimulationState } from "@/types/pricing";

function findLabel(options: { value: string; label: string }[], value: string | null) {
  if (!value) return null;
  return options.find((option) => option.value === value)?.label ?? null;
}

/** Resolve os códigos do estado da simulação em rótulos legíveis para o resumo/WhatsApp. */
export function describeSimulation(state: SimulationState, planName: string) {
  const employeeLabel = findLabel(
    state.regime === "mei" ? meiEmployeeOptions : employeeOptions,
    state.employees,
  );

  const stateRegistrationLabel =
    state.hasStateRegistration === "yes"
      ? "Sim"
      : state.hasStateRegistration === "no"
        ? "Não"
        : state.hasStateRegistration === "unknown"
          ? "Não sei"
          : null;

  const lines: { label: string; value: string }[] = [
    { label: "Plano", value: planName },
    { label: "Estado", value: state.state || "-" },
    { label: "Atividade", value: findLabel(activityOptions, state.activity) ?? "-" },
    { label: "Inscrição estadual", value: stateRegistrationLabel ?? "-" },
  ];

  if (state.regime !== "mei") {
    lines.push({ label: "Sócios", value: findLabel(partnerOptions, state.partners) ?? "-" });
  }

  lines.push({ label: "Empregados", value: employeeLabel ?? "-" });

  if (state.regime !== "mei") {
    lines.push({
      label: "Faturamento mensal",
      value: findLabel(getRevenueOptions(state.regime), state.monthlyRevenue) ?? "-",
    });
  }

  lines.push({
    label: "Emissão de NFS-e",
    value: state.addons.invoiceIssuance
      ? `Sim (${findLabel(invoiceVolumeOptions, state.addons.invoiceVolume) ?? "-"} notas/mês)`
      : "Não",
  });
  lines.push({ label: "Monitor Fiscal", value: state.addons.fiscalMonitor ? "Sim" : "Não" });

  if (state.specialSituations.length > 0) {
    const labels = state.specialSituations
      .map((value) => specialSituationOptions.find((option) => option.value === value)?.label)
      .filter((label): label is string => !!label);
    lines.push({ label: "Situações específicas", value: labels.join(", ") });
  }

  return lines;
}
