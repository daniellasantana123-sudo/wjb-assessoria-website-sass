# Fase 10E - CI/CD e DevSecOps

**Data:** 26/11/2026. **Workflow:** `.github/workflows/qa.yml`. Roda em push nas branches `feature/**` e `hotfix/**`, em PR e sob demanda. Sem segredos e sem acesso a homologação ou produção.

## 1. O que a CI valida agora
| Job | Verificações | Resultado (commit `3b1bed9a`) |
| --- | --- | --- |
| `estatico` | lint, TypeScript, **detecção de segredos** (`scripts/ci/verificar-segredos.sh`), `npm audit --omit=dev` | ✅ |
| `unitarios` | Vitest em **Node 22** (o da produção, conforme o log de build da Hostinger) e **Node 24** | ✅ ✅ |
| `banco` | `scripts/wjb-ai/homologacao/run.sh`: Postgres 17 descartável, migrations 0001 a 0037, **RLS, isolamento entre empresas, permissões, MFA no banco**, concorrência, backup e restauração, **rollback** 0037 → 0024 | ✅ |
| `e2e` | build, **segurança do artefato** (`scripts/ci/verificar-build.sh`), E2E em **Chromium, Firefox, WebKit e iPhone emulado** | ✅ (216 aprovados, 0 instáveis) |

## 2. Achados que a CI trouxe nesta fase
| Achado | Tratamento |
| --- | --- |
| Node 20 não roda o projeto: `@supabase/*` (usado em produção) e `undici` (via `jsdom`) exigem Node 22 ou mais novo | Node 20 saiu da matriz; o `package.json` declara `engines: node >= 22.19.0` (só o campo; o lock recebeu 3 linhas). A produção roda Node 22, confirmado no log de build |
| Instabilidade do formulário no WebKit | causa corrigida (doc 03) |
| O detector de segredos não pegava chave privada real (o conteúdo vem na linha seguinte ao cabeçalho) | busca que atravessa linhas; testado com chave gerada na hora (detecta) e com as fixtures (ignora) |

## 3. Detecção de segredos (`scripts/ci/verificar-segredos.sh`)
- Arquivos de certificado e chave (`.pfx`, `.p12`, `.key`, `.pem`, `.crt`, `.cer`, `.der`, `.jks`) e `.env` versionados: **falha**.
- Tokens de serviços: Stripe live e test real, webhook, Supabase secret e service role, Resend, AWS, GitHub, Slack.
- Chave privada com conteúdo, mesmo em várias linhas.
- Única exceção: a chave de **exemplo** da documentação da AWS.

## 4. Segurança do artefato (`scripts/ci/verificar-build.sh`)
O código enviado ao navegador (`.next/static`) não pode citar nomes de segredos de servidor (`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `CRON_SECRET`, `GCLICK_CLIENT_SECRET`…), nem conter material de chave ou source maps. **Resultado atual: limpo.**

## 5. Proposta de proteção da `main` (não aplicada: depende de autorização)
A `main` é o deploy automático na Hostinger. Proposta:
- [ ] **Exigir PR** para a `main` (sem push direto), com **1 aprovação** de pessoa da WJB.
- [ ] **Exigir as verificações** `estatico`, `unitarios (22)`, `unitarios (24)`, `banco` e `e2e` aprovadas antes do merge.
- [ ] Exigir a branch atualizada com a `main` antes do merge.
- [ ] Bloquear force-push e exclusão da `main`.
- [ ] Commits só por merge de PR (histórico linear opcional).
- [ ] Exceção documentada para hotfix de segurança: PR com as mesmas verificações, aprovação expressa do Product Owner.

**Atenção à prévia da Hostinger:** hoje, **abrir um PR publica uma prévia com o `.env` de produção** (doc 02). Antes de exigir PR para tudo, desligar as prévias no hPanel, ou elas passam a ser criadas a cada PR.

**Critérios de aprovação de PR (proposta):**
- CI verde;
- descrição com o que muda, as migrations (se houver) e o rollback;
- nenhuma chave `WJB_*` nova ligada por padrão;
- documentação atualizada.

## 6. O que não foi alterado
Nenhuma configuração do GitHub (proteção de branch, permissões, segredos) e nenhuma configuração de produção. As notificações de falha de workflow (a rotina de lembretes falhou 44 dias sem alarme) dependem da conta do responsável no GitHub.
