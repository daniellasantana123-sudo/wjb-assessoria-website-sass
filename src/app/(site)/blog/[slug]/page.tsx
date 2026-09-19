import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { JsonLd } from "@/components/shared/json-ld";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getBlogOgImage } from "@/config/images";
import { headerCtas } from "@/config/navigation";
import { getServicePage } from "@/config/service-pages";
import { type BlogBlock, blogPosts, getBlogPost } from "@/content/blog/posts";
import { getArticleSchema, getBreadcrumbSchema } from "@/lib/seo/schema";

export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.description,
    keywords: post.tags,
    openGraph: {
      images: [{ url: getBlogOgImage(post.slug), width: 1200, height: 630 }],
    },
  };
}

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function ContentBlock({ block }: { block: BlogBlock }) {
  switch (block.type) {
    case "heading":
      return block.level === 3 ? (
        <h3 className="text-foreground mt-6 text-base font-semibold">{block.text}</h3>
      ) : (
        <h2 className="text-foreground mt-8 text-xl font-semibold">{block.text}</h2>
      );
    case "paragraph":
      return <p className="text-foreground mt-3">{block.text}</p>;
    case "list":
      return (
        <ul className="text-foreground mt-3 list-disc space-y-1.5 pl-5">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case "table":
      return (
        <div className="border-border mt-4 overflow-x-auto rounded-md border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted">
              <tr>
                {block.headers.map((header) => (
                  <th key={header} className="text-foreground px-3 py-2 font-medium">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {block.rows.map((row) => (
                <tr key={row.join("-")}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="text-foreground px-3 py-2">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  const relatedService = post.relatedServiceSlug
    ? getServicePage(post.relatedServiceSlug)
    : undefined;
  const relatedPosts = (post.relatedPostSlugs ?? [])
    .map((relatedSlug) => getBlogPost(relatedSlug))
    .filter((relatedPost) => relatedPost !== undefined);

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Blog", href: "/blog" },
    { label: post.title },
  ];

  return (
    <Container className="py-12 sm:py-16">
      <JsonLd data={getArticleSchema(post)} />
      <JsonLd data={getBreadcrumbSchema(breadcrumbItems)} />
      <Breadcrumb items={breadcrumbItems} />

      <div className="group relative mt-6 aspect-video max-w-3xl overflow-hidden rounded-[10px]">
        <Image
          src={post.image.src}
          alt={post.image.alt}
          fill
          priority
          sizes="(min-width: 1024px) 768px, 100vw"
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        />
      </div>

      <article className="mt-8 max-w-2xl">
        <Badge tone="neutral">{post.category}</Badge>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          {post.title}
        </h1>
        <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span>{post.author}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={post.publishedAt}>
            Publicado em {formatDate(post.publishedAt)}
          </time>
          {post.updatedAt !== post.publishedAt ? (
            <>
              <span aria-hidden="true">·</span>
              <time dateTime={post.updatedAt}>
                Atualizado em {formatDate(post.updatedAt)}
              </time>
            </>
          ) : null}
          <span aria-hidden="true">·</span>
          <span>{post.readingTime} de leitura</span>
        </div>
        <p className="text-muted-foreground mt-4 text-lg">{post.excerpt}</p>

        {post.showLegalDisclaimer ? (
          <div className="border-warning-text/30 bg-warning-bg text-warning-text mt-6 rounded-md border px-4 py-3 text-sm">
            Conteúdo atualizado em {formatDate(post.updatedAt)}. Regras tributárias e
            trabalhistas podem sofrer alterações. Consulte a legislação vigente e a
            análise aplicável à sua empresa.
          </div>
        ) : null}

        <div className="mt-8">
          {post.content.map((block, index) => (
            <ContentBlock key={index} block={block} />
          ))}
        </div>

        {post.faq.length > 0 ? (
          <div className="mt-10">
            <h2 className="text-foreground text-xl font-semibold">Dúvidas frequentes</h2>
            <div className="divide-border mt-3 divide-y">
              {post.faq.map((item) => (
                <div key={item.question} className="py-4">
                  <h3 className="text-foreground font-medium">{item.question}</h3>
                  <p className="text-muted-foreground mt-1.5 text-sm">{item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <Badge key={tag} tone="neutral">
              {tag}
            </Badge>
          ))}
        </div>

        <div className="border-border bg-muted/30 mt-10 rounded-md border p-6">
          <p className="text-foreground font-medium">{post.cta.text}</p>
          <Link
            href={post.cta.href}
            className={buttonVariants({ variant: "cta", className: "mt-4" })}
          >
            {post.cta.label}
          </Link>
        </div>

        <p className="border-border text-muted-foreground mt-10 border-t pt-6 text-sm">
          Conteúdo educativo e geral. Para orientação aplicada ao caso da sua empresa,
          fale com um contador da WJB.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href={headerCtas.talkToAccountant.href}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "cta" })}
          >
            {headerCtas.talkToAccountant.label}
          </Link>
          {relatedService ? (
            <Link
              href={`/servicos/${relatedService.slug}`}
              className={buttonVariants({ variant: "outline" })}
            >
              Ver {relatedService.title}
            </Link>
          ) : null}
        </div>

        {relatedPosts.length > 0 ? (
          <div className="mt-10">
            <h2 className="text-foreground text-lg font-semibold">Continue lendo</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {relatedPosts.map((relatedPost) => (
                <li key={relatedPost.slug}>
                  <Link
                    href={`/blog/${relatedPost.slug}`}
                    className="text-primary hover:underline"
                  >
                    {relatedPost.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </article>
    </Container>
  );
}
