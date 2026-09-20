import { beforeEach, describe, expect, it, vi } from "vitest";

const requireTenantAccessMock = vi.fn();
const getTenantRoleMock = vi.fn();
vi.mock("@/lib/auth/dal", () => ({
  requireTenantAccess: requireTenantAccessMock,
  getTenantRole: getTenantRoleMock,
  requireStaffSession: vi.fn(),
}));

const scanMock = vi.fn().mockResolvedValue({ clean: true });
vi.mock("@/integrations/antivirus", () => ({
  getAntivirusAdapter: () => ({ scan: scanMock }),
}));

const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

const storageUploadMock = vi.fn().mockResolvedValue({ error: null });
const storageRemoveMock = vi.fn().mockResolvedValue({ error: null });
const documentsInsertMock = vi.fn().mockResolvedValue({ error: null });
const auditInsertMock = vi.fn().mockResolvedValue({ error: null });
const fromMock = vi.fn((table: string) => {
  if (table === "documents") return { insert: documentsInsertMock };
  if (table === "audit_log") return { insert: auditInsertMock };
  throw new Error(`tabela inesperada: ${table}`);
});
vi.mock("@/lib/db/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: fromMock,
    storage: {
      from: vi.fn(() => ({ upload: storageUploadMock, remove: storageRemoveMock })),
    },
  }),
}));

const { uploadDocument } = await import("@/actions/documents");

function makeFormData(file: File, category = "documento") {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("category", category);
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireTenantAccessMock.mockResolvedValue({ userId: "user-1", isWjbStaff: false });
  getTenantRoleMock.mockResolvedValue("member");
  scanMock.mockResolvedValue({ clean: true });
  storageUploadMock.mockResolvedValue({ error: null });
  documentsInsertMock.mockResolvedValue({ error: null });
});

describe("uploadDocument", () => {
  it("rejeita sem permissão (ex.: tenantRole nulo)", async () => {
    getTenantRoleMock.mockResolvedValue(null);
    const file = new File(["conteudo"], "arquivo.pdf", { type: "application/pdf" });

    const result = await uploadDocument("tenant-1", undefined, makeFormData(file));

    expect(result).toEqual({ error: expect.stringContaining("permissão") });
    expect(storageUploadMock).not.toHaveBeenCalled();
  });

  it("rejeita arquivo maior que 20MB", async () => {
    const bigContent = new Uint8Array(21 * 1024 * 1024);
    const file = new File([bigContent], "grande.pdf", { type: "application/pdf" });

    const result = await uploadDocument("tenant-1", undefined, makeFormData(file));

    expect(result).toEqual({ error: expect.stringContaining("20MB") });
    expect(storageUploadMock).not.toHaveBeenCalled();
  });

  it("rejeita MIME fora da allowlist", async () => {
    const file = new File(["conteudo"], "virus.exe", {
      type: "application/x-msdownload",
    });

    const result = await uploadDocument("tenant-1", undefined, makeFormData(file));

    expect(result).toEqual({ error: expect.stringContaining("não permitido") });
    expect(storageUploadMock).not.toHaveBeenCalled();
  });

  it("rejeita quando a verificação de antimalware reprova o arquivo", async () => {
    scanMock.mockResolvedValue({ clean: false, reason: "assinatura suspeita" });
    const file = new File(["conteudo"], "arquivo.pdf", { type: "application/pdf" });

    const result = await uploadDocument("tenant-1", undefined, makeFormData(file));

    expect(result?.error).toBeDefined();
    expect(storageUploadMock).not.toHaveBeenCalled();
  });

  it("sanitiza o nome do arquivo antes de montar a storage key", async () => {
    const file = new File(["conteudo"], "relatório final!.pdf", { type: "application/pdf" });

    await uploadDocument("tenant-1", undefined, makeFormData(file));

    expect(storageUploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/^tenant-1\/\d+-relat_rio_final_\.pdf$/),
      file,
    );
    expect(documentsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ file_name: "relat_rio_final_.pdf" }),
    );
  });

  it("envia com sucesso e grava auditoria", async () => {
    const file = new File(["conteudo"], "contrato.pdf", { type: "application/pdf" });

    const result = await uploadDocument("tenant-1", undefined, makeFormData(file));

    expect(result).toBeUndefined();
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "document.uploaded", tenant_id: "tenant-1" }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/portal/documentos");
  });

  it("remove o arquivo do Storage se o insert no banco falhar (não deixa órfão)", async () => {
    documentsInsertMock.mockResolvedValue({ error: { message: "boom" } });
    const file = new File(["conteudo"], "contrato.pdf", { type: "application/pdf" });

    const result = await uploadDocument("tenant-1", undefined, makeFormData(file));

    expect(result?.error).toBeDefined();
    expect(storageRemoveMock).toHaveBeenCalled();
  });
});
