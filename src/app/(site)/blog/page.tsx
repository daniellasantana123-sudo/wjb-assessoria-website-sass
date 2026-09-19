import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { PostCard } from "@/components/shared/post-card";
import { RevealOnScroll, RevealStagger } from "@/components/shared/reveal-on-scroll";
import { blogPosts } from "@/content/blog/posts";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Artigos sobre reforma tributária, planejamento tributário, contabilidade, departamento pessoal e tecnologia para ajudar sua empresa a decidir melhor.",
};

const categoryOrder = [
  "Reforma Tributária",
  "Tributário",
  "Simples Nacional",
  "Lucro Presumido",
  "Abertura de Empresa",
  "Contabilidade",
  "Fiscal",
  "Contabilidade Digital",
  "Departamento Pessoal",
  "Gestão",
  "Tecnologia",
];

export default function BlogPage() {
  return (
    <Container className="py-12 sm:py-16">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Blog" }]} />
      <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Blog</h1>
      <p className="text-muted-foreground mt-3 max-w-2xl">
        Artigos sobre contabilidade, tributos e gestão para ajudar sua empresa a decidir
        melhor.
      </p>

      {categoryOrder.map((category) => {
        const items = blogPosts.filter((post) => post.category === category);
        if (items.length === 0) return null;

        return (
          <RevealOnScroll key={category} as="section" className="mt-10">
            <h2 className="text-foreground text-lg font-semibold">{category}</h2>
            <RevealStagger
              className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
              itemClassName="h-full"
            >
              {items.map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </RevealStagger>
          </RevealOnScroll>
        );
      })}
    </Container>
  );
}
