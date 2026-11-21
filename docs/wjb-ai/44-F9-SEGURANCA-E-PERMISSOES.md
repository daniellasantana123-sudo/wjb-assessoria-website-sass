# 44 - Fase 9: segurança, permissões e isolamento

Tudo na homologação (`wjb-ai-homologacao`, ref `uisoyodnzdyaaxisujmk`, conferido pelos scripts antes de cada execução). A produção não foi acessada.

## 1. Migration 0032
Aditiva. Aplicada só na homologação, com backup antes e registro sha256. Rollback testado: `scripts/wjb-ai/homologacao/17_rollback_0032.sql`.

Testes no Postgres 17 local (`run.sh`):
| Teste | Resultado |
| --- | --- |
| T93 plano não nasce aprovado | bloqueado (42501) |
| T94 aprovação sem referência | bloqueada (23514) |
| T95 super admin aprova; autor e data gravados pelo banco | OK |
| T96 dados da aprovação não podem ser trocados depois | OK |
| T97 mudar o preço de plano aprovado o devolve a rascunho | OK |
| T98 histórico guarda a versão aprovada com a vigência | OK |
| T99 mudança do desconto entra no histórico | OK |
| T100 contador não aprova preço | OK |
| T101/T102 equipe lê o histórico de configuração, cliente não | OK |
| T103 ninguém grava o histórico direto | bloqueado (42501) |

## 2. Requisição direta à API do banco (IDOR e manipulação pelo navegador)
`node scripts/wjb-ai/homologacao-supabase/06-seguranca-comercial.mjs`, com login real de usuários fictícios. **14/14 sem falha.**
| Teste | Resultado |
| --- | --- |
| S1/S2 empresa B lê a assinatura da A filtrando pela empresa ou pelo id exato | 0 linhas |
| S3 empresa B lê aceites e consumo da A | 0 linhas |
| S4 empresa B consulta o direito de uso da A (`has_entitlement`) | recusado (42501, migration 0031) |
| S5 empresa A lê a própria assinatura | OK |
| S6 cliente altera preço, desconto ou status da própria assinatura | nada muda |
| S7 cliente cria assinatura (inclusive "real") direto no banco | recusado |
| S8 cliente grava consumo faturável | recusado |
| S9 cliente lê ou altera o catálogo | 0 linhas / nada muda |
| S10 cliente altera o desconto do combo | recusado |
| S11 cliente lê o histórico de configuração | 0 linhas |
| S12/S13 contador lê o catálogo, mas não altera preço aprovado | OK |
| S14 visitante anônimo lê catálogo ou assinaturas | 0 linhas |

## 3. No servidor (Server Actions e rotas)
- A empresa vem sempre da sessão. Só o responsável contrata, troca ou cancela. O preço é relido do catálogo **aprovado**; o formulário manda só o código do plano.
- Alto Volume (sob proposta) não pode ser contratado pelo Portal: a ação recusa e a tela mostra só "Pedir proposta".
- `/api/commercial/catalog` expõe só plano aprovado e campos comerciais (o E2E confirma: sem `tenant`, e-mail, autor nem referência da aprovação).
- `isRealBillingEnabled()` continua sempre falso. O banco só aceita assinatura `simulado` (0030).

## 4. Privacidade
- Links de WhatsApp sem dado pessoal (doc 42). O texto livre da Dani não sai do navegador.
- O pré-cadastro continua sem CPF, certificado ou senha. O consentimento LGPD é obrigatório e o de marketing é separado.
- Nenhuma chamada a modelo de IA externo. Nenhum certificado, PFX, e-CPF ou e-CNPJ. Nenhuma API fiscal oficial.
