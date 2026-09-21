import { describe, expect, it } from "vitest";

import { formatBRL } from "@/config/pricing";

describe("formatBRL", () => {
  it("formata valores em Real brasileiro", () => {
    // `Intl.NumberFormat("pt-BR")` usa um espaço non-breaking (U+00A0) entre
    // "R$" e o valor, não um espaço comum - normalizado antes de comparar.
    expect(formatBRL(350).replace(" ", " ")).toBe("R$ 350,00");
  });
});
