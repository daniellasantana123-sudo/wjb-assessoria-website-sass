import { getWhatsAppLink } from "@/integrations/whatsapp";

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
 * SAAS V2 (Portal/Admin/Login) ainda não publicado no domínio real — ver
 * `src/middleware.ts`. Mesma env var esconde o link "Entrar na Plataforma"
 * daqui, pra nunca ter um item de menu apontando pra uma rota bloqueada.
 */
const saasPublicEnabled = process.env.NEXT_PUBLIC_SAAS_PUBLIC_ENABLED === "true";

export const clientAreaNav: NavItem & { children: NavItem[] } = {
  label: "Área do Cliente",
  href: "/area-do-cliente",
  children: [
    ...(saasPublicEnabled ? [{ label: "Entrar na Plataforma", href: "/login" }] : []),
    { label: "Acompanhar abertura", href: "/area-do-cliente" },
    { label: "Central de documentos", href: "/area-do-cliente" },
    { label: "Suporte", href: "/area-do-cliente" },
  ],
};

/**
 * "Falar com contador" abre o WhatsApp direto (WJB_Conteudos_Incompletos...md,
 * seção 3 — CTA secundário) — link externo, então quem renderiza deve
 * adicionar target="_blank" rel="noopener noreferrer".
 */
export const headerCtas = {
  talkToAccountant: { label: "Falar com contador", href: getWhatsAppLink()! },
  requestProposal: { label: "Solicitar proposta", href: "/solicitar-proposta" },
};
