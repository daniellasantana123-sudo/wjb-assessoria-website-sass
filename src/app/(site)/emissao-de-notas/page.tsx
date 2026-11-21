import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  NfsePreRegistrationForm,
  PRE_REGISTRATION_OBJECTIVES,
} from "@/components/commercial/nfse-pre-registration-form";
import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { buttonVariants } from "@/components/ui/button";
import {
  getCommercialWhatsAppLink,
  whatsAppClickToChatNotice,
  type CommercialWhatsAppIntent,
} from "@/integrations/whatsapp";
import { isCommercialEnabled } from "@/lib/commercial/config";
import { formatBrlCents, isPerNotePlan, monthlyWithDiscount } from "@/lib/commercial/pricing";
import { getPublicEmissionCatalog, type PublicPlan } from "@/lib/commercial/repo";

// Interruptor lido em runtime e preços lidos do catálogo aprovado (banco).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Emissão de notas fiscais de serviço",
  description:
    "Emissão de NFS-e com apoio da WJB para MEI e prestadores de serviço: planos, franquias e lista de interesse. Serviço em preparação.",
  alternates: { canonical: "/emissao-de-notas" },
};

type Objective = (typeof PRE_REGISTRATION_OBJECTIVES)[number];

const PUBLICO = [
  { t: "MEI prestador de serviço", d: "O público prioritário: emissão simples, com apoio de quem entende do assunto." },
  { t: "Manicure, cabeleireiro e barbeiro", d: "Serviços de beleza que precisam emitir nota para clientes ou empresas." },
  { t: "Serviços profissionais", d: "Consultoria, design, marketing, aulas e outros serviços prestados a empresas." },
  { t: "ME e EPP prestadoras", d: "Atendidas depois que o contador confere a parametrização fiscal da empresa." },
];

const FAQ = [
  { q: "O emissor de NFS-e do governo não é gratuito?", a: "É, e continua sendo. A WJB não cobra pelo emissor público: cobra pela conveniência, organização, suporte e, quando estiver disponível, pela automação do serviço." },
  { q: "Preciso contratar a contabilidade da WJB?", a: "Não. A emissão de notas pode ser contratada sozinha. Quem é cliente de contabilidade pode somar a emissão com desconto na mensalidade do plano de notas, usando a mesma conta." },
  { q: "O desconto vale para tudo?", a: "Não. O desconto do combo vale só sobre a mensalidade do plano de emissão. Não vale para os honorários de contabilidade, para a Nota Avulsa nem para notas além da franquia, e não se soma a outros descontos." },
  { q: "Sou MEI. O que está incluído?", a: "A solicitação e o acompanhamento das notas de serviço. Não estão incluídos o DAS, a declaração anual (DASN-SIMEI), regularizações, contabilidade ou consultoria, que podem ser contratados à parte." },
  { q: "Sou autônomo (CPF). Posso usar?", a: "Fazemos uma pré-qualificação. A emissão por CPF depende das regras do seu município e da sua habilitação, por isso não prometemos emissão sem essa verificação." },
  { q: "Vendo produtos. Vocês emitem NF-e ou NFC-e?", a: "Ainda não. O serviço é de NFS-e (serviços). NF-e e NFC-e de mercadorias não fazem parte desta primeira etapa." },
  { q: "E se eu passar da franquia do plano?", a: "Você é avisado ao chegar em 80% e em 100% da franquia. Nota além da franquia só com a sua autorização e dentro do limite de gasto que você definir. Nada é cobrado de surpresa." },
  { q: "Já posso emitir minhas notas por aqui?", a: "Ainda não. O serviço está em preparação e nenhum pagamento é feito agora. Entre na lista de interesse ou fale com a equipe para ser avisado na liberação." },
];

function intentFor(sku: string): CommercialWhatsAppIntent {
  if (sku === "nfse_mei") return "mei";
  if (sku === "nfse_volume") return "altoVolume";
  return "somenteEmissao";
}
function objectiveFor(sku: string | undefined): Objective | undefined {
  if (!sku) return undefined;
  if (sku === "combo") return "Contabilidade + emissão (combo)";
  if (sku === "nfse_mei") return "MEI Digital";
  if (sku === "nfse_volume") return "Alto volume";
  if (sku.startsWith("nfse_")) return "Só emissão de NFS-e";
  return undefined;
}
function quotaText(p: PublicPlan) {
  if (p.monthlyCents === null) return "Contratual";
  if (isPerNotePlan(p)) return "Sem franquia: paga por nota";
  return `${p.quota} notas por mês`;
}

function WhatsAppCta({ intent, label, location, variant = "outline" }: { intent: CommercialWhatsAppIntent; label: string; location: string; variant?: "outline" | "cta" }) {
  const href = getCommercialWhatsAppLink(intent);
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" data-analytics-location={location} className={buttonVariants({ variant })}>
      {label}
      <span className="sr-only"> (abre o WhatsApp em nova aba)</span>
    </a>
  );
}

/**
 * Landing da emissão de notas (Fase 9). Preços aprovados pela WJB em
 * 21/11/2026, lidos do catálogo aprovado no banco. O serviço ainda não está
 * operacional: sem botão de pagamento, CTAs levam à lista de interesse e ao
 * atendimento comercial (Click-to-Chat do WhatsApp).
 */
export default async function EmissaoDeNotasPage({ searchParams }: PageProps<"/emissao-de-notas">) {
  if (!isCommercialEnabled()) notFound();
  const [{ plans, comboDiscountBp }, sp] = await Promise.all([getPublicEmissionCatalog(), searchParams]);
  const comboPct = comboDiscountBp / 100;
  const prefill = objectiveFor(typeof sp.plano === "string" ? sp.plano : undefined);

  return (
    <Container className="py-12 sm:py-16">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Emissão de notas" }]} />
      <section className="mt-4 max-w-3xl">
        <p className="text-primary text-sm font-medium tracking-wide uppercase">Em preparação · lista de interesse aberta</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Emita suas notas de serviço com o apoio da WJB.</h1>
        <p className="text-muted-foreground mt-3 text-lg">
          Você informa o serviço, o valor e quem contratou. A WJB cuida das regras, confere e acompanha a nota até o fim, com
          suporte de gente de verdade.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href="#lista" className={buttonVariants({ variant: "cta" })}>Entrar na lista de interesse</a>
          <a href="#planos" className={buttonVariants({ variant: "outline" })}>Ver planos</a>
          <WhatsAppCta intent="duvidaEmissao" label="Falar no WhatsApp" location="emissao-hero" />
        </div>
        <p className="text-muted-foreground mt-2 text-xs">{whatsAppClickToChatNotice}</p>
      </section>

      <div role="note" className="border-primary/30 bg-primary/5 mt-10 max-w-3xl rounded-md border px-4 py-4 text-sm sm:px-5">
        <p><strong>O emissor público de NFS-e é gratuito.</strong> A WJB não cobra por ele: cobra pela conveniência, organização, suporte e, quando estiver disponível, pela automação do serviço.</p>
        <p className="mt-2"><strong>A emissão pela WJB ainda não está disponível.</strong> Hoje você entra na lista de interesse ou fala com a equipe. Nenhum pagamento é feito por esta página.</p>
      </div>

      <section aria-labelledby="formas" className="mt-14">
        <h2 id="formas" className="text-2xl font-bold tracking-tight">Três formas de contratar</h2>
        <ul className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <li className="border-border flex min-w-0 flex-col gap-3 rounded-md border p-5">
            <h3 className="font-semibold">Contabilidade completa</h3>
            <p className="text-muted-foreground text-sm">Os planos de contabilidade da WJB, com honorários próprios, para MEI, Simples Nacional e Lucro Presumido.</p>
            <div className="mt-auto flex flex-wrap gap-2">
              <Link href="/planos" className={buttonVariants({ variant: "outline", size: "sm" })}>Ver planos de contabilidade</Link>
            </div>
          </li>
          <li className="border-border flex min-w-0 flex-col gap-3 rounded-md border p-5">
            <h3 className="font-semibold">Só a emissão de notas</h3>
            <p className="text-muted-foreground text-sm">Um plano de NFS-e independente, sem precisar contratar contabilidade.</p>
            <div className="mt-auto flex flex-wrap gap-2"><WhatsAppCta intent="somenteEmissao" label="Quero só a emissão" location="emissao-formas" /></div>
          </li>
          <li className="border-border flex min-w-0 flex-col gap-3 rounded-md border p-5">
            <h3 className="font-semibold">Contabilidade + emissão (combo)</h3>
            <p className="text-muted-foreground text-sm">
              {comboPct > 0 ? <><strong>{comboPct}% de desconto</strong> na mensalidade do plano de notas</> : "Desconto na mensalidade do plano de notas"}, com a mesma conta e os mesmos acessos.
            </p>
            <div className="mt-auto flex flex-wrap gap-2"><WhatsAppCta intent="combo" label="Quero o combo" location="emissao-formas" /></div>
          </li>
        </ul>
      </section>

      <section id="planos" aria-labelledby="planos-titulo" className="mt-14 scroll-mt-24">
        <h2 id="planos-titulo" className="text-2xl font-bold tracking-tight">Planos de emissão</h2>
        <p className="text-muted-foreground mt-1 text-sm">Valores por empresa, por ciclo mensal. Cobrança só começará quando o serviço for liberado, com contrato e aceite.</p>
        {plans.length === 0 ? (
          <p className="text-muted-foreground mt-6 text-sm">Os planos serão publicados em breve. Entre na lista de interesse para ser avisado.</p>
        ) : (
          <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {plans.map((p) => {
              const combo = comboDiscountBp && p.monthlyCents ? monthlyWithDiscount(p, comboDiscountBp) : null;
              return (
                <li key={p.sku} className="border-border flex min-w-0 flex-col gap-3 rounded-md border p-5">
                  <h3 className="text-lg font-semibold">{p.name}</h3>
                  {p.description ? <p className="text-muted-foreground text-sm">{p.description}</p> : null}
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                    <dt className="text-muted-foreground">Mensalidade</dt>
                    <dd className="font-semibold">{p.monthlyCents === null ? "Sob proposta" : formatBrlCents(p.monthlyCents)}</dd>
                    <dt className="text-muted-foreground">Franquia</dt>
                    <dd>{quotaText(p)}</dd>
                    <dt className="text-muted-foreground">{isPerNotePlan(p) ? "Por nota" : "Nota adicional"}</dt>
                    <dd>{p.overageCents === null ? "Contratual" : `${formatBrlCents(p.overageCents)} por nota autorizada`}</dd>
                    {combo !== null && combo !== p.monthlyCents ? (
                      <>
                        <dt className="text-muted-foreground">No combo</dt>
                        <dd>{formatBrlCents(combo)} por mês</dd>
                      </>
                    ) : null}
                  </dl>
                  <div className="mt-auto flex flex-wrap gap-2 pt-2">
                    <Link href={`/emissao-de-notas?plano=${p.sku}#lista`} className={buttonVariants({ variant: "cta", size: "sm" })}>
                      Tenho interesse
                      <span className="sr-only"> no plano {p.name}</span>
                    </Link>
                    <a
                      href={getCommercialWhatsAppLink(intentFor(p.sku)) ?? "#lista"}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-analytics-location={`emissao-plano-${p.sku}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      {p.monthlyCents === null ? "Pedir proposta" : "WhatsApp"}
                      <span className="sr-only"> sobre o plano {p.name} (abre o WhatsApp em nova aba)</span>
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <ul className="text-muted-foreground mt-6 grid max-w-3xl list-disc gap-1 pl-5 text-sm">
          <li>Franquia separada por empresa. Notas que não usar no mês não acumulam.</li>
          <li>Avisos ao chegar em 80% e em 100% da franquia. Nota além dela só com a sua autorização e dentro do limite de gasto que você definir.</li>
          <li>Só nota oficialmente autorizada conta para cobrança. Testes e simulações nunca são cobrados.</li>
          <li>O desconto do combo vale só sobre a mensalidade do plano de notas e não se soma a outros descontos.</li>
        </ul>
      </section>

      <section aria-labelledby="para-quem" className="mt-14">
        <h2 id="para-quem" className="text-2xl font-bold tracking-tight">Para quem é</h2>
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {PUBLICO.map((p) => (
            <li key={p.t} className="border-border min-w-0 rounded-md border p-4">
              <h3 className="font-semibold">{p.t}</h3>
              <p className="text-muted-foreground mt-1 text-sm">{p.d}</p>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground mt-4 max-w-3xl text-sm">
          Emissão para pessoa física (autônomo) depende das regras do município e da habilitação do profissional. NF-e e NFC-e de
          mercadorias não fazem parte desta etapa.
        </p>
      </section>

      <section aria-labelledby="como" className="mt-14">
        <h2 id="como" className="text-2xl font-bold tracking-tight">Como vai funcionar</h2>
        <p className="text-muted-foreground mt-1 text-sm">Processo planejado, ainda em preparação.</p>
        <ol className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {["Você pede a nota pelo Portal ou pelo assistente", "Conferimos os dados e as regras do seu cadastro fiscal", "A nota é emitida pelo sistema nacional", "Você acompanha tudo e recebe o documento"].map((t, i) => (
            <li key={t} className="border-border min-w-0 rounded-md border p-4">
              <span className="text-primary text-sm font-semibold">Passo {i + 1}</span>
              <p className="mt-1 text-sm">{t}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="duvidas-emissao" className="mt-14 max-w-3xl">
        <h2 id="duvidas-emissao" className="text-2xl font-bold tracking-tight">Dúvidas frequentes</h2>
        <div className="mt-4 flex flex-col gap-2">
          {FAQ.map((f) => (
            <details key={f.q} className="border-border rounded-md border p-4">
              <summary className="cursor-pointer font-medium">{f.q}</summary>
              <p className="text-muted-foreground mt-2 text-sm">{f.a}</p>
            </details>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <WhatsAppCta intent="duvidaEmissao" label="Tirar uma dúvida no WhatsApp" location="emissao-faq" />
          <WhatsAppCta intent="altoVolume" label="Pedir proposta de alto volume" location="emissao-faq" />
        </div>
      </section>

      <section id="lista" aria-labelledby="lista-titulo" className="border-border mt-14 max-w-3xl scroll-mt-24 rounded-md border p-5 sm:p-6">
        <h2 id="lista-titulo" className="text-2xl font-bold tracking-tight">Entre na lista de interesse</h2>
        <p className="text-muted-foreground mt-1 mb-4 text-sm">Sem compromisso e sem cobrança. Avisamos quando o serviço estiver liberado para o seu perfil.</p>
        <NfsePreRegistrationForm key={prefill ?? "padrao"} defaultObjective={prefill} />
      </section>
    </Container>
  );
}
