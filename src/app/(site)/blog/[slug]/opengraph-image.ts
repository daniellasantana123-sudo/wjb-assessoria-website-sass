import { existsSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";

import { blogPosts, getBlogPost } from "@/content/blog/posts";

export const alt = "Artigo do blog da WJB Assessoria Contábil";
export const size = { width: 1200, height: 630 };
export const contentType = "image/jpeg";

export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

/**
 * Imagem de pré-visualização (Open Graph) de cada post - o que aparece ao
 * mandar o link no WhatsApp, LinkedIn, etc.
 *
 * Gerada automaticamente (2026-09-30): o primeiro post publicado depois dos
 * 15 originais saiu sem imagem no WhatsApp porque a página apontava
 * para um arquivo em `public/images/og/` que ninguém criou. Agora:
 * - se existir `public/images/og/blog-<slug>.webp` (feito sob medida para
 *   compartilhamento), ele tem prioridade;
 * - senão, usa a capa do post (`post.image`), recortada para 1200x630.
 *
 * Sai sempre em JPEG: o WhatsApp não mostra WebP de forma confiável na
 * pré-visualização de link. Como os posts são estáticos
 * (`generateStaticParams`), a imagem é gerada no build, não a cada acesso.
 */
export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPost(slug);

  const publicDir = path.join(process.cwd(), "public");
  const customOg = path.join(publicDir, "images", "og", `blog-${slug}.webp`);
  const source = existsSync(customOg)
    ? customOg
    : post
      ? path.join(publicDir, post.image.src)
      : path.join(publicDir, "images", "og", "home.webp");

  const jpeg = await sharp(source)
    .resize(size.width, size.height, {
      fit: "cover",
      position: sharp.strategy.attention,
    })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();

  return new Response(new Uint8Array(jpeg), {
    headers: { "Content-Type": contentType },
  });
}
