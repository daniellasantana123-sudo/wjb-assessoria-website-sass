"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

import { Container } from "@/components/layout/container";
import { cn } from "@/lib/utils";
import { faqItems } from "@/content/faq";

import { SectionHeading } from "./section-heading";

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="border-border border-b">
      <Container className="py-16 sm:py-20">
        <SectionHeading eyebrow="FAQ" title="Dúvidas frequentes" />
        <div className="divide-border mx-auto mt-10 max-w-2xl divide-y">
          {faqItems.map((item, index) => {
            const isOpen = openIndex === index;
            const panelId = `faq-panel-${index}`;
            const buttonId = `faq-button-${index}`;

            return (
              <div key={item.question}>
                <h3>
                  <button
                    type="button"
                    id={buttonId}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    className="hover:text-primary focus-visible:ring-primary text-foreground flex min-h-11 w-full items-center justify-between gap-4 py-4 text-left font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    {item.question}
                    <ChevronDown
                      aria-hidden="true"
                      className={cn(
                        "h-5 w-5 shrink-0 transition-transform duration-300",
                        isOpen && "rotate-180",
                      )}
                    />
                  </button>
                </h3>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  aria-hidden={!isOpen}
                  inert={!isOpen}
                  className={cn(
                    "grid transition-all duration-300 ease-in-out",
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="pb-4">
                      <p className="text-muted-foreground text-sm">{item.answer}</p>
                      {item.href ? (
                        <Link
                          href={item.href}
                          className="text-primary mt-2 inline-block text-sm font-medium hover:underline"
                        >
                          {item.linkLabel ?? "Saiba mais"}
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
