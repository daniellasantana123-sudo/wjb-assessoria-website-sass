import { siteConfig } from "@/config/site";
import { plans } from "@/config/plans";

import { getSiteUrl } from "./site-url";

/**
 * JSON-LD AccountingService (seção 20 de WJB_Conteudos_Incompletos...md) —
 * dados institucionais reais confirmados pelo usuário em 2026-08-30. Nunca
 * inventar `aggregateRating`, `reviewCount` ou quantidade de clientes.
 */
export function getOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "AccountingService",
    name: siteConfig.company.name,
    url: siteConfig.company.website,
    email: siteConfig.contact.email,
    telephone: `+${siteConfig.contact.phones[0].e164}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: `${siteConfig.address.street} - ${siteConfig.address.complement}`,
      addressLocality: siteConfig.address.city,
      addressRegion: siteConfig.address.state,
      postalCode: siteConfig.address.zipCode,
      addressCountry: "BR",
    },
    sameAs: [siteConfig.partners.armelx.website],
    employee: {
      "@type": "Person",
      name: siteConfig.company.responsibleAccountant,
      jobTitle: `Responsável Técnica Contábil (CRC ${siteConfig.company.crc})`,
    },
  };
}

export function getArticleSchema(post: {
  title: string;
  description: string;
  publishedAt: string;
  updatedAt: string;
  slug: string;
  image: { src: string };
}) {
  const base = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    image: `${base}${post.image.src}`,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    url: `${base}/blog/${post.slug}`,
    author: { "@type": "Organization", name: siteConfig.name },
    publisher: { "@type": "Organization", name: siteConfig.name },
  };
}

/**
 * Service/OfferCatalog de /planos (seção 34 de WJB_Planos_Simulador_
 * Implementacao_Claude.md) — preços marcados como `minPrice` ("a partir
 * de"), nunca `aggregateRating`/avaliações inventadas.
 */
export function getPlansCatalogSchema() {
  const base = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Contabilidade",
    provider: { "@type": "AccountingService", name: siteConfig.company.name, url: base },
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Planos mensais WJB",
      itemListElement: plans.map((plan) => ({
        "@type": "Offer",
        name: `Plano ${plan.name}`,
        url: `${base}${plan.detailsPath}`,
      })),
    },
  };
}

export function getBreadcrumbSchema(items: { label: string; href?: string }[]) {
  const base = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: `${base}${item.href}` } : {}),
    })),
  };
}
