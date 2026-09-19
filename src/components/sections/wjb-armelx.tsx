import Image from "next/image";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { buttonVariants } from "@/components/ui/button";
import { homeImages } from "@/config/images";

import { SectionHeading } from "./section-heading";

export function WjbArmelx() {
  return (
    <section className="border-border bg-muted/30 border-b">
      <Container className="py-16 sm:py-20">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-12">
          <div>
            <SectionHeading
              align="left"
              eyebrow="WJB + Armel-x Tecnologia"
              title={
                <>
                  <span className="text-primary">Contabilidade e tecnologia,</span>
                  <br />
                  lado a lado
                </>
              }
              titleClassName="text-3xl sm:text-4xl"
              description="A WJB conta com a Armel-x Tecnologia como parceira para levar tecnologia à contabilidade - duas empresas independentes, trabalhando juntas pelo seu negócio."
            />
            <Link
              href="/armel-x-tecnologia"
              className={buttonVariants({ variant: "outline", className: "mt-6" })}
            >
              Conhecer a parceria
            </Link>
          </div>

          <div className="group relative aspect-[3/2] w-full overflow-hidden rounded-[10px]">
            <Image
              src={homeImages.wjbArmelx.src}
              alt={homeImages.wjbArmelx.alt}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
