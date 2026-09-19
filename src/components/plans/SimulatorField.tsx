import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export interface SimulatorFieldOption {
  value: string;
  label: string;
}

export interface SimulatorFieldProps {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  options: SimulatorFieldOption[];
  placeholder?: string;
  required?: boolean;
  error?: string;
}

/** Campo genérico do simulador (select + label + erro) — seção 22/27. */
export function SimulatorField({
  id,
  label,
  hint,
  value,
  onChange,
  options,
  placeholder = "Selecione uma opção",
  required = true,
  error,
}: SimulatorFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {hint ? <p className="text-muted-foreground -mt-1 text-sm">{hint}</p> : null}
      <Select
        id={id}
        value={value}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
