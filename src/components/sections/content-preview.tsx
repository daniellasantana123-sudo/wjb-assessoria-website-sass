import Link from "next/link";

import { Container } from "@/components/layout/container";
import { PostCard } from "@/components/shared/post-card";
import { RevealStagger } from "@/components/shared/reveal-on-scroll";
import { buttonVariants } from "@/components/ui/button";
import { getBlogPost } from "@/content/blog/posts";

import { SectionHeading } from "./section-heading";

/** 3 posts em destaque, escolhidos para mostrar variedade de categorias. */
const featuredSlugs = [
  "reforma-tributaria-como-preparar-empresa",
  "contabilidade-digital",
  "simples-nacional-guia-empresas",
];

export function ContentPreview() {
  const featuredPosts = featuredSlugs
    .map((slug) => getBlogPost(slug))
    .filter((post) => post !== undefined);

  return (
    <section className="border-border bg-muted/30 border-b">
      <Container className="py-16 sm:py-20">
        <SectionHeading
          eyebrow="Conteúdos"
          title="Conteúdo para ajudar sua empresa a decidir melhor"
          description="Artigos sobre contabilidade, tributos e gestão."
        />
        <RevealStagger
          className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          itemClassName="h-full"
        >
          {featuredPosts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </RevealStagger>
        <div className="mt-8 flex justify-center">
          <Link href="/conteudos" className={buttonVariants({ variant: "outline" })}>
            Ver todos os conteúdos
          </Link>
        </div>
      </Container>
    </section>
  );
}
