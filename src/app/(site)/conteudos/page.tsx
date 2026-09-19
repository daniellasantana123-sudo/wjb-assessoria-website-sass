import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { PostCard } from "@/components/shared/post-card";
import { RevealStagger } from "@/components/shared/reveal-on-scroll";
import { buttonVariants } from "@/components/ui/button";
import { blogPosts } from "@/content/blog/posts";

export const metadata: Metadata = {
  title: "Conteúdos",
  description:
    "Conteúdo para ajudar sua empresa a decidir melhor em contabilidade, tributos e gestão.",
};

export default function ContentsPage() {
  return (
    <Container className="py-12 sm:py-16">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Conteúdos" }]} />
      <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
        Conteúdos
      </h1>
      <p className="text-muted-foreground mt-3 max-w-2xl">
        Conteúdo para ajudar sua empresa a decidir melhor - sem prometer solução mágica,
        sem jargão desnecessário.
      </p>

      <RevealStagger
        className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        itemClassName="h-full"
      >
        {blogPosts.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </RevealStagger>

      <div className="mt-10 flex justify-center">
        <Link href="/blog" className={buttonVariants({ variant: "outline" })}>
          Ver todos os artigos do blog
        </Link>
      </div>
    </Container>
  );
}
