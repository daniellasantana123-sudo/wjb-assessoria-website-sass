import { describe, expect, it } from "vitest";

import { isLegacyWordPressPath } from "@/lib/seo/legacy-paths";

describe("isLegacyWordPressPath", () => {
  it("reconhece os endereços do WordPress apontados pelo Search Console", () => {
    for (const path of [
      "/wp-content/uploads/2020/01/foto.jpg",
      "/wp-admin/",
      "/wp-admin",
      "/wp-login.php",
      "/xmlrpc.php",
      "/comments/feed/",
      "/feed",
      "/m%C3%AAs",
    ]) {
      expect(isLegacyWordPressPath(path), path).toBe(true);
    }
  });

  it("não afeta as páginas do site novo", () => {
    for (const path of ["/", "/sobre", "/blog", "/blog/simples-nacional-guia-empresas", "/wp", "/servicos"]) {
      expect(isLegacyWordPressPath(path), path).toBe(false);
    }
  });

  it("não quebra com codificação inválida", () => {
    expect(isLegacyWordPressPath("/%E0%A4%A")).toBe(false);
  });
});
