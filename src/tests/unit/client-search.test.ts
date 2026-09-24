import { describe, expect, it } from "vitest";

import {
  isSearchable,
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
