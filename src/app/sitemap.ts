import type { MetadataRoute } from "next";

import { servicePages } from "@/config/service-pages";
import { blogPosts } from "@/content/blog/posts";
import { getSiteUrl } from "@/lib/seo/site-url";

/** Lista só rotas que existem de verdade — não submeter 404 para buscadores. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  // `lastModified` só nos posts, com a data real de atualização (2026-10-30).
  // Antes todas as páginas iam com a data do build, então a cada deploy o
  // sitemap dizia que o site inteiro tinha mudado - o Google aprende a
  // ignorar um lastmod que nunca é verdade. Sem data real, melhor omitir.
  // /login fica fora de propósito: tela de acesso não é conteúdo para busca
  // (também marcada noindex), e entrava no Search Console como página fraca.

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "weekly", priority: 1 },
    {
      url: `${base}/servicos`,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${base}/blog`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${base}/conteudos`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${base}/contato`,
      changeFrequency: "yearly",
      priority: 0.6,
    },
    {
      url: `${base}/solicitar-proposta`,
      changeFrequency: "yearly",
      priority: 0.8,
    },
    {
      url: `${base}/area-do-cliente`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${base}/sobre`,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${base}/planos`,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${base}/planos/mei`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${base}/planos/simples-nacional`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${base}/planos/lucro-presumido`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${base}/como-funciona`,
      changeFrequency: "yearly",
      priority: 0.6,
    },
    {
      url: `${base}/contabilidade-digital`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${base}/solucoes`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${base}/armel-x-tecnologia`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${base}/duvidas`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${base}/politica-de-privacidade`,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${base}/termos`,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${base}/cookies`,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];

  const serviceRoutes: MetadataRoute.Sitemap = servicePages.map((service) => ({
    url: `${base}/servicos/${service.slug}`,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const blogRoutes: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `${base}/blog/${post.slug}`,
    lastModified: new Date(post.updatedAt),
    changeFrequency: "yearly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...serviceRoutes, ...blogRoutes];
}
