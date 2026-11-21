import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { NfsePreRegistrationForm } from "@/components/commercial/nfse-pre-registration-form";
import { Container } from "@/components/layout/container";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { buttonVariants } from "@/components/ui/button";
import { getWhatsAppLink } from "@/integrations/whatsapp";
import { isCommercialEnabled } from "@/lib/commercial/config";

// Interruptor lido em runtime: a página só existe com a comercialização ligada.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Emissão de notas fiscais de serviço",
  description:
    "Emissão de NFS-e com apoio da WJB para MEI e prestadores de serviço. Lista de interesse aberta: o serviço está em preparação.",
  alternates: { canonical: "/emissao-de-notas" },
};

const PUBLICO = [
  { t: "Manicure, cabeleireiro e barbeiro", d: "Serviços de beleza que precisam emitir nota para clientes ou empresas." },
  { t: "Serviços profissionais", d: "Consultoria, design, marketing, aulas e outros serviços prestados a empresas." },
  { t: "MEI prestador de serviço", d: "O público prioritário: emissão simples, com apoio de quem entende do assunto." },
  { t: "ME e EPP prestadoras", d: "Atendidas depois da conferência da parametrização fiscal pelo contador." },
];
const MODALIDADES = [
  { t: "Nota avulsa", d: "Para quem emite pouco: paga só quando usar." },
  { t: "MEI Digital", d: "Mensalidade com franquia de notas, pensada para MEI." },
  { t: "Profissional e Empresa", d: "Franquias maiores, para quem emite com frequência." },
  { t: "Alto volume", d: "Condições sob proposta." },
];
const FAQ = [
  { q: "Preciso contratar a contabilidade da WJB?", a: "Não. A emissão de notas pode ser contratada sozinha. Quem já é cliente de contabilidade pode somar a emissão com desconto, sem criar outra conta." },
  { q: "O emissor de NFS-e do governo não é gratuito?", a: "É. A WJB não cobra pelo emissor público: cobra pela conveniência, organização, suporte e automação do serviço." },
  { q: "Sou MEI. O que está incluído?", a: "A solicitação e o acompanhamento das notas de serviço. Não estão incluídos o DAS, a declaração anual (DASN-SIMEI), regularizações, contabilidade ou consultoria, que podem ser contratados à parte." },
  { q: "Sou autônomo (CPF). Posso usar?", a: "Fazemos uma pré-qualificação. A emissão por CPF depende das regras do seu município e da sua habilitação, por isso não prometemos emissão automática sem essa verificação." },
  { q: "Vendo produtos. Vocês emitem NF-e ou NFC-e?", a: "Ainda não. O serviço é de NFS-e (serviços). Para venda de produtos, deixe seu contato e a equipe comercial orienta." },
  { q: "E se eu emitir mais notas do que a franquia?", a: "Você é avisado ao chegar em 80% e em 100% da franquia. Nota além da franquia só com a sua autorização e dentro do limite que você definir." },
  { q: "Quanto tempo leva para emitir?", a: "O serviço ainda está em preparação. Os prazos serão informados na contratação, conforme o plano." },
  { q: "Tem gente de verdade acompanhando?", a: "Sim. O contador da WJB supervisiona as regras fiscais e o suporte é feito pela equipe." },
];

/** Landing da emissão de notas (Fase 8). Sem preços: os valores ainda são rascunho. */
export default function EmissaoDeNotasPage() {
  if (!isCommercialEnabled()) notFound();
  const whatsapp = getWhatsAppLink("Olá! Vim pela página de emissão de notas da WJB e quero saber mais.");
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
          <a href="#lista" className={buttonVariants({ variant: "cta" })}>Quero emitir notas</a>
          <Link href="/planos" className={buttonVariants({ variant: "outline" })}>Contratar com contabilidade</Link>
          {whatsapp ? (
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" data-analytics-location="emissao-de-notas" className={buttonVariants({ variant: "outline" })}>
              Solicitar proposta
            </a>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="como" className="mt-14">
        <h2 id="como" className="text-2xl font-bold tracking-tight">Como vai funcionar</h2>
        <p className="text-muted-foreground mt-1 text-sm">Demonstração ilustrativa do processo planejado.</p>
        <ol className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {["Você pede a nota pelo Portal ou pelo assistente", "Conferimos os dados e as regras do seu cadastro fiscal", "A nota é emitida pelo sistema nacional", "Você acompanha tudo e recebe o documento"].map((t, i) => (
            <li key={t} className="border-border min-w-0 rounded-md border p-4">
              <span className="text-primary text-sm font-semibold">Passo {i + 1}</span>
              <p className="mt-1 text-sm">{t}</p>
            </li>
          ))}
        </ol>
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
      </section>

      <section aria-labelledby="modalidades" className="mt-14">
        <h2 id="modalidades" className="text-2xl font-bold tracking-tight">Modalidades</h2>
        <p className="text-muted-foreground mt-1 text-sm">Os valores serão divulgados quando o serviço for liberado.</p>
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MODALIDADES.map((m) => (
            <li key={m.t} className="border-border min-w-0 rounded-md border p-4">
              <h3 className="font-semibold">{m.t}</h3>
              <p className="text-muted-foreground mt-1 text-sm">{m.d}</p>
            </li>
          ))}
        </ul>
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
      </section>

      <section id="lista" aria-labelledby="lista-titulo" className="border-border mt-14 max-w-3xl scroll-mt-24 rounded-md border p-5 sm:p-6">
        <h2 id="lista-titulo" className="text-2xl font-bold tracking-tight">Entre na lista de interesse</h2>
        <p className="text-muted-foreground mt-1 mb-4 text-sm">Sem compromisso e sem cobrança. Avisamos quando o serviço estiver liberado para o seu perfil.</p>
        <NfsePreRegistrationForm />
      </section>
    </Container>
  );
}
