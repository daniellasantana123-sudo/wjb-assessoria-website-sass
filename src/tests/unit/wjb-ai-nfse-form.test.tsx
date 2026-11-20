import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/actions/wjb-ai-fiscal", () => ({
  previewNfseAction: vi.fn(),
  submitNfseAction: vi.fn(),
}));

const { NfseRequestForm } = await import("@/components/wjb-ai/nfse-request-form");

describe("formulário Solicitar NFS-e", () => {
  it("tem rótulo em todos os campos e começa sem botão de envio", () => {
    render(<NfseRequestForm tenantId="tenant-a" defaultCompetence="2026-11" />);
    for (const label of [
      "Descrição do serviço prestado",
      "Valor do serviço (R$)",
      "Competência (mês do serviço)",
      "CPF ou CNPJ",
      "Nome ou razão social",
      "E-mail do tomador (opcional)",
      "Referência interna (opcional)",
    ]) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
    expect(screen.getByRole("button", { name: "Ver prévia" })).toBeTruthy();
    // Só depois da prévia aparece o botão de confirmar.
    expect(screen.queryByRole("button", { name: /Confirmar/ })).toBeNull();
  });

  it("a empresa vai só como conferência, sem campo editável de empresa", () => {
    const { container } = render(<NfseRequestForm tenantId="tenant-a" defaultCompetence="2026-11" />);
    const hidden = container.querySelector('input[name="expectedTenantId"]') as HTMLInputElement;
    expect(hidden.type).toBe("hidden");
    expect(container.querySelector('[name="tenant_id"]')).toBeNull();
  });
});
