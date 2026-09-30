"use client";

import { useActionState, useEffect, useId, useRef } from "react";

import { uploadDocument } from "@/actions/documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { DocumentCategory } from "@/types/database";

export function UploadDocumentForm({
  tenantId,
  defaultCategory = "documento",
  showCategoryField = false,
}: {
  tenantId: string;
  defaultCategory?: DocumentCategory;
  showCategoryField?: boolean;
}) {
  const uploadForTenant = uploadDocument.bind(null, tenantId);
  const [state, formAction, pending] = useActionState(uploadForTenant, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  // A página do Admin renderiza este formulário duas vezes (Documentos e
  // Guias): com um id fixo, o rótulo "Enviar guia" abria o seletor do
  // campo de Documento.
  const fileId = useId();
  const categoryId = useId();

  // Limpa o arquivo escolhido só depois de um envio bem-sucedido - antes
  // limpava na hora, e em caso de erro a pessoa tinha que escolher de novo.
  useEffect(() => {
    if (state && "success" in state) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={fileId}>Enviar {defaultCategory === "guia" ? "guia" : "documento"}</Label>
        <Input id={fileId} name="file" type="file" required className="max-w-full" />
      </div>

      {showCategoryField ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={categoryId}>Tipo</Label>
          <Select id={categoryId} name="category" defaultValue={defaultCategory}>
            <option value="documento">Documento</option>
            <option value="guia">Guia de pagamento</option>
          </Select>
        </div>
      ) : (
        <input type="hidden" name="category" value={defaultCategory} />
      )}

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

      <Button type="submit" disabled={pending}>
        {pending ? "Enviando..." : "Enviar"}
      </Button>
    </form>
  );
}
