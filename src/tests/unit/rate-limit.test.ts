import { describe, expect, it } from "vitest";

import { isRateLimited } from "@/lib/security/rate-limit";

describe("isRateLimited", () => {
  it("libera as primeiras requisições e bloqueia a partir do limite", () => {
    const key = `test-${Math.random()}`;

    for (let i = 0; i < 5; i++) {
      expect(isRateLimited(key)).toBe(false);
    }

    expect(isRateLimited(key)).toBe(true);
  });

  it("não afeta uma chave diferente", () => {
    const keyA = `a-${Math.random()}`;
    const keyB = `b-${Math.random()}`;

    for (let i = 0; i < 5; i++) isRateLimited(keyA);

    expect(isRateLimited(keyA)).toBe(true);
    expect(isRateLimited(keyB)).toBe(false);
  });
});
