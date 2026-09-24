import { getWhatsAppLink } from "@/integrations/whatsapp";
import { isSaasPublicEnabled } from "@/lib/saas-gate";

export interface NavItem {
  label: string;
  href: string;
}

export interface NavDropdownGroup {
  label: string;
  items: NavItem[];
  footer?: NavItem;
}

/**
 * Header desktop — seção 11 de Wjb-Website.md, reorganizado em 2026-08-30
 * (a pedido do usuário) em menos itens de topo com submenu, pra reduzir
 * poluição visual. Nenhuma página foi removida, só reagrupada.
 */
export const solucoesDropdown: NavDropdownGroup = {
  label: "Soluções",
  items: [
    { label: "Contabilidade Digital", href: "/contabilidade-digital" },
    { label: "Armel-x Tecnologia", href: "/armel-x-tecnologia" },
  ],
  footer: { label: "Ver todas as soluções", href: "/solucoes" },
};

export const empresaDropdown: NavDropdownGroup = {
  label: "Empresa",
  items: [
    { label: "Sobre", href: "/sobre" },
    { label: "Como funciona", href: "/como-funciona" },
    { label: "Conteúdos", href: "/conteudos" },
    { label: "Dúvidas", href: "/duvidas" },
  ],
};

export const mainNavLinks: NavItem[] = [
  { label: "Planos", href: "/planos" },
  { label: "Contato", href: "/contato" },
];

/**
 * SAAS V2 (Portal/Admin/Login) publicado em 2026-09-23. A env var do gate
 * continua existindo como interruptor (ver `src/proxy.ts`, que devolve 404
 * nessas rotas quando desligada) - e é ela que esconde o link "Entrar na
 * Plataforma" daqui, pra nunca ter item de menu apontando pra rota
 * bloqueada.
 */
/**
 * Função, não constante (2026-09-23): o item "Entrar na Plataforma"
 * depende de uma env var lida em **tempo de execução** (ver
 * `@/lib/saas-gate`). Como constante de módulo, o valor seria congelado no
 * build - e na Hostinger o build não recebe as variáveis do painel, então
 * o link nunca apareceria por mais que a flag fosse ligada.
 *
 * Só deve ser chamada em Server Component; quem renderiza no cliente
 * (`MobileNav`) recebe o resultado por prop.
 */
export function getClientAreaNav(): NavItem & { children: NavItem[] } {
  return {
    label: "Área do Cliente",
    href: "/area-do-cliente",
    children: [
      ...(isSaasPublicEnabled()
        ? [{ label: "Entrar na Plataforma", href: "/login" }]
        : []),
      /*
       * 2026-09-23: os 3 itens anteriores ("Acompanhar abertura", "Central
       * de documentos", "Suporte") apontavam todos pro mesmo
       * `/area-do-cliente` - três rótulos diferentes pro mesmo destino, o
       * que promete navegação que não existe. Trocados por um item só, com
       * destino real. Deliberadamente NÃO aponto pras rotas internas do
       * Portal (`/portal/documentos` etc.): quem vê este menu é, na maior
       * parte, visitante deslogado, que seria jogado direto numa tela de
       * login sem contexto nenhum.
       */
      { label: "Conhecer a plataforma", href: "/area-do-cliente" },
    ],
  };
}

/**
 * "Falar com contador" abre o WhatsApp direto (WJB_Conteudos_Incompletos...md,
 * seção 3 — CTA secundário) — link externo, então quem renderiza deve
 * adicionar target="_blank" rel="noopener noreferrer".
 */
export const headerCtas = {
  talkToAccountant: { label: "Falar com contador", href: getWhatsAppLink()! },
  requestProposal: { label: "Solicitar proposta", href: "/solicitar-proposta" },
};
