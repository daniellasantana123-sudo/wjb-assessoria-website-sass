# 41 - Fase 9: registro da aprovação dos preços

**Aprovação:** o responsável pela WJB aprovou em **21/11/2026**, no documento `WJB_AI_FASE_8_DECISOES_FASE_9_WHATSAPP_CLICK_TO_CHAT.md` e na mensagem que o acompanhou, os planos, as mensalidades, as franquias, os valores das notas adicionais e o desconto do combo.

**O que a aprovação NÃO libera:** checkout, débito, assinatura cobrada, publicação na produção nem a promessa de emissão automática já disponível. Gateway de pagamento, contratos jurídicos, tributação do serviço e lançamento são decisões posteriores e separadas.

## 1. Política comercial aprovada (referência)
| SKU | Plano | Mensalidade | Franquia por ciclo | Nota adicional |
| --- | --- | ---: | ---: | ---: |
| `nfse_avulsa` | Nota Avulsa | R$ 0,00 | 0 | R$ 4,90 por nota autorizada |
| `nfse_mei` | MEI Digital | R$ 24,90 | 10 | R$ 3,90 |
| `nfse_profissional` | Profissional | R$ 69,90 | 50 | R$ 2,50 |
| `nfse_empresa` | Empresa | R$ 149,90 | 150 | R$ 1,50 |
| `nfse_volume` | Alto Volume | Sob proposta | Contratual | Contratual |

- **Combo** (contabilidade completa + emissão): 20% de desconto **somente** sobre a mensalidade do plano de notas. Não vale para os honorários de contabilidade, para a Nota Avulsa nem para as notas adicionais, e não se soma a outros descontos.
- **Três caminhos:** (A) contabilidade completa, (B) só a emissão, (A+B) combo. O MEI Digital é uma opção dentro do produto de emissão.

A tabela acima é o registro da decisão. **O sistema não lê esses números daqui nem do código:** eles ficam no catálogo do banco, editáveis no Admin.

## 2. Como ficou no sistema
| Requisito | Implementação |
| --- | --- |
| Configurável no Admin, sem preço fixo no código | `/admin/comercial` edita o catálogo `commercial_plans`. Landing, Portal e Dani leem do banco (`listCatalog("approved")`, `/api/commercial/catalog`) |
| Versionamento e histórico de vigência | migration **0032**: status `approved`, com `approval_reference`, `effective_from`, `approved_at` e `approved_by` (estes dois gravados pelo banco). Cada versão vai para `commercial_plan_changes` com a vigência. O Admin mostra "Histórico de versões" por plano |
| Mudança de preço exige nova aprovação | o gatilho devolve a rascunho o plano aprovado cujo preço mudou (T97) |
| Só super admin aprova | RLS (T100, S13). O contador só lê |
| Histórico do desconto do combo | `commercial_setting_changes` (T99, mostrado no Admin) |
| Cliente e visitante só veem plano aprovado | filtro `status = 'approved'` no servidor. O teste E2E cria um rascunho e confirma que ele não aparece no catálogo público |
| Franquia por empresa; nota simulada nunca é faturável; um consumo por pedido | já garantidos pelo banco desde a 0030 (T86, T87) |
| Nada de cobrança surpresa | avisos em 80% e 100% da franquia. A nota adicional depende de autorização e de limite de gasto (`canConsume`) |
| Nota Avulsa com franquia 0 | `isPerNotePlan`: cobra por nota, sem "excedente" nem alerta de franquia |

## 3. Na homologação
`node scripts/wjb-ai/homologacao-supabase/05-comercial-catalogo.mjs` grava os valores aprovados e registra a aprovação com o super admin fictício. Referência gravada: "Aprovado pelo responsável pela WJB em 21/11/2026 (decisões da Fase 8)"; vigência a partir de 21/11/2026. Os 5 planos estão `approved`. A produção não foi tocada.

## 4. Ainda dependem de decisão da WJB
1. Texto final dos termos do serviço, da política de privacidade aplicada à emissão e da autorização de representação fiscal (revisão jurídica). Os aceites continuam com a versão "rascunho". Só o aceite de preço passou a apontar para a versão aprovada.
2. Meio de pagamento (gateway), contrato e tributação do serviço.
3. Data de lançamento e publicação na produção.
