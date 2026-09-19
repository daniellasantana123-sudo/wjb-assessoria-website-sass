"use client";

import { useActionState, useRef } from "react";

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

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await formAction(formData);
        formRef.current?.reset();
      }}
      className="flex flex-wrap items-end gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="file">Enviar {defaultCategory === "guia" ? "guia" : "documento"}</Label>
        <Input id="file" name="file" type="file" required />
      </div>

      {showCategoryField ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category">Tipo</Label>
          <Select id="category" name="category" defaultValue={defaultCategory}>
            <option value="documento">Documento</option>
            <option value="guia">Guia de pagamento</option>
          </Select>
        </div>
      ) : (
        <input type="hidden" name="category" value={defaultCategory} />
      )}

      {state?.error && (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Enviando..." : "Enviar"}
      </Button>
    </form>
  );
}
