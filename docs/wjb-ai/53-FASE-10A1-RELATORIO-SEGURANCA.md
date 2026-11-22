# 53 - Fase 10A.1: relatório de segurança

**Data:** 21-22/11/2026.

**Não foram feitos:** deploy, merge na `main`, migration na produção, restauração, reinício, cobrança ou emissão fiscal.

| Entrega | Branch | Commit |
| --- | --- | --- |
| Hotfix do Next.js (independente da WJB AI) | `hotfix/next-16.4.6-security` (a partir da `main` `a7d15d22`) | `70d08787` |
| MFA no banco e endurecimento | `wjb-ai/10a-hardening` | ver o commit desta fase |

## 1. Hotfix do Next.js (pronto para revisão, NÃO publicado)
- **Versão:** `next` e `eslint-config-next` 16.3.7 → **16.4.6**, que continua sendo a estável mais recente (16.4.5 trouxe as correções do comunicado de 03/11; 16.4.6 saiu em 09/11).
- **Também:** `zod` 4.5.4 → 4.6.7 (vulnerabilidade alta) e transitivas por `npm audit fix` sem `--force`.
- **Escopo:** **nada** das Fases 2-10A. Só 2 arquivos alterados: `package.json` e `package-lock.json`.
- **`npm audit`:** 1 crítica, 4 altas e 10 moderadas → **3 moderadas**, só no `vitest` (ferramenta de teste, não roda em produção; corrigida na branch de desenvolvimento e deixada de fora do hotfix para ele ficar mínimo).

**Verificação:**
- lint e tipos sem erros;
- 373/373 testes unitários (os da `main`);
- build normal OK;
- **build com o compilador WebAssembly**, que é o que o servidor usa (abaixo): OK;
- regressão E2E **96/96** contra esse build;
- site, `/login`, `/planos`, `/contato`, `/blog` e `sitemap.xml` com 200.

**Compatibilidade com a Hostinger** (conferida por SSH, só leitura: versões e nomes de variável, nunca valores):
- Node.js disponível: 20.20, 22.23 e 24.22. O Next 16.4.6 exige ≥ 20.9.
- **glibc 2.28** no servidor: o compilador nativo do Next (SWC) **já não carrega hoje**, e o build de produção usa `@next/swc-wasm-nodejs`, vindo do cache do servidor.
- Com 16.4.6, o primeiro build vai **baixar** `@next/swc-wasm-nodejs@16.4.6`. **Testado localmente:** baixou e compilou. **Risco:** se o servidor não conseguir baixar o pacote, o build falha. Mitigação: conferir o log do deploy e voltar à versão anterior (doc 51, etapa A).
- O `sharp` da otimização de imagem tem os binários `linux-x64` e `wasm32` instalados; o `stderr.log` da versão ativa está vazio.

**Rollback:** reverter o commit do hotfix na `main`. A Hostinger reconstrói e publica a versão anterior; as versões ficam em `hbuilds/versions/` e o link `current` aponta para a ativa. **Configuração:** nenhuma variável muda.

## 2. Autorização e MFA no banco (homologação)
**Migration 0035** (aditiva, só homologação; rollback `23_rollback_0035.sql` testado): o banco passa a exigir sessão **aal2** (senha + segundo fator) para:

| Operação | Como |
| --- | --- |
| Criar ou alterar planos e preços (inclusive aprovar), desconto do combo e premissas | políticas **restritivas** em `commercial_plans` e `commercial_settings` |
| Registrar ou revogar autorização de emissão | políticas restritivas em `fiscal_authorization_grants` |
| Conceder ou revogar aprovador, aprovar perfil fiscal, configurar a série da DPS | as funções `SECURITY DEFINER` ganharam uma camada de mesmo nome que exige aal2 e chama a original (`*_impl`, sem execução para usuários). A lógica já testada não foi reescrita |

**Credenciais comprometidas** (usuários fictícios, sem credencial real), testadas no Postgres local (T129-T140) e **na API real da homologação** (`09-seguranca-mfa-banco.mjs`, 11/11):
- super admin e contador **com a senha e sem o código**, chamando o PostgREST direto, **não** conseguem: alterar preço, alterar desconto, conceder aprovador, configurar série, registrar autorização ou aprovar perfil;
- a função original (`_impl`) não é exposta para contornar a checagem;
- com o código do autenticador (aal2) a operação passa e as regras de sempre continuam valendo;
- cliente com MFA continua sem poder mexer em preço.

**Camadas atuais:**
- aplicação: permissão + step-up de 15 min (Fase 10A);
- banco: papel (RLS) + aal2 (0035);
- auditoria (`audit_log`).

**Operações financeiras privilegiadas:** pagamentos e assinaturas são gravados só pelo servidor (service role), sem política de escrita para usuário (0030 e 0033). Ações administrativas de pagamento exigem super admin. A cobrança real (live) é recusada por CHECK.

### 2.1 Auditoria de RPC, papéis e SECURITY DEFINER
| Item | Situação |
| --- | --- |
| RLS | 38/38 tabelas (+ `rate_limit_buckets`); `payment_mock_objects` e `rate_limit_buckets` sem política (ninguém do navegador) |
| `has_entitlement`, `allocate_dps_number`, `rate_limit_hit` | só `service_role` |
| `is_staff`, `is_super_admin`, `is_tenant_owner`, `my_tenant_ids`, `can_approve_fiscal_profile` | executáveis por usuário, mas respondem só sobre o próprio usuário (`auth.uid()`) |
| Funções de gatilho (`commercial_*_history`, `guard_profile_privileged_columns`, `handle_new_user`) | não são chamáveis como RPC útil (só como gatilho) |
| Funções sensíveis de aprovação | agora com aal2 (0035) |

### 2.2 Limites: credenciais administrativas do próprio banco
Nenhuma regra de RLS ou de função protege contra quem tem as credenciais **administrativas do banco**:
- a chave `service_role` (ou `sb_secret_`);
- a senha do `postgres`;
- acesso ao painel do Supabase.

Essas credenciais **ignoram a RLS por definição**. A proteção adequada é organizacional e operacional:
1. A chave `service_role` só no servidor (hoje em `hbuilds/config/.env` na Hostinger) e **nunca** no navegador. Conferido: nenhum arquivo `"use client"` a usa.
2. Rotação da chave quando houver suspeita, e periodicamente (já feita uma vez em 23/09).
3. MFA e acesso mínimo **no painel do Supabase e na Hostinger** para as pessoas da organização.
4. Senha do `postgres` forte e guardada fora do projeto.
5. Monitorar os logs do Supabase e manter a trilha imutável de ações (`audit_log` e as trilhas das 0028 e 0030).
6. Backups diários + PITR (plano Pro) para recuperar de uma ação destrutiva.
7. A médio prazo: tirar do servidor web as operações privilegiadas que não precisam de service role (mais operações com o JWT do usuário, que passa pela RLS e pelo aal2).

## 3. Outras verificações desta fase
| Item | Resultado |
| --- | --- |
| Cache e isolamento | nenhum uso de `use cache` ou `unstable_cache`; Portal e Admin 100% dinâmicos; isolamento entre empresas verificado (API 14/14, 12/12, E2E) |
| Chamadas diretas a APIs e funções privilegiadas | 09 (11/11), 06 (14/14), 07 (12/12), 02 (56/56) |
| MFA em sessões diferentes | sessão aal1 x aal2 da mesma conta (E2E e 09) |
| Limites dos formulários | testados (400, 413, 429; contador compartilhado no banco) |
| Logs | o adaptador de e-mail sem provedor gravava assunto e destinatário (o assunto do lead tem o nome). Corrigido para não gravar detalhes. Os erros do Supabase continuam indo inteiros para o log do servidor (risco baixo; ver doc 52) |
| Dependências | 0 vulnerabilidades na branch de desenvolvimento; 3 moderadas só no `vitest` no hotfix |
| Teste frágil corrigido | testes de certificado da Fase 6 usavam a data de Brasília contra um certificado em UTC e falhavam entre 21h e 0h. Corrigido. Pendência fiscal (Fase 10B): comparar a validade do certificado no mesmo fuso |
| Responsivo | mantido; última execução (Fase 10A, mesma interface) com 482 medições e 0 falhas |
| Dispositivos reais | pendente (iPhone, Android, Safari, Firefox, leitor de tela) |

## 4. Ferramenta de homologação corrigida
O `02-seed-e-testes-api.mjs` reescrevia o arquivo de usuários e **apagava os segredos TOTP**. Os fatores continuavam ativos no Supabase, e os usuários de teste ficariam trancados. Agora ele preserva os segredos. O `mfa.mjs` (`ensureTotp`) refaz o fator pela API admin quando o segredo se perdeu.
