import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireSessionMock = vi.fn();
vi.mock("@/lib/auth/dal", () => ({ requireSession: requireSessionMock }));
// O formulário é client component com Server Action; aqui só importa o que fica abaixo dele.
vi.mock("@/components/auth/first-access-form", () => ({ FirstAccessForm: () => <form data-testid="form" /> }));
vi.mock("@/components/auth/set-password-form", () => ({ SetPasswordForm: () => <form /> }));

const { default: SetPasswordPage } = await import("@/app/(site)/(auth)/definir-senha/page");

async function render(isWjbStaff: boolean, welcome = true) {
  requireSessionMock.mockResolvedValue({
    userId: "u1",
    email: "pessoa@empresa.com.br",
    fullName: "Pessoa",
    isWjbStaff,
  });
  const element = await SetPasswordPage({
    searchParams: Promise.resolve(welcome ? { "boas-vindas": "1" } : {}),
  });
  return renderToStaticMarkup(element);
}

beforeEach(() => vi.clearAllMocks());

describe("primeiro acesso: atalho para o guia", () => {
  it("cliente vê o link para /ajuda, abaixo do formulário, em nova aba", async () => {
    const html = await render(false);
    expect(html).toContain('href="/ajuda"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain("Primeira vez por aqui? Veja o guia do Portal");
    expect(html.indexOf('data-testid="form"')).toBeLessThan(html.indexOf('href="/ajuda"'));
  });

  it("equipe WJB vê o manual da plataforma", async () => {
    const html = await render(true);
    expect(html).toContain('href="/admin/manual"');
    expect(html).toContain("Manual da plataforma");
    expect(html).not.toContain('href="/ajuda"');
  });

  it("recuperação de senha (sem boas-vindas) não mostra o atalho", async () => {
    const html = await render(false, false);
    expect(html).not.toContain('href="/ajuda"');
  });
});
