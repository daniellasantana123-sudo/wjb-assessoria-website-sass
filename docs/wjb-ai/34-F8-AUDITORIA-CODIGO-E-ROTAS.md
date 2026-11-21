# 34 - Fase 8: auditoria de código e rotas

**Data:** 21/11/2026 · Branch `wjb-ai/f2-solicitar-nfse` · Só homologação.

## 1. Rotas novas e como ficam com os interruptores desligados
| Rota | Tipo | Exige | Com interruptor desligado |
| --- | --- | --- | --- |
| `/emissao-de-notas` | site público, dinâmica | `WJB_COMMERCIAL_ENABLED` | 404 |
| `/portal/plano` | Portal (login) | `WJB_COMMERCIAL_ENABLED` | 404; o item some do menu |
| `/admin/comercial` | Admin (equipe; edita só super admin) | `WJB_COMMERCIAL_ENABLED` | 404; o item some do menu |
| `/admin/whatsapp` | Admin (equipe) | `WJB_COMMERCIAL_ENABLED` | 404; o item some do menu |
| `POST/GET /api/wjb-ai/whatsapp/webhook` | API | `WJB_COMMERCIAL_ENABLED` e `WJB_WHATSAPP_MOCK_ENABLED` | 404 |
| seção "Emissão de notas" em `/planos` | site público | `WJB_COMMERCIAL_ENABLED` | não aparece (o resto da página é igual) |

A produção não tem nenhum desses interruptores ligados. Por isso, mesmo que este código chegasse à `main`, o site público e a plataforma ficariam como estão hoje.

## 2. Arquivos existentes alterados (só acréscimos)
| Arquivo | Mudança | Risco |
| --- | --- | --- |
| `src/lib/validation/lead.ts` | telefone opcional **só** no contexto "Emissão de notas - pré-cadastro". Os demais formulários continuam exigindo WhatsApp (teste unitário) | baixo |
| `src/lib/marketing/exit-intent.ts` | o popup de saída não abre em `/emissao-de-notas` (a página já tem formulário) | baixo |
| `src/app/(site)/planos/page.tsx` | seção da emissão atrás do interruptor | baixo |
| `src/config/portal-nav.ts`, `admin-nav.ts`, layouts do Portal e do Admin | itens de menu condicionados a `feature` | baixo |
| `src/actions/wjb-ai-fiscal.ts` | bloqueio por plano só com `WJB_COMMERCIAL_ENTITLEMENTS_ENFORCED` | baixo (desligado) |
| `src/lib/wjb-ai/fiscal/queue.repo.ts` | grava o consumo **simulado, não faturável** quando a fila simulada autoriza. Falha nessa gravação nunca derruba a fila (try/catch) | baixo |
| `src/lib/audit-labels.ts`, `src/types/database.ts` | rótulos e tipos novos | nenhum |

**Omie/G-Click: nenhum arquivo alterado.** `git diff` não toca `src/integrations/gclick`, `src/lib/integrations` nem as ações do G-Click.

## 3. Acessibilidade e responsivo (correções em código existente)
| Achado | Correção |
| --- | --- |
| Verde de sucesso (`#43a36b`) usado como texto pequeno: contraste 2,93:1 sobre `#f7f7f8` (o mínimo é 4,5:1) | os 4 textos passaram a usar `text-success-text` (`#265e3e`). O ícone do Hero manteve o verde (ícone pede 3:1, e o contraste dele é 3,1:1 sobre branco) |
| Manual `/ajuda`: laranja `#f06a00` (3,1:1) e cinza `#6b7686` (3,56:1 sobre `#dde3ec`) | `#a84800` e `#59636f` (tema claro), manual regenerado com `node scripts/build-manual.mjs` |
| Tabelas com rolagem horizontal fora do alcance do teclado (axe `scrollable-region-focusable`) | `tabIndex={0}`, `role="region"` e `aria-label` em 5 contêineres: margem em `/admin/comercial`, diferença de versões em `/admin/nfse/[id]`, Portal (visão geral e relatórios) e tabelas de artigos do blog |

## 4. Segurança
| Verificação | Resultado |
| --- | --- |
| Preço vindo do navegador | não é aceito: o servidor relê o catálogo |
| Contratação por quem não é responsável da empresa | recusada no servidor |
| Empresa vinda da URL ou do formulário | nunca: sempre da sessão (`getActiveTenant`) |
| Escrita direta no banco pelo usuário logado (assinatura, consumo, aceites) | sem política de escrita (T82) |
| `has_entitlement` consultável por usuário logado para outra empresa | **corrigido na 0031** (doc 38) |
| Webhook sem assinatura ou com assinatura errada | 401 (E2E) |
| Telefone em log ou resposta do webhook | mascarado (`***` + 4 dígitos) |
| Dados pessoais na evidência `responsivo.json` | nenhum: só rotas, tamanhos de tela e contagens |
| Segredos no Git | varredura antes do commit (doc 39) |

## 5. Falhas de UX corrigidas durante a fase
- **A mensagem de confirmação sumia depois de contratar:** o formulário é desmontado quando a página revalida. Agora a ação redireciona com `?contratado=1` ou `?cancelado=1`, e a página mostra um aviso (`role="status"`).
- **Gatilho de histórico de preço** violava a chave estrangeira: veja o doc 38, seção 5.
