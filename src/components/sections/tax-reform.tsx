import Image from "next/image";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { buttonVariants } from "@/components/ui/button";
import { homeImages } from "@/config/images";

/**
 * Banner de urgência (2026-09-17, a pedido do usuário — "layout/composição
 * das seções"): antes era uma cópia pixel-a-pixel de `wjb-armelx.tsx`
 * (mesma grade 2 colunas imagem+texto, nada a mais). Reforma Tributária é
 * uma mudança regulatória com urgência real, diferente da parceria
 * institucional de `wjb-armelx` — o painel com fundo `bg-primary/5` e
 * régua `border-l-4 border-primary` comunica isso visualmente e distingue
 * as duas seções na rolagem da página, reaproveitando só a cor `primary`
 * já existente (nenhuma cor nova).
 */
export function TaxReform() {
  return (
    <section className="border-border bg-primary/5 border-b">
      <Container className="py-16 sm:py-20">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-12">
          <div className="group relative aspect-[3/2] w-full overflow-hidden rounded-[10px] lg:order-1">
            <Image
              src={homeImages.taxReform.src}
              alt={homeImages.taxReform.alt}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />
          </div>
          <div className="border-primary lg:order-2 lg:border-l-4 lg:pl-8">
            <p className="text-primary text-sm font-medium tracking-wide uppercase">
              Reforma Tributária
            </p>
            <h2 className="mt-2 max-w-xl text-2xl font-bold tracking-tight sm:text-3xl">
              Sua empresa preparada para as mudanças
            </h2>
            <p className="text-muted-foreground mt-3 max-w-xl">
              Acompanhamos a Reforma Tributária de perto para adaptar sua empresa com
              segurança, sem surpresas.
            </p>
            <Link
              href="/servicos/reforma-tributaria"
              className={buttonVariants({ variant: "cta", className: "mt-6" })}
            >
              Entender o que muda
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
