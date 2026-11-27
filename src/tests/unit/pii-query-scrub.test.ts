import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

import { buildConsentBootstrapScript, buildPiiQueryScrubSource } from "@/lib/consent/consent-mode";

/** Executa o script embutido com `location`/`history` falsos e devolve a URL final. */
function run(source: string, href: string) {
  let current = href;
  const calls: string[] = [];
  const context = {
    URL,
    location: {
      get href() {
        return current;
      },
      get search() {
        return new URL(current).search;
      },
      pathname: new URL(href).pathname,
    },
    history: {
      state: null,
      replaceState: (_s: unknown, _t: string, url: string) => {
        calls.push(url);
        current = new URL(url, current).href;
      },
    },
    localStorage: { getItem: () => null },
    window: {} as Record<string, unknown>,
    document: { createElement: () => ({}), head: { appendChild: () => {} } },
  };
  (context.window as Record<string, unknown>).dataLayer = [];
  runInNewContext(`var window=this.window;var dataLayer=window.dataLayer;${source}`, context);
  return { url: current, calls };
}

describe("hotfix: dados de formulário fora da URL antes de qualquer tag", () => {
  it("remove nome, e-mail, telefone e mensagem e mantém os parâmetros de campanha", () => {
    const { url, calls } = run(
      buildPiiQueryScrubSource(),
      "https://wjbassessoriacontabil.com.br/contato?name=Maria+Teste&email=maria%40example.com&phone=11999998888&message=oi&utm_source=google&gclid=abc#formulario",
    );
    expect(calls).toHaveLength(1);
    expect(url).toBe("https://wjbassessoriacontabil.com.br/contato?utm_source=google&gclid=abc#formulario");
    expect(url).not.toMatch(/maria|9999|email=|name=/i);
  });

  it("não mexe na URL quando não há campo de formulário", () => {
    const { calls } = run(buildPiiQueryScrubSource(), "https://wjbassessoriacontabil.com.br/servicos?utm_source=google");
    expect(calls).toHaveLength(0);
  });

  it("vem antes do carregamento do GTM no script do consentimento", () => {
    const script = buildConsentBootstrapScript("GTM-TESTE");
    expect(script.indexOf("searchParams.delete")).toBeGreaterThanOrEqual(0);
    expect(script.indexOf("searchParams.delete")).toBeLessThan(script.indexOf("gtag('consent','default'"));
    const { url } = run(script, "https://wjbassessoriacontabil.com.br/?email=a%40b.com");
    expect(url).toBe("https://wjbassessoriacontabil.com.br/");
  });
});
