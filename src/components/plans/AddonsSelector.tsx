import { Label } from "@/components/ui/label";
import { invoiceVolumeOptions } from "@/config/pricing";
import { planAddons } from "@/config/plans";
import type { InvoiceVolume } from "@/types/pricing";

export interface AddonsValue {
  invoiceIssuance: boolean;
  invoiceVolume: InvoiceVolume | null;
  fiscalMonitor: boolean;
}

export interface AddonsSelectorProps {
  value: AddonsValue;
  onChange: (value: AddonsValue) => void;
  invoiceVolumeError?: string;
}

/** Serviços adicionais do simulador (seção 6/11/12) — NFS-e com volume, Monitor Fiscal. */
export function AddonsSelector({ value, onChange, invoiceVolumeError }: AddonsSelectorProps) {
  const invoiceIssuance = planAddons.find((addon) => addon.id === "invoiceIssuance")!;
  const fiscalMonitor = planAddons.find((addon) => addon.id === "fiscalMonitor")!;

  return (
    <div className="flex flex-col gap-6">
      <div className="border-border rounded-md border p-4">
        <div className="flex items-start gap-3">
          <input
            id="addon-invoice"
            type="checkbox"
            checked={value.invoiceIssuance}
            onChange={(event) =>
              onChange({
                ...value,
                invoiceIssuance: event.target.checked,
                invoiceVolume: event.target.checked ? value.invoiceVolume : null,
              })
            }
            className="border-border text-primary focus-visible:ring-primary mt-0.5 h-4 w-4 shrink-0 rounded focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          />
          <div>
            <Label htmlFor="addon-invoice" className="font-medium">
              {invoiceIssuance.name}
            </Label>
            <p className="text-muted-foreground mt-1 text-sm">{invoiceIssuance.description}</p>
          </div>
        </div>

        {value.invoiceIssuance ? (
          <div className="mt-4 flex flex-col gap-2 pl-7">
            <Label htmlFor="invoice-volume">Quantas notas fiscais por mês?</Label>
            <select
              id="invoice-volume"
              value={value.invoiceVolume ?? ""}
              aria-invalid={!!invoiceVolumeError}
              aria-describedby={invoiceVolumeError ? "invoice-volume-error" : undefined}
              onChange={(event) =>
                onChange({ ...value, invoiceVolume: event.target.value as InvoiceVolume })
              }
              className="border-border bg-background text-foreground focus-visible:ring-primary flex h-11 w-full rounded-md border px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <option value="">Selecione o volume</option>
              {invoiceVolumeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {invoiceVolumeError ? (
              <p id="invoice-volume-error" role="alert" className="text-danger text-sm">
                {invoiceVolumeError}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="border-border rounded-md border p-4">
        <div className="flex items-start gap-3">
          <input
            id="addon-fiscal-monitor"
            type="checkbox"
            checked={value.fiscalMonitor}
            onChange={(event) => onChange({ ...value, fiscalMonitor: event.target.checked })}
            className="border-border text-primary focus-visible:ring-primary mt-0.5 h-4 w-4 shrink-0 rounded focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          />
          <div>
            <Label htmlFor="addon-fiscal-monitor" className="font-medium">
              {fiscalMonitor.name}
            </Label>
            <p className="text-muted-foreground mt-1 text-sm">{fiscalMonitor.description}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
