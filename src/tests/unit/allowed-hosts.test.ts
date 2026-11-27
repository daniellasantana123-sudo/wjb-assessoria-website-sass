import { describe, expect, it } from "vitest";

import { isHostAllowed, isStaticAssetPath, normalizeHost } from "@/lib/security/allowed-hosts";

describe("Fase 10F: só o domínio oficial e o ambiente local são atendidos", () => {
  it("atende a produção, com ou sem www e porta, e o ambiente local", () => {
    for (const h of [
      "wjbassessoriacontabil.com.br",
      "WWW.wjbassessoriacontabil.com.br",
      "wjbassessoriacontabil.com.br:443",
      "wjbassessoriacontabil.com.br.",
      "localhost:3000",
      "127.0.0.1:3000",
      "[::1]:3000",
    ]) {
      expect(isHostAllowed(h, {}), h).toBe(true);
    }
  });

  it("recusa a prévia da Hostinger, outros endereços, IP direto e Host ausente ou malformado", () => {
    for (const h of [
      "calm-hotpink-okapi-85.hostingersite.com",
      "wjbassessoriacontabil-com-br-794036.hostingersite.com",
      "wjbassessoriacontabil.com.br.evil.com",
      "evil.com",
      "185.1.2.3",
      "",
      null,
      undefined,
      "wjbassessoriacontabil.com.br/../x",
      "user@wjbassessoriacontabil.com.br",
      "a b",
    ]) {
      expect(isHostAllowed(h, {}), String(h)).toBe(false);
    }
  });

  it("WJB_ALLOWED_HOSTS libera um endereço extra, mas nunca uma prévia *.hostingersite.com", () => {
    const env = { WJB_ALLOWED_HOSTS: " homolog.exemplo.com.br , calm-hotpink-okapi-85.hostingersite.com" };
    expect(isHostAllowed("homolog.exemplo.com.br", env)).toBe(true);
    expect(isHostAllowed("calm-hotpink-okapi-85.hostingersite.com", env)).toBe(false);
  });

  it("normaliza o Host", () => {
    expect(normalizeHost("Example.COM:8080")).toBe("example.com");
    expect(normalizeHost("[::1]")).toBe("::1");
    expect(normalizeHost("exa mple.com")).toBeNull();
  });
});

describe("proxy: recusa antes de sessão, banco ou integração", () => {
  it("prévia recebe 421; domínio oficial segue normalmente", async () => {
    const { NextRequest } = await import("next/server");
    const { proxy } = await import("@/proxy");
    const preview = new NextRequest("https://calm-hotpink-okapi-85.hostingersite.com/login", {
      headers: { host: "calm-hotpink-okapi-85.hostingersite.com" },
    });
    const blocked = await proxy(preview);
    expect(blocked.status).toBe(421);
    expect(blocked.headers.get("cache-control")).toBe("no-store");

    const prod = new NextRequest("https://wjbassessoriacontabil.com.br/", {
      headers: { host: "wjbassessoriacontabil.com.br" },
    });
    expect((await proxy(prod)).status).not.toBe(421);
  });
});

describe("arquivos estáticos (otimizador de imagens busca sem Host)", () => {
  it("imagem e fonte passam; página, API e caminho com .. não", () => {
    expect(isStaticAssetPath("/brand/logos/logo-wjb-color.png")).toBe(true);
    expect(isStaticAssetPath("/images/hero/1.WEBP")).toBe(true);
    expect(isStaticAssetPath("/manual/fonts/x.woff2")).toBe(true);
    expect(isStaticAssetPath("/login")).toBe(false);
    expect(isStaticAssetPath("/api/leads")).toBe(false);
    expect(isStaticAssetPath("/api/x.png")).toBe(false);
    expect(isStaticAssetPath("/portal/../x.png")).toBe(false);
  });
  it("proxy: pedido interno sem Host para uma imagem passa; sem Host para página continua 421", async () => {
    const { NextRequest } = await import("next/server");
    const { proxy } = await import("@/proxy");
    const img = new NextRequest("http://0.0.0.0:3000/brand/logos/logo-wjb-color.png");
    expect((await proxy(img)).status).not.toBe(421);
    const page = new NextRequest("http://0.0.0.0:3000/login");
    expect((await proxy(page)).status).toBe(421);
  });
});
