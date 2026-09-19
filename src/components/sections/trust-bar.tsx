import { Cpu, ShieldCheck, SlidersHorizontal, Users } from "lucide-react";

import { Container } from "@/components/layout/container";
import { RevealStagger } from "@/components/shared/reveal-on-scroll";

/**
 * Sem números/depoimentos/certificações inventados (seção 43) — indicadores
 * de posicionamento (seção 3), não estatísticas.
 */
const items = [
  { icon: Users, label: "Atendimento humano e consultivo" },
  { icon: SlidersHorizontal, label: "Organização e clareza para decidir" },
  { icon: Cpu, label: "Tecnologia integrada com a Armel-x" },
  { icon: ShieldCheck, label: "Postura responsável e segura" },
];

export function TrustBar() {
  return (
    <section className="border-border bg-muted/50 border-b">
      <Container className="py-8">
        <RevealStagger className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3">
              <Icon aria-hidden="true" className="text-primary h-5 w-5 shrink-0" />
              <span className="text-foreground text-sm font-medium">{label}</span>
            </div>
          ))}
        </RevealStagger>
      </Container>
    </section>
  );
}
