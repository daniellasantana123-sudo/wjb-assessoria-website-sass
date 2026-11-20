"use client";

import { useActionState } from "react";

import {
  previewNfseAction,
  submitNfseAction,
  type NfseFormState,
} from "@/actions/wjb-ai-fiscal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCents } from "@/lib/wjb-ai/fiscal/labels";

const FIELD_LABELS: Record<string, string> = {
  serviceDescription: "serviceDescription",
  grossAmount: "grossAmount",
  competence: "competence",
  "taker.document": "takerDocument",
  "taker.name": "takerName",
  "taker.email": "takerEmail",
};

function fieldError(state: NfseFormState | undefined, id: string) {
  return state?.fields?.find((f) => FIELD_LABELS[f.field] === id)?.message;
}

function Field({
  id,
  label,
  hint,
  state,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  state?: NfseFormState;
  children: React.ReactNode;
}) {
  const error = fieldError(state, id);
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
      {error ? (
        <p id={`${id}-erro`} role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function NfseRequestForm({
  tenantId,
  defaultCompetence,
}: {
  tenantId: string;
  defaultCompetence: string;
}) {
  const [previewState, previewAction, previewing] = useActionState(
    previewNfseAction,
    undefined,
  );
  const [submitState, submitAction, submitting] = useActionState(
    submitNfseAction,
    undefined,
  );
  const state = submitState ?? previewState;
  const preview = previewState?.preview;

  return (
    <form action={previewAction} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="expectedTenantId" value={tenantId} />

      <Field
        id="serviceDescription"
        label="Descrição do serviço prestado"
        state={state}
      >
        <Textarea
          id="serviceDescription"
          name="serviceDescription"
          rows={3}
          required
          aria-describedby="serviceDescription-erro"
          placeholder="Ex.: Corte e escova"
        />
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          id="grossAmount"
          label="Valor do serviço (R$)"
          hint="Ex.: 250,00"
          state={state}
        >
          <Input
            id="grossAmount"
            name="grossAmount"
            inputMode="decimal"
            required
            aria-describedby="grossAmount-erro"
          />
        </Field>
        <Field
          id="competence"
          label="Competência (mês do serviço)"
          state={state}
        >
          <Input
            id="competence"
            name="competence"
            type="month"
            defaultValue={defaultCompetence}
            required
          />
        </Field>
      </div>

      <fieldset className="border-border flex flex-col gap-5 rounded-md border p-4">
        <legend className="text-foreground px-1 text-sm font-semibold">
          Tomador (quem contratou o serviço)
        </legend>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field id="takerDocument" label="CPF ou CNPJ" state={state}>
            <Input
              id="takerDocument"
              name="takerDocument"
              required
              autoComplete="off"
              aria-describedby="takerDocument-erro"
            />
          </Field>
          <Field id="takerName" label="Nome ou razão social" state={state}>
            <Input
              id="takerName"
              name="takerName"
              required
              aria-describedby="takerName-erro"
            />
          </Field>
        </div>
        <Field
          id="takerEmail"
          label="E-mail do tomador (opcional)"
          state={state}
        >
          <Input id="takerEmail" name="takerEmail" type="email" />
        </Field>
      </fieldset>

      <Field
        id="sourceReference"
        label="Referência interna (opcional)"
        hint="Use para diferenciar dois serviços iguais, por exemplo o número do pedido."
        state={state}
      >
        <Input id="sourceReference" name="sourceReference" maxLength={100} />
      </Field>

      {state?.error ? (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      ) : null}

      <Button
        type="submit"
        variant="outline"
        disabled={previewing || submitting}
        className="self-start"
      >
        {previewing ? "Gerando prévia..." : "Ver prévia"}
      </Button>

      {preview ? (
        <section
          aria-live="polite"
          className="border-primary/30 bg-primary/5 flex flex-col gap-3 rounded-md border p-4"
        >
          <h2 className="text-foreground text-sm font-semibold">
            Prévia da solicitação (simulação)
          </h2>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Serviço</dt>
              <dd className="text-foreground">{preview.serviceDescription}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Valor</dt>
              <dd className="text-foreground">
                {formatCents(preview.amountCents)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Competência</dt>
              <dd className="text-foreground">{preview.competence}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Tomador</dt>
              <dd className="text-foreground">
                {preview.taker.name} ({preview.taker.documentKind}{" "}
                {preview.taker.documentMasked})
              </dd>
            </div>
          </dl>
          {preview.reasons.length ? (
            <div className="text-sm">
              <p className="text-foreground font-medium">
                Um contador da WJB vai revisar antes de seguir:
              </p>
              <ul className="text-muted-foreground mt-1 list-disc pl-5">
                {preview.reasons.map((r) => (
                  <li key={r.code}>{r.message}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="text-muted-foreground text-xs">
            Nenhuma nota é emitida nesta etapa. Ao confirmar, a solicitação fica
            registrada e você acompanha o andamento.
          </p>
          <Button
            type="submit"
            variant="cta"
            formAction={submitAction}
            disabled={previewing || submitting}
            className="self-start"
          >
            {submitting ? "Registrando..." : "Confirmar e enviar solicitação"}
          </Button>
        </section>
      ) : null}
    </form>
  );
}
