import { describe, expect, it } from "vitest";

import {
  documentsMatch,
  isSearchable,
  looksLikeDocument,
  normalizeClientSearch,
} from "@/lib/integrations/client-search";

describe("normalizeClientSearch", () => {
  it("tira a pontuação do CNPJ, que é como a pessoa digita", () => {
    // A API guarda "12345678000123"; buscar com pontuação não acharia nada
    // e pareceria "o cliente não existe no G-Click".
    expect(normalizeClientSearch("12.345.678/0001-23")).toBe("12345678000123");
  });

  it("tira a pontuação do CPF também", () => {
    expect(normalizeClientSearch("123.456.789-01")).toBe("12345678901");
  });

  it("aceita o documento já sem pontuação", () => {
    expect(normalizeClientSearch("12345678000123")).toBe("12345678000123");
  });

  it("preserva o nome da empresa intacto", () => {
    expect(normalizeClientSearch("  Padaria do Zé  ")).toBe("Padaria do Zé");
  });

  it("não estraga nome que contém números", () => {
    // O erro seria tratar "Loja 24h" como documento e buscar por "24".
    expect(normalizeClientSearch("Loja 24h Comércio")).toBe("Loja 24h Comércio");
  });

  it("não trata número curto como documento", () => {
    expect(normalizeClientSearch("123")).toBe("123");
  });
});

describe("isSearchable", () => {
  it("recusa busca curta demais", () => {
    expect(isSearchable("")).toBe(false);
    expect(isSearchable("ab")).toBe(false);
    expect(isSearchable("   ")).toBe(false);
  });

  it("aceita a partir de três caracteres", () => {
    expect(isSearchable("abc")).toBe(true);
    expect(isSearchable("12.345.678/0001-23")).toBe(true);
  });
});

describe("documentsMatch", () => {
  it("reconhece o mesmo CNPJ escrito de formas diferentes", () => {
    // Caso real: o G-Click devolve sem pontuação, a plataforma guarda com.
    expect(documentsMatch("35.673.259/0001-88", "35673259000188")).toBe(true);
  });

  it("recusa documentos diferentes", () => {
    expect(documentsMatch("35673259000188", "35673259000189")).toBe(false);
  });

  it("recusa quando falta um dos lados", () => {
    // Cliente sem CNPJ no G-Click não pode casar com ninguém por omissão.
    expect(documentsMatch(null, "35673259000188")).toBe(false);
    expect(documentsMatch("35673259000188", null)).toBe(false);
    expect(documentsMatch("", "")).toBe(false);
  });

  it("não casa duas strings sem nenhum dígito", () => {
    expect(documentsMatch("sem cnpj", "sem cnpj")).toBe(false);
  });
});

describe("looksLikeDocument", () => {
  it("reconhece CNPJ com e sem pontuação", () => {
    expect(looksLikeDocument("35.673.259/0001-88")).toBe(true);
    expect(looksLikeDocument("35673259000188")).toBe(true);
  });

  it("não confunde nome com documento", () => {
    expect(looksLikeDocument("ARMEL X TECNOLOGIA")).toBe(false);
    expect(looksLikeDocument("Loja 24h")).toBe(false);
  });
});
