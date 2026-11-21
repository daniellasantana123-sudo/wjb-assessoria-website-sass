# 46 - Fase 9: relatório e desenho da Fase 10

**Data:** 21/11/2026 · Branch `wjb-ai/f2-solicitar-nfse`. Nada na `main`, nenhum deploy, produção (`wjb-website-app`) não acessada. Sem cobrança real, sem emissão fiscal, sem certificado, sem API fiscal oficial, sem WhatsApp Cloud API, sem IA externa, sem serviço novo contratado.

Trabalho feito por um único agente, em sequência (Tech Lead, Comercial, UX, Backend, Segurança, QA e Atendimento). Nenhum subagente paralelo foi usado.

## 1. Status por item
| Item | Status |
| --- | --- |
| Preços aprovados registrados, configuráveis no Admin, com versão e vigência (0032) | **Implementado e homologado** |
| Desconto do combo 20%, só na mensalidade, não cumulativo, com histórico | **Implementado e homologado** |
| Três caminhos (contabilidade, só emissão, combo) e MEI Digital | **Implementado e homologado** (landing, Portal, Dani) |
| Landing `/emissao-de-notas` com planos, aviso do emissor gratuito, elegibilidade, FAQ e pré-cadastro | **Implementado e homologado**; não publicada |
| Click-to-Chat com mensagens por intenção, sem dado sensível | **Implementado**; testado em navegador emulado. **Não testado** nos aplicativos |
| Remoção do webhook e do provedor simulados do WhatsApp | **Feito** (o caminho responde 404) |
| Dani comercial (determinística, sem IA) | **Implementado e homologado** |
| Assinaturas simuladas, troca, cancelamento, suspensão, franquia, nota adicional, auditoria | **Simulado e homologado** (Fase 8 com os preços aprovados) |
| IDOR e manipulação pelo navegador | **Homologado**: 14/14 pela API do banco |
| Revisão de responsividade e acessibilidade | **Homologado em emulação**; aparelhos reais e outros navegadores **pendentes** |
| Cobrança real, checkout, gateway | **Bloqueado** (decisão posterior) |
| Emissão fiscal oficial | **Bloqueado** (Fase 10) |
| Publicação na produção | **Bloqueado** (exige autorização específica) |

## 2. Testes (números desta execução)
| Bateria | Resultado |
| --- | --- |
| Unitários (Vitest) | **575 passando** (12 novos da Fase 9; os testes do WhatsApp simulado foram trocados pelos do Click-to-Chat) |
| TypeScript e lint | sem erros |
| Postgres 17 local (`run.sh`): RLS, isolamento, backup e restauração, rollback de 0032 a 0024 | todos OK (T93-T103 novos) |
| API da homologação (`02-seed-e-testes-api.mjs`) | **56 OK, 0 falhas** |
| Segurança comercial pela API (`06-seguranca-comercial.mjs`) | **14/14** |
| E2E com login real na homologação (Fases 2-9, com 8 novos da Fase 9) | **40/40** |
| Regressão E2E com o build normal e os interruptores desligados | **95 passando + 1 que falhou e passou na repetição** (`assistant-buttons`, envio com `/api/leads` fora do ar, mobile), 102 pulados. Os dois specs da Dani repetidos 3 vezes deram 171/171 |
| Interruptores desligados, com login real | `/portal/plano`, `/portal/nfse`, `/admin/comercial`, `/admin/whatsapp`, `/admin/nfse` e `/api/commercial/catalog` dão 404; os itens somem do menu; `/planos` sem a seção da emissão |
| Responsivo e acessibilidade | 482 medições, 0 estouro, 0 falhas no axe (doc 45) |

Primeira rodada da regressão: 5 falhas. O motivo foi um erro meu: não havia servidor de produção rodando, então o Playwright subiu `npm run dev`, que compila cada página na primeira visita. Isolados, os testes passaram duas vezes, e contra `next start` deu o resultado acima.

## 3. Arquivos
**Novos:**
- migration `0032_wjb_commercial_price_approval.sql`;
- `scripts/wjb-ai/homologacao/16_testes_0032.sql` e `17_rollback_0032.sql`;
- `scripts/wjb-ai/homologacao-supabase/06-seguranca-comercial.mjs`;
- `src/app/api/commercial/catalog/route.ts`;
- `src/lib/assistant/commercial-flow.ts`;
- `src/components/assistant/AssistantCommercial.tsx`;
- `src/tests/unit/wjb-fase9-commercial.test.ts` e `src/tests/e2e/staging-nfse-fase9.spec.ts`;
- docs 41-46 e as capturas em `docs/wjb-ai/evidencias/f9/`.

**Alterados:**
- `src/lib/commercial/{pricing,repo}.ts` e `src/actions/commercial.ts`;
- páginas `/emissao-de-notas`, `/planos`, `/portal/plano`, `/admin/comercial` e `/admin/whatsapp`;
- `src/integrations/whatsapp/index.ts` e o formulário de pré-cadastro;
- arquivos da Dani: tipos, configuração, armazenamento, fluxo, `AssistantPanel` e `WJBAssistant`;
- `admin-nav.ts`, `database.ts`, `staging.sh`, `run.sh` e a auditoria responsiva;
- o script 05, renomeado para `05-comercial-catalogo.mjs`.

**Removidos:** `src/app/api/wjb-ai/whatsapp/webhook/route.ts`, `src/lib/whatsapp/provider.ts`.

**Não tocados:** Omie/G-Click, Resend, login, Portal (fora `/portal/plano`) e as demais páginas do site.

## 4. Pendências para o lançamento (decisões da WJB)
1. Textos jurídicos dos aceites (termos, privacidade da emissão, representação fiscal).
2. Gateway de pagamento, contrato e tributação do serviço.
3. Segundo WhatsApp do rodapé, (11) 9 7685-4842: manter ou remover (doc 42).
4. Testes em aparelhos reais, Safari, Firefox e leitores de tela (doc 45).
5. Data e autorização de publicação. Na produção seria preciso aplicar 0024-0032 com backup, e o projeto de produção precisa estar estável (doc 19).

## 5. Fase 10 (desenho, não executado)
| Frente | O que exige | Dependências |
| --- | --- | --- |
| Certificado | e-CNPJ A1 da WJB **novo e não exposto**, guardado num cofre (gerenciador de segredos), e procurações eletrônicas dos clientes no Portal da RFB (modelo A, doc 26). O e-CPF comprometido nunca será usado | compra do certificado; escolha e contratação do cofre; autorização |
| Integração governamental | primeira leitura autenticada só da documentação (Swagger) da produção restrita; confirmação do algoritmo de assinatura na documentação vigente; transporte mTLS real; primeira DPS de teste com empresa fictícia na produção restrita | certificado e cofre; autorização escrita para cada passo (doc 29) |
| Operação | conector nacional ligado à fila só depois do teste; armazenamento protegido do XML; agendamento da fila e dos alertas; monitoramento | resultado do teste em produção restrita |
| Cobrança | gateway em modo de teste do provedor; evento de cobrança só a partir de nota oficial autorizada (o ledger já separa simulada de oficial); emissão da nota da própria WJB pelo serviço | escolha do gateway, contrato, tributação |
| WhatsApp Business Platform | só se a WJB quiser automação **dentro** do WhatsApp: verificação da empresa na Meta, número (coexistência ou migração), modelos aprovados, opt-in, LGPD e orçamento por mensagem | decisão da WJB; hoje o canal é Click-to-Chat e não precisa de nada disso |
| Publicação | aplicar 0024-0032 na produção com backup, interruptores desligados e liberação gradual por empresa | aprovação formal e produção estável |
