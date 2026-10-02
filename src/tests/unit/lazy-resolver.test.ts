import { describe, expect, it, vi } from "vitest";

import { lazyResolver } from "@/lib/validation/lazy-resolver";

describe("lazyResolver", () => {
  it("só carrega na primeira chamada e reaproveita depois", async () => {
    const real = vi.fn(async (value: string) => `ok:${value}`);
    const load = vi.fn(async () => real);
    const resolver = lazyResolver(load);

    expect(load).not.toHaveBeenCalled();
    await expect(resolver("a")).resolves.toBe("ok:a");
    await expect(resolver("b")).resolves.toBe("ok:b");
    expect(load).toHaveBeenCalledTimes(1);
    expect(real).toHaveBeenCalledTimes(2);
  });

  it("repassa todos os argumentos ao resolver real", async () => {
    const real = vi.fn((a: number, b: number) => a + b);
    const resolver = lazyResolver(async () => real);
    await expect(resolver(2, 3)).resolves.toBe(5);
  });
});
