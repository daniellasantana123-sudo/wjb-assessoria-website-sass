# Auditoria final e ajustes comerciais - WJB (2026-11-10)

Rodada de ajustes finais do site público, conforme `WJB_PROMPT_AJUSTES_FINAIS_COMERCIAIS_2026-11-10.md`. Sem redesign. Área do Cliente, Portal, Admin, autenticação, banco do SaaS e integração Omie/G-Click **não foram alterados** (nenhum arquivo dessas áreas aparece no commit).

Para não duplicar documentos, o prompt pediu 7 arquivos e eles foram consolidados:

| Pedido no prompt | Onde está |
| --- | --- |
| `AUDITORIA_FINAL_WJB.md`, `AJUSTES_COMERCIAIS_EXECUTADOS_WJB.md`, `CHECKLIST_CONVERSAO_E_FORMULARIOS_WJB.md`, `SEO_VALIDACAO_FINAL_WJB.md`, `RELATORIO_FINAL_WJB.md` | Este arquivo |
| `TRACKING_GA4_GTM_PREPARACAO_WJB.md` | Já existiam: `PLANO_TRACKING_GA4_GTM_WJB.md`, `CONTRATO_EVENTOS_DATALAYER_WJB.md`, `CHECKLIST_GOOGLE_ADS_READY.md` |
| `PENDENCIAS_APROVACAO_WJB.md` | Criado |

## 1. Inventário

| Item | Existe? | Funciona? | Evidência | Ajuste | Prioridade |
| --- | --- | --- | --- | --- | --- |
| Formulário Solicitar proposta | Sim | Sim | Teste: clique duplo = 1 envio; sucesso só com resposta do servidor; `generate_lead` único e sem dado pessoal | Nenhum | P0 |
| Formulário Contato | Sim | Sim | Teste em celular: falha da API mantém os dados, mostra WhatsApp/e-mail, sem `generate_lead` | Campos opcionais passaram a dizer "(opcional)" | P0 |
| Formulários das páginas de serviço | Sim (11) | Sim | Serviço pré-preenchido; envio vazio bloqueado com 4 alertas | CNPJ escondido em Abrir Empresa | P0 |
| Popup "Antes de sair" | Sim | Sim | Teste E2E existente | Nenhum | P0 |
| Newsletter | Sim | Sim | Separada dos leads (`formContext: "Newsletter"`) | Evento renomeado para `sign_up` (recomendado do GA4) | P1 |
| Anti-spam | Sim | Sim | Campo-armadilha + rate limit + dedup por `submissionId` | Nenhum | P0 |
| Gravação do lead e aviso por e-mail | Sim | **Não testado nesta rodada** | Supabase reativado (DNS responde); envio real não feito para não gerar lead e e-mail sem autorização | Ver pendências | P0 |
| Assistente Dani | Sim | Sim | `assistant.spec.ts` e `assistant-buttons.spec.ts` passando | CNPJ escondido no formulário dela | P1 |
| WhatsApp | Sim, 2 números | Sim | Todos os CTAs usam o 1º número de `siteConfig.contact.phones` | Ver pendências | P1 |
| Foto da equipe em /sobre | Placeholder com "FOTO PENDENTE" escrito | - | Imagem pública | Trocado por iniciais sobre fundo da marca; `alt` sem "pendente" | P0 |
| Depoimentos | 8, com aviso "Depoimentos ilustrativos" | - | `testimonials.tsx` | Mantidos por decisão da WJB em 2026-11-09; ver pendências | P0 |
| CRC no site | Não exibido | - | Decisão da WJB em 2026-11-09; número está só no JSON-LD | Ver pendências | P0 |
| GTM + Consent Mode | Sim (GTM-TZKJ7CS8) | Sim | Teste: nada vai ao Google antes do aceite; revogação manda "negado" | Nenhum | P1 |
| robots.txt / sitemap.xml | Sim | Sim | Produção: ambos 200; sitemap com 47 URLs | Nenhum | P1 |

## 2. Ajustes executados

| Página/Componente | Antes | Depois | Teste | Resultado |
| --- | --- | --- | --- | --- |
| `/servicos/abrir-empresa` | "O que inclui": Abertura, CNAE, Endereço, Registro, Inscrições | 6 itens com título e explicação + ressalva sobre taxas públicas, certificado e licenças | Playwright | OK |
| `/servicos/trocar-de-contador` | Diagnóstico inicial, Transição conduzida pela WJB, Onboarding; intro "sem interrupção" | 5 itens concretos + ressalva sobre data e pendências; intro "obrigações em dia durante a transição" | Playwright | OK |
| Planejamento, Reforma, Certidões, Recuperação, Legalização | Listas de 1 a 3 rótulos ("Planejamento", "Baixa") | Itens com título e explicação; ressalvas sem garantia | Build + SEO | OK |
| Contabilidade completa, Fiscal, DP, Consultoria | Checklists de entregas concretas | Mantidos (já eram específicos) | - | - |
| Home "Escolha o que você precisa" e "Como funciona", card de DP | "sem burocracia para você", "sem dor de cabeça" | Texto preciso, sem promessa absoluta | Testes E2E | OK |
| `/sobre` equipe | Imagem "FOTO PENDENTE" | Iniciais DS / DB | Playwright | OK |
| Formulário (todos) | CNPJ sempre visível | `showCnpj`: oculto em Abrir Empresa e na Dani | Playwright | OK |
| `/contato` | Cidade, Estado, Ramo sem indicação | "(opcional)" | Playwright | OK |
| Metadados | 8 títulos/descrições fora do tamanho; planos com marca duplicada no título | Corrigidos; `seoDescription` em Fiscal e Legalização (sem citar Lucro Real, que não está confirmado) | Varredura das 47 URLs | 0 problemas |
| Newsletter | Evento `newsletter_signup` | `sign_up` com `method: newsletter` | Unit | OK |

## 3. Validação de SEO (build de produção local + produção)

- 47 URLs do sitemap: todas 200, title e description únicos e dentro do tamanho, 1 H1, canonical correto, nenhum `noindex`, nenhuma `<img>` sem `alt`.
- Produção: `robots.txt` 200 (`Allow: /`, aponta o sitemap); `sitemap.xml` 200, `application/xml`, 47 URLs.
- Dados estruturados: `AccountingService` com endereço, telefone e horário; `Service` por serviço; `BreadcrumbList`; `Article`. Sem avaliação nem `FAQPage`.
- Core Web Vitals de campo: não disponíveis daqui (o CDN da Hostinger bloqueia ferramentas automáticas). Medição de laboratório em `SEO_AUDIT_WJB.md`.

## 4. Testes executados

- Lint, TypeScript, 348 testes unitários, build: OK.
- Playwright completo (computador + celular): 92 passaram, 24 pulados (exigem login real), 0 falhas.
- 14 verificações específicas desta rodada (formulários, clique duplo, falha da API, eventos, páginas alteradas): todas OK.

## 5. Risco residual

- Depoimentos fictícios, ainda que com aviso, podem ser entendidos como prova social. Ver pendências.
- A gravação real do lead depende do Supabase, que pausa no plano gratuito.
- O GTM está publicado, mas as tags do GA4 ainda não foram publicadas no contêiner.
