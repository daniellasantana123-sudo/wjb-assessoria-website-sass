import { describe, expect, it } from "vitest";

import { renderNotificationEmail } from "@/integrations/email/templates";
import { isCronAuthorized } from "@/lib/security/cron-auth";

describe("auditoria 21/11/2026: e-mail de notificação escapa conteúdo digitado", () => {
  it("nome de lead com HTML vira texto, não marcação", () => {
    const html = renderNotificationEmail({ title: "Novo lead <b>x</b>", body: 'Maria <a href="https://golpe.test">clique</a> "x"', ctaLabel: "Ver", ctaUrl: "/admin/leads" });
    expect(html).not.toContain('<a href="https://golpe.test">');
    expect(html).toContain("&lt;a href=&quot;https://golpe.test&quot;&gt;clique&lt;/a&gt;");
    expect(html).toContain("Novo lead &lt;b&gt;x&lt;/b&gt;");
    expect(html).toContain('href="/admin/leads"');
  });
  it("botão só aceita http(s) ou caminho relativo", () => {
    expect(renderNotificationEmail({ title: "t", body: "b", ctaLabel: "c", ctaUrl: "javascript:alert(1)" })).not.toContain("javascript:");
    expect(renderNotificationEmail({ title: "t", body: "b", ctaLabel: "c", ctaUrl: "https://wjbassessoriacontabil.com.br/admin" })).toContain('href="https://wjbassessoriacontabil.com.br/admin"');
  });
});

describe("auditoria 21/11/2026: segredo das rotas agendadas", () => {
  it("compara em tempo constante e recusa ausente, errado ou de tamanho diferente", () => {
    expect(isCronAuthorized("Bearer abc123", "abc123")).toBe(true);
    expect(isCronAuthorized("Bearer abc124", "abc123")).toBe(false);
    expect(isCronAuthorized("Bearer abc1234", "abc123")).toBe(false);
    expect(isCronAuthorized(null, "abc123")).toBe(false);
    expect(isCronAuthorized("Bearer ", "")).toBe(false);
  });
});
