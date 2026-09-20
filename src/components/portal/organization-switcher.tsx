"use client";

import { useRef } from "react";
import { Building2 } from "lucide-react";

import { switchActiveTenant } from "@/actions/tenant-context";
import { Select } from "@/components/ui/select";
import type { MyOrganization } from "@/lib/tenant";

/**
 * Organization switcher (Fase 2 do wjb-saas-mvp, 2026-09-20). Sem `<select>`
 * quando só há uma empresa (o caso comum hoje) — não faz sentido mostrar um
 * seletor com uma opção só; mostra o nome fixo, igual ao que já existia
 * antes do switcher.
 */
export function OrganizationSwitcher({
  organizations,
  activeId,
  userLabel,
}: {
  organizations: MyOrganization[];
  activeId: string;
  userLabel: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  if (organizations.length <= 1) {
    const only = organizations[0];
    return (
      <div className="flex items-center gap-2.5 px-1">
        <span className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
          <Building2 aria-hidden="true" className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="text-foreground block truncate text-sm font-medium">
            {only?.name}
          </span>
          <span className="text-muted-foreground block truncate text-xs">{userLabel}</span>
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5 px-1">
      <span className="bg-primary/10 text-primary mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
        <Building2 aria-hidden="true" className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <form ref={formRef} action={switchActiveTenant}>
          <label htmlFor="tenantId" className="sr-only">
            Trocar de empresa
          </label>
          <Select
            id="tenantId"
            name="tenantId"
            defaultValue={activeId}
            className="h-8 px-2 text-sm font-medium"
            onChange={() => formRef.current?.requestSubmit()}
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </Select>
        </form>
        <span className="text-muted-foreground block truncate px-1 pt-1 text-xs">
          {userLabel}
        </span>
      </div>
    </div>
  );
}
