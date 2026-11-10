# Auditoria comercial - WJB Assessoria Contábil

**Fase 0 do plano comercial (SEO, CRO, captação e preparação para Google Ads)**
Data: 09/11/2026 · Base: repositório `main` e site publicado em https://wjbassessoriacontabil.com.br

Legenda usada em todo o documento:
- **[Verificado]** conferido no código ou no site publicado nesta data.
- **[Hipótese]** provável, mas não confirmado.
- **[Recomendação]** proposta, ainda não implementada.

---

## 1. Alerta antes de tudo

**[Verificado] O banco de dados (Supabase) está pausado de novo.** O endereço do projeto não existe na internet (`NXDOMAIN`), o mesmo sintoma de 29/09 e 15/10. Enquanto ele estiver pausado:

- os contatos dos formulários não são gravados (o aviso por e-mail ainda sai, se o Resend estiver funcionando, e o visitante é levado ao WhatsApp);
- ninguém entra no Portal nem no Admin;
- o lembrete diário de obrigações falha.

Nenhuma medição de conversão faz sentido enquanto o lugar onde o lead é gravado cai a cada 2 semanas. **Pré-requisito de todo o plano: reativar o projeto e assinar o plano Pro do Supabase (a partir de US$ 25/mês), que não pausa.**

---

## 2. Inventário técnico

| Área | Situação | Onde |
|---|---|---|
| Framework | [Verificado] Next.js 16 (App Router), TypeScript, Tailwind v4, hospedado na Hostinger com deploy por `git push` | `package.json`, `next.config.mjs` |
| Design | [Verificado] Tokens azul/laranja, fonte Inter/Noto, cantos de **6 px**, Design System documentado | `src/app/globals.css`, `docs/design/design-system.md` |
| Páginas | [Verificado] 47 públicas: Home, 11 serviços, 3 planos, 16 posts, institucionais e jurídicas | `src/app/(site)`, `src/app/sitemap.ts` |
| Formulários | [Verificado] `LeadForm` único, reaproveitado em Contato, Solicitar proposta, Abrir Empresa e Trocar de Contador; newsletter; popup "Antes de sair"; formulário da Dani. Validação Zod no cliente e no servidor | `src/components/forms/lead-form.tsx`, `src/lib/validation/lead.ts` |
| API de leads | [Verificado] `POST /api/leads`, grava em `public.leads`, envia e-mail pelo Resend, limite de 5 envios por minuto por IP (em memória) | `src/app/api/leads/route.ts` |
| Tabela de leads | [Verificado] guarda serviço, página de origem, `utm_source/medium/campaign` e status com 4 valores: novo, contatado, ganho, perdido | `supabase/migrations/0010_leads_table.sql` |
| Gestão de leads | [Verificado] tela `/admin/leads` com troca de status | `src/app/admin/leads`, `src/actions/leads.ts` |
| WhatsApp e Dani | [Verificado] assistente determinístico (sem IA), menu de serviços, formulário curto e WhatsApp com mensagem contextual; link direto `/dani` | `src/components/assistant/`, `src/lib/assistant/` |
| Área do Cliente | [Verificado] Portal e Admin com login, RLS no banco, integração Omie/G-Click ativa | `src/app/portal`, `src/app/admin`, `src/integrations/omie-gclick` |
| Planos | [Verificado] 3 planos sem preço exibido (decisão de 21/09); preços aprovados guardados no código, não exibidos; simulador removido | `src/config/plans.ts` |
| Cookies | [Verificado] banner com "Aceitar todos" e "Rejeitar não essenciais", sem "Configurar" (não havia o que configurar) | `src/components/shared/cookie-consent-banner.tsx` |
| Analytics | [Verificado] **nenhum** GA4, GTM ou pixel instalado. Existe um carregador vazio que só agiria com `NEXT_PUBLIC_ANALYTICS_ID` e consentimento | `src/lib/analytics/loader.tsx` |
| Eventos | [Verificado] só os eventos da Dani, e eles não enviam nada (função vazia) | `src/lib/analytics/assistant-events.ts` |
| Testes | [Verificado] 336 testes unitários, suíte E2E em Playwright, CI no GitHub | `src/tests`, `.github/workflows` |
| Monitoramento e rollback | [Verificado] sem monitoramento de erros. Rollback = reverter o commit e fazer push (a Hostinger publica sozinha) | - |

---

## 3. Auditoria de conversão

### 3.1 O que já funciona bem
- [Verificado] CTA "Falar com contador" e "Solicitar proposta" no cabeçalho de todas as páginas.
- [Verificado] Formulários acessíveis (todos os campos com rótulo, erro anunciado, foco no primeiro campo com erro), testados em 30/09 e 14/10.
- [Verificado] Os formulários de Abrir Empresa e Trocar de Contador já chegam com o serviço preenchido.
- [Verificado] Quando a gravação falha, o visitante ainda é levado ao WhatsApp em vez de ficar num beco sem saída.

### 3.2 Lacunas por página

| Página | Lacuna | Prioridade |
|---|---|---|
| Home | O título fala de "entender os números", não diz o que a WJB faz nem para quem. Quem chega de um anúncio precisa ler mais para saber se está no lugar certo | Alta |
| Serviços (11) | **Conteúdo raso.** Cada página lista de 3 a 5 palavras soltas ("Abertura", "CNAE", "Registro"), sem passo a passo, documentos, perfil indicado nem FAQ. Para o Google e para o visitante, isso pesa contra | **Alta** |
| Serviços (9 de 11) | Sem formulário na própria página; o visitante precisa ir para outra tela | Alta |
| Trocar de Contador / Abrir Empresa | Melhores páginas do site, mas sem as objeções típicas respondidas ("como fica minha empresa durante a troca?", "quanto tempo leva?") | Alta |
| Planos | Sem preço (decisão da WJB) e sem dizer o que define o valor; o visitante não sabe o próximo passo além do WhatsApp | Média |
| Depoimentos | Os 8 depoimentos são fictícios. Aviso discreto existe, mas em publicidade contábil isso é risco (ver seção 6) | **Alta** |
| Sobre | Fotos da equipe ainda são cartões de "foto pendente" | Média |

### 3.3 Formulário
- [Verificado] O `LeadForm` pede **11 campos** em `/contato` (nome, e-mail, WhatsApp, empresa, CNPJ, cidade, estado, atividade, assunto, mensagem, consentimento). Para um primeiro contato é muito: o plano pede 4 obrigatórios e o resto progressivo.
- [Verificado] Não há proteção contra robôs além do limite por IP (sem campo-armadilha nem verificação).
- [Verificado] Não há identificador de envio, então um clique duplo ou uma nova tentativa grava o mesmo lead duas vezes.
- [Verificado] O identificador do lead criado não volta para o navegador, o que impede deduplicar um futuro evento de conversão.

---

## 4. SEO e performance

| Item | Situação |
|---|---|
| Indexação | [Verificado] 45 páginas indexadas (eram 34 em 06/10). Restam 31 não indexadas: 16 na fila do Google, 7 redirecionamentos esperados, o resto em validação |
| Metadados | [Verificado] títulos e descrições únicos, canônicas em todas as páginas, títulos curtos nos posts (corrigido em 14/10) |
| Sitemap e robots | [Verificado] 47 URLs, lido pelo Google em 08/11. Robots permite tudo. Restos do WordPress respondem 410 |
| Dados estruturados | [Verificado] `AccountingService`, `BreadcrumbList`, `Article`, `OfferCatalog`. **Sem** `FAQPage` e sem horário de atendimento (não confirmado) |
| Performance (PageSpeed 14/10) | [Verificado] celular 74, computador 93. **LCP no celular de 5,9 s** (meta: 2,5 s): a 1ª foto do carrossel baixa rápido, mas só aparece quase 2 s depois. O HTML da Home tem 438 KB |
| Acessibilidade e SEO (PageSpeed) | [Verificado] 100 e 100 |
| CDN da Hostinger | [Verificado] voltou a ficar ativo; a proteção anti-robô bloqueou um arquivo no teste do PageSpeed e derrubou a Home na tela de erro. Precisa ser desligada pela WJB |
| SEO local | [Hipótese] Perfil da Empresa no Google não verificado nesta auditoria. Endereço e telefone do site batem com o cadastro do código |
| Conteúdo | [Verificado] 16 artigos, sem fontes oficiais citadas por link e sem responsável técnico identificado no post |

---

## 5. Conflitos entre o plano e decisões já registradas

Precisam de uma decisão da WJB antes da Fase 2:

1. **Cantos de 8 px** (plano) x **6 px** (regra do projeto, `Wjb-Website.md` seção 7). Recomendação: manter 6 px.
2. **Título do Hero.** O plano propõe "Contabilidade especializada para sua empresa crescer com segurança". O atual foi escolhido e ajustado pela WJB em agosto. Recomendação: trocar, porque o atual não diz o serviço; aguardo aprovação do texto.
3. **"Configurar preferências" de cookies.** Foi deixado de fora de propósito porque não havia analytics. Com GA4/GTM passa a ser necessário e será implementado na Fase 6.
4. **Status de leads**: o banco tem 4 (novo, contatado, ganho, perdido); o plano pede 7. Exige migration nova no Supabase (aplicada pelo SQL Editor).
5. **Depoimentos fictícios**: o plano proíbe; hoje existem com aviso discreto. Recomendação: retirar a seção até haver depoimentos reais autorizados.

---

## 6. Responsabilidade profissional (CFC/CRCSP)

- [Verificado] CNPJ e endereço no rodapé e no JSON-LD. Razão social exibida como "WJB Assessoria Contábil".
- [Verificado] O número do CRC foi retirado do texto visível em 31/08 a pedido da WJB (continua no JSON-LD). **[Recomendação]** confirmar com a WJB, à luz das normas vigentes do CFC sobre publicidade, se o CRC da organização e do responsável técnico precisam aparecer no site. Não é uma decisão técnica.
- [Verificado] O CRC foi formatado como `1SP273713/O-5` a partir do número informado sem pontuação. Precisa de conferência no registro oficial.
- [Verificado] Depoimentos fictícios e fotos de banco de imagem: as fotos não afirmam ser a equipe; os depoimentos são o ponto de risco.

---

## 7. Plano de execução

| Fase | Entrega | Depende da WJB? | Prioridade |
|---|---|---|---|
| Pré-requisito | Supabase Pro e CDN da Hostinger sem proteção anti-robô | **Sim** | Bloqueante |
| 1 | `PLANO_CRO_WJB.md` e `ARQUITETURA_LANDING_PAGES_WJB.md`: jornada, CTAs, conversões e textos | Aprovação dos textos | Alta |
| 2 | Home: novo Hero, "Encontre sua solução", "Por que a WJB" e FAQ comercial | Aprovar título e decidir depoimentos | Alta |
| 3 | Páginas de serviço completas, começando por Trocar de Contador, Abrir Empresa e Contabilidade Completa: passo a passo, documentos, perfil, FAQ e formulário na própria página | **Validar o conteúdo técnico** (processo, documentos, prazos) | Alta |
| 4 | Formulário curto (4 campos) com etapa opcional; campo-armadilha anti-robô; identificador de envio contra duplicidade; status de lead em 7 etapas; `gclid` e UTMs completas | Migration no Supabase | Alta |
| 5 | LCP do celular, `FAQPage` onde houver FAQ visível, fontes e revisão técnica nos posts | Responsável técnico dos posts | Média |
| 6 | Camada de eventos (`dataLayer`), Consent Mode v2, botão "Configurar cookies", documentação de GA4/GTM | IDs reais de GTM/GA4 (**não serão inventados**) | Média |
| 7 | Testes de regressão (Portal, Admin, G-Click), acessibilidade, celular e eventos | - | Alta |
| 8 | Checklist "pronto para Google Ads" e plano de rollback | Aprovação final | - |

### Informações que só a WJB pode dar
1. Catálogo confirmado de serviços (em especial Recuperação Tributária, Baixa de empresa e Alteração contratual).
2. Processo real, documentos e prazos de Abrir Empresa e Trocar de Contador.
3. Horário de atendimento.
4. Depoimentos reais com autorização, ou a decisão de retirar a seção.
5. Fotos reais da equipe.
6. Exigências de CRC na publicidade.
7. IDs de GTM, GA4 e Google Ads, quando a conta existir.

### Riscos
- Banco pausando derruba captação e medição ao mesmo tempo.
- Medir conversão no clique do WhatsApp superestima resultados: o plano trata clique como interação, não como lead.
- Mexer no `LeadForm` afeta 4 páginas, a Dani e o popup de uma vez; exige teste de regressão.
- A migration de status de lead precisa preservar os leads atuais (mapear "contatado" para "em atendimento").
