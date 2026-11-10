# Arquitetura das landing pages - WJB

**Fase 3 do plano comercial** · 09/11/2026

As páginas de serviço existentes (`/servicos/[slug]`) passaram a ser as landing pages das campanhas, em vez de criar URLs novas. Conteúdo em `src/config/service-details.ts`; estrutura em `src/app/(site)/servicos/[slug]/page.tsx`.

## Estrutura de cada página
1. Categoria, H1 com o nome do serviço e parágrafo de abertura.
2. Botão principal específico (leva ao formulário) e WhatsApp com mensagem do serviço.
3. Para quem é / O que inclui.
4. Como funciona (etapas numeradas).
5. O que ter em mãos (quando faz sentido).
6. Perguntas frequentes.
7. Formulário na própria página, com o serviço preenchido.
8. Outros serviços da mesma categoria.
9. JSON-LD `Service` e `BreadcrumbList`.

## Mapa campanha -> página
| Grupo de campanha | URL | Palavra-chave principal | CTA |
|---|---|---|---|
| Trocar de contador | `/servicos/trocar-de-contador` | trocar de contador | Solicitar proposta para troca |
| Abertura de empresa | `/servicos/abrir-empresa` | abrir empresa | Quero abrir minha empresa |
| Contabilidade empresarial | `/servicos/contabilidade-completa` | contabilidade para empresas | Solicitar proposta contábil |
| Regularização | `/servicos/certidoes-regularizacao` | regularizar empresa / CNPJ | Solicitar análise de regularização |
| Planejamento tributário | `/servicos/planejamento-tributario` | planejamento tributário | Solicitar diagnóstico tributário |
| Departamento Pessoal | `/servicos/departamento-pessoal` | departamento pessoal terceirizado | Solicitar proposta |

Usar UTMs em todos os anúncios (`utm_source=google&utm_medium=cpc&utm_campaign=<grupo>`). O site guarda a origem da primeira página da visita e a envia com o lead, mesmo que a pessoa navegue antes de preencher.

## Regras do conteúdo
- Sem prazos, preços, percentuais de economia ou garantias.
- Etapas e documentos descrevem o processo geral no Brasil, não números da WJB.

## Pendente de validação pela WJB antes de anunciar
- Revisar o texto técnico de cada página (`service-details.ts`), em especial documentos de abertura, transição de contador e recuperação tributária (citação de "cinco anos" segue o prazo geral do CTN).
