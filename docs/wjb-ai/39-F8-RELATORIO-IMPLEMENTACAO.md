# 39 - Fase 8: relatório de implementação

**Data:** 21/11/2026 · Branch `wjb-ai/f2-solicitar-nfse`. Nada na `main`, nenhum deploy, produção (`wjb-website-app`) não acessada. Sem cobrança real, sem emissão fiscal, sem acesso a governo, sem Cloud API do WhatsApp, sem IA externa, sem serviço novo contratado.

## 1. Matriz F8.0-F8.6
| Item | Entregue | Onde |
| --- | --- | --- |
| F8.0 Diagnóstico e auditoria de código e rotas | sim | doc 34 |
| F8.1 Planos, assinaturas simuladas, contratação sozinha ou em combo | sim (preços em rascunho) | docs 35 e 38; `/portal/plano`, `/admin/comercial` |
| F8.2 Consumo, franquia, excedente e fatura simulados | sim; nota simulada nunca faturável (regra do banco) | `src/lib/commercial/pricing.ts`, ledger |
| F8.3 Página pública e pré-cadastro | sim, atrás do interruptor e sem preço | `/emissao-de-notas` |
| F8.4 Preparação do WhatsApp (+55 11 97614-6375) | simulação e checklist; **não conectado** | doc 36 |
| F8.5 Auditoria de responsivo, viewport e acessibilidade com correções | sim (emulado, só Chromium) | doc 37 |
| F8.6 Testes, segurança, regressão e documentação | sim | seção 2 |

## 2. Testes (números desta execução)
| Bateria | Resultado |
| --- | --- |
| Unitários (Vitest) | **565 passando** (19 novos da Fase 8) |
| TypeScript e lint | sem erros |
| Postgres 17 local (`run.sh`): RLS, isolamento, integridade, backup e restauração, rollback de 0031 a 0024 | todos OK; 16 testes da Fase 8 (T77-T92) |
| Homologação real pela API (`02-seed-e-testes-api.mjs`) | **56 OK, 0 falhas** |
| E2E com login real na homologação (`staging.sh`, inclui 8 da Fase 8) | **32 passando** |
| Regressão E2E com o build normal (interruptores desligados) | **96 passando, 0 falhas** (86 pulados: specs de staging e auditoria, e duplicatas mobile) |
| Interruptores desligados, com login real | `/portal/plano`, `/portal/nfse`, `/admin/comercial`, `/admin/whatsapp` e `/admin/nfse` dão 404 e somem do menu; sem login, `/emissao-de-notas` e o webhook dão 404; `/planos` sem a seção da emissão |
| Auditoria responsiva | 456 medições, 0 estouro, 0 bloqueio de zoom (doc 37) |

## 3. Achados reais corrigidos
1. `has_entitlement` consultável por qualquer usuário logado para outra empresa → migration 0031 (doc 38).
2. Gatilho de histórico de preço violava a chave estrangeira → dois gatilhos separados.
3. Mensagem de confirmação sumia depois de contratar → redirecionamento com aviso.
4. Contraste de texto (verde de sucesso, manual `/ajuda`) e tabelas roláveis sem foco → corrigidos (doc 34).

## 4. Segurança e privacidade antes do commit
- Varredura do diff e dos arquivos novos: nenhuma chave `sb_secret_`, nenhum JWT, nenhuma senha, nenhum arquivo `.pfx`/`.p12`/`.pem`.
- `.env.homolog.local` e `.env.homolog.users.local` continuam fora do Git.
- A evidência `responsivo.json` não tem e-mail, CPF nem CNPJ.
- O certificado e-CPF comprometido não foi usado, aberto nem pedido.

## 5. Custos
Nenhum custo novo nesta fase. Continua só o projeto de homologação do Supabase (plano Micro, cerca de US$ 10/mês, aprovado em 20/11/2026). A Cloud API do WhatsApp e um meio de pagamento teriam custos próprios, que só serão levantados com autorização (docs 35 e 36).
