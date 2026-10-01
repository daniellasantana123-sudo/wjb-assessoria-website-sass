import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

describe("AppCredits", () => {
  it("mostra versão, build e a assinatura com link para a Armel-x em nova aba", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_VERSION", "1.1.0");
    vi.stubEnv("NEXT_PUBLIC_APP_COMMIT", "abc1234");
    vi.stubEnv("NEXT_PUBLIC_APP_BUILD_DATE", "01/10/2026");
    const { AppCredits } = await import("@/components/app-shell/app-credits");

    const html = renderToStaticMarkup(<AppCredits />);

    expect(html).toContain("Plataforma WJB v1.1.0");
    expect(html).toContain("build abc1234");
    expect(html).toContain("01/10/2026");
    expect(html).toContain("Desenvolvido por");
    expect(html).toContain('href="https://armelx.com/"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain("Armel-x Tecnologia");
    vi.unstubAllEnvs();
  });
});
