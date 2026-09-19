/**
 * Dados institucionais oficiais da WJB (fornecidos pelo usuário em 2026-08-30,
 * WJB_Conteudos_Incompletos_Implementacao_Claude.md; CRC e responsável
 * técnica fornecidos em 2026-08-30, mesmo dia). Fonte única — nenhum outro
 * arquivo deve duplicar CNPJ, endereço, e-mail, WhatsApp ou CRC.
 *
 * CRC formatado como "1SP273713/O-5" (padrão nacional
 * UF+número+/categoria-dígito) a partir do que o usuário informou sem
 * pontuação ("1SP273713O5") — confirmar se a pontuação exata bate com o
 * registro oficial do CRC-SP.
 */
export const siteConfig = {
  name: "WJB Assessoria Contábil",
  company: {
    name: "WJB Assessoria Contábil",
    cnpj: "33.152.193/0001-55",
    website: "https://wjbassessoriacontabil.com.br",
    crc: "1SP273713/O-5",
    responsibleAccountant: "Daniella Santana",
  },
  contact: {
    email: "contato@wjbassessoriacontabil.com.br",
    phones: [
      {
        label: "WhatsApp 1",
        display: "(11) 9 7614-6375",
        e164: "5511976146375",
        href: "https://wa.me/5511976146375",
      },
      {
        label: "WhatsApp 2",
        display: "(11) 9 7685-4842",
        e164: "5511976854842",
        href: "https://wa.me/5511976854842",
      },
    ],
  },
  address: {
    street: "Av. Engenheiro Luís Carlos Berrini, 1140",
    complement: "Conj. 72/211E",
    district: "Brooklin",
    city: "São Paulo",
    state: "SP",
    zipCode: "04571-930",
    country: "Brasil",
    full: "Av. Engenheiro Luís Carlos Berrini, 1140 - Conj. 72/211E - Brooklin, São Paulo - SP, 04571-930",
  },
  partners: {
    armelx: {
      name: "Armel-x Tecnologia",
      website: "https://armelx.com/",
      whatsapp: {
        label: "WhatsApp Armel-x",
        display: "(11) 9 8853-9058",
        e164: "5511988539058",
        href: "https://wa.me/5511988539058",
      },
    },
  },
  /**
   * WJB_Depoimentos_Carrossel_Fotos_Footer_Claude_FINAL.md, seção 10 —
   * deliberadamente vazio até a WJB fornecer os links oficiais (nunca
   * inventar URL). Os ícones do footer só viram link real quando um valor
   * aqui for preenchido (ver src/components/layout/site-footer.tsx).
   */
  social: {
    facebook: "https://www.facebook.com/share/1Cuo2h98sc/?mibextid=wwXIfr",
    instagram: "",
  },
};

/** Link do Google Maps a partir do endereço completo — usado em footer e /contato. */
export function getAddressMapUrl() {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(siteConfig.address.full)}`;
}

/**
 * URL do mapa embutido (Google Maps Embed API, modo "place" — mesmo card
 * com nome/endereço que aparece ao pesquisar um local no Google Maps).
 * Requer NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (ver .env.example); chave ainda
 * não confirmada nesta sessão, então retorna null até ser configurada —
 * quem renderiza deve tratar esse caso (ver /contato).
 */
export function getAddressEmbedMapUrl() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;
  return `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodeURIComponent(siteConfig.address.full)}`;
}
