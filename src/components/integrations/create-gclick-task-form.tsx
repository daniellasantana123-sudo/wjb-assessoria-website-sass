"use client";

import { useActionState, useEffect, useId, useRef } from "react";

import { createGClickTask, type GClickTaskState } from "@/actions/omie-gclick";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/**
 * "Criar tarefa no G-Click" na ficha da empresa (2026-10-01). A tarefa vai
 * para a fila do escritório no G-Click, já com o cliente; prazo e andamento
 * a equipe define lá (a API não aceita prazo na criação).
 */
export function CreateGClickTaskForm({
  tenantId,
  departments,
  responsibles,
}: {
  tenantId: string;
  departments: { id: number; name: string }[];
  responsibles: { id: string; name: string; role: string | null }[];
}) {
  const action = createGClickTask.bind(null, tenantId);
  const [state, formAction, pending] = useActionState<GClickTaskState, FormData>(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const ids = { title: useId(), description: useId(), department: useId(), responsible: useId() };

  useEffect(() => {
    if (state && "success" in state) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={ids.title}>Assunto</Label>
        <Input id={ids.title} name="title" required minLength={3} maxLength={200} placeholder="Ex.: Conferir notas de entrada de setembro" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={ids.description}>Descrição</Label>
        <Textarea
          id={ids.description}
          name="description"
          rows={4}
          maxLength={4000}
          placeholder="O que precisa ser feito e qualquer detalhe útil para quem vai cuidar."
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={ids.department}>Departamento</Label>
          <Select id={ids.department} name="departmentId" required defaultValue="">
            <option value="" disabled>
              Escolha o departamento
            </option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={ids.responsible}>Responsável (opcional)</Label>
          <Select id={ids.responsible} name="responsibleId" defaultValue="">
            <option value="">Sem responsável - o G-Click distribui</option>
            {responsibles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.role ? `${p.name} (${p.role})` : p.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {state && "error" in state && (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      )}
      {state && "success" in state && (
        <p role="status" className="text-success-text text-sm">
          {state.success}
        </p>
      )}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Criando..." : "Criar tarefa no G-Click"}
      </Button>
    </form>
  );
}
