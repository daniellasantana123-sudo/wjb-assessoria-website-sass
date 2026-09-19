import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { type BlogPost } from "@/content/blog/posts";
import { cn, navigableCardClass } from "@/lib/utils";

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export type PostCardVariant = "teaser" | "listing" | "minimal";

/**
 * Card de post reutilizado em 3 densidades (conceito adaptado de um
 * padrão de blog fornecido pelo usuário em 2026-09-19 — estrutura e
 * comportamento, com os tokens já existentes do site: `navigableCardClass`
 * pro hover/foco, `Badge` pra categoria, `RevealStagger` de fora pra
 * revelação ao rolar):
 * - `teaser` (Home): padding generoso, excerpt em 3 linhas.
 * - `listing` (`/blog`, `/conteudos`, padrão): padding menor, excerpt em 2 linhas.
 * - `minimal` (relacionados no rodapé de um post): só imagem + categoria +
 *   título, sem data/tempo de leitura/excerpt/CTA.
 *
 * `h-full` no `<Link>` (faltava antes) garante altura igual entre cards
 * numa mesma linha de grid, independente do tamanho do excerpt.
 */
export function PostCard({
  post,
  variant = "listing",
}: {
  post: BlogPost;
  variant?: PostCardVariant;
}) {
  if (variant === "minimal") {
    return (
      <Link
        href={`/blog/${post.slug}`}
        className={cn(navigableCardClass, "group flex h-full flex-col overflow-hidden")}
      >
        <div className="bg-muted relative aspect-video w-full overflow-hidden">
          <Image
            src={post.image.src}
            alt={post.image.alt}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        </div>
        <div className="flex flex-col gap-1.5 p-3">
          <Badge tone="neutral">{post.category}</Badge>
          <h3 className="text-foreground text-sm font-medium">{post.title}</h3>
        </div>
      </Link>
    );
  }

  const isTeaser = variant === "teaser";

  return (
    <Link
      href={`/blog/${post.slug}`}
      className={cn(navigableCardClass, "group flex h-full flex-col overflow-hidden")}
    >
      <div className="bg-muted relative aspect-video w-full overflow-hidden">
        <Image
          src={post.image.src}
          alt={post.image.alt}
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        />
      </div>
      <div className={cn("flex flex-1 flex-col gap-3", isTeaser ? "p-6" : "p-5")}>
        <Badge tone="neutral">{post.category}</Badge>
        <div className="text-muted-foreground flex items-center gap-x-2 text-xs">
          <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
          <span aria-hidden="true">•</span>
          <span>{post.readingTime} de leitura</span>
        </div>
        <h3 className={cn("text-foreground font-medium", isTeaser && "text-lg")}>
          {post.title}
        </h3>
        <p
          className={cn(
            "text-muted-foreground text-sm",
            isTeaser ? "line-clamp-3" : "line-clamp-2",
          )}
        >
          {post.excerpt}
        </p>
        <span className="text-primary mt-auto flex items-center gap-1 pt-1 text-sm font-medium">
          Ler artigo
          <ArrowRight
            aria-hidden="true"
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          />
        </span>
      </div>
    </Link>
  );
}
