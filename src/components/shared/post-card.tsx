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

export function PostCard({ post }: { post: BlogPost }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className={cn(navigableCardClass, "group flex flex-col overflow-hidden")}
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
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <Badge tone="neutral">{post.category}</Badge>
          <time dateTime={post.publishedAt} className="text-muted-foreground text-xs">
            {formatDate(post.publishedAt)}
          </time>
        </div>
        <h3 className="text-foreground font-medium">{post.title}</h3>
        <p className="text-muted-foreground text-sm">{post.excerpt}</p>
      </div>
    </Link>
  );
}
