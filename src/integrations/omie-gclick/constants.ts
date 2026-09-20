/**
 * URL real do login do Portal Visão do Cliente (Fase 6.5, confirmado via
 * documentação oficial - ajuda.omie.com.br, artigo "Omie.G-Click: como seu
 * cliente irá acessar o Portal Visão do Cliente"): é um endereço ÚNICO e
 * compartilhado entre todos os clientes de todas as contas G-Click - cada
 * pessoa entra com as próprias credenciais (usuário externo criado pela
 * WJB, senha enviada por e-mail pelo próprio G-Click), não uma URL
 * diferente por empresa. `external_portal_url` (`omie_client_mappings`)
 * continua existindo como override manual opcional - a documentação
 * também confirma que o portal aceita personalização visual, então um
 * domínio próprio branded não é impossível no futuro -, mas o CTA "Ver no
 * Portal Contábil" nunca precisa ficar sem link só porque staff não
 * preencheu esse campo.
 */
export const GCLICK_CLIENT_PORTAL_URL = "https://visao.gclick.com.br/login";
