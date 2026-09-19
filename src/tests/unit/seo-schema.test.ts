import { describe, expect, it } from "vitest";

import {
  getArticleSchema,
  getBreadcrumbSchema,
  getOrganizationSchema,
} from "@/lib/seo/schema";

describe("getOrganizationSchema", () => {
  it("nunca inclui campos ainda marcados como [CONFIRMAR]", () => {
    const schema = getOrganizationSchema();
    const json = JSON.stringify(schema);
    expect(json).not.toContain("[CONFIRMAR]");
  });

  it("sempre inclui o nome da empresa", () => {
    const schema = getOrganizationSchema();
    expect(schema.name).toBe("WJB Assessoria Contábil");
  });
});

describe("getBreadcrumbSchema", () => {
  it("gera um ListItem por item, na posição correta", () => {
    const schema = getBreadcrumbSchema([
      { label: "Home", href: "/" },
      { label: "Serviços", href: "/servicos" },
      { label: "Contabilidade Completa" },
    ]);
    expect(schema.itemListElement).toHaveLength(3);
    expect(schema.itemListElement[2].position).toBe(3);
    expect(schema.itemListElement[2]).not.toHaveProperty("item");
  });
});

describe("getArticleSchema", () => {
  it("monta a URL absoluta do post", () => {
    const schema = getArticleSchema({
      title: "Título do post",
      description: "Resumo do post.",
      publishedAt: "2026-08-30",
      updatedAt: "2026-08-30",
      slug: "titulo-do-post",
      image: { src: "/images/blog/tax/simples-nacional-business.webp" },
    });
    expect(schema.url).toContain("/blog/titulo-do-post");
    expect(schema.headline).toBe("Título do post");
  });
});
