import { describe, expect, it } from "vitest";

import { isAllowedMimeType, sanitizeFileName } from "@/lib/documents";

describe("isAllowedMimeType", () => {
  it("aceita tipos da allowlist", () => {
    expect(isAllowedMimeType("application/pdf")).toBe(true);
    expect(isAllowedMimeType("image/png")).toBe(true);
    expect(isAllowedMimeType("text/csv")).toBe(true);
  });

  it("rejeita tipos fora da allowlist (executáveis, scripts)", () => {
    expect(isAllowedMimeType("application/x-msdownload")).toBe(false);
    expect(isAllowedMimeType("text/javascript")).toBe(false);
    expect(isAllowedMimeType("application/x-sh")).toBe(false);
  });
});

describe("sanitizeFileName", () => {
  it("mantém um nome já seguro sem alteração", () => {
    expect(sanitizeFileName("contrato-social.pdf")).toBe("contrato-social.pdf");
  });

  it("remove separador de caminho, mantendo só o nome do arquivo", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("C:\\Users\\a\\arquivo.pdf")).toBe("arquivo.pdf");
  });

  it("substitui caracteres fora do conjunto seguro por underscore", () => {
    expect(sanitizeFileName("relatório (final)!.pdf")).toBe("relat_rio__final__.pdf");
  });

  it("remove pontos no início do nome", () => {
    expect(sanitizeFileName("...oculto.pdf")).toBe("oculto.pdf");
  });

  it("nunca retorna vazio", () => {
    expect(sanitizeFileName("...")).toBe("arquivo");
    expect(sanitizeFileName("")).toBe("arquivo");
  });

  it("limita o tamanho do nome", () => {
    const longName = "a".repeat(300) + ".pdf";
    expect(sanitizeFileName(longName).length).toBeLessThanOrEqual(200);
  });
});
