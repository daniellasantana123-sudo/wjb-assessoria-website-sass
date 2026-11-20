# 21 - Homologação no Supabase real (`wjb-ai-homologacao`)

**Custo aprovado em 20/11/2026:** ≈ US$ 10/mês (Micro, fora do Spend Cap). Nenhum outro recurso pago.

## 1. Passos do proprietário (segredos nunca passam pelo chat)
1. Painel > organização `wjb assessoria contabil` > **New project**: nome `wjb-ai-homologacao`, região **South America (São Paulo)**, compute **Micro**, senha do banco gerada pelo painel e guardada no gerenciador de senhas.
2. Esperar o status **Healthy**.
3. Authentication > Sign In / Providers: deixar só e-mail; **desligar "Allow new users to sign up"** (usuários de teste são criados pelo script). URL Configuration: Site URL `http://localhost:3000`.
4. Criar na raiz do repositório, neste computador, o arquivo **`.env.homolog.local`** (ignorado pelo Git) com 4 linhas:
   ```text
   HOMOLOG_SUPABASE_URL=https://<ref-da-homologacao>.supabase.co
   HOMOLOG_SUPABASE_ANON_KEY=<Settings > API Keys > anon / publishable>
   HOMOLOG_SUPABASE_SERVICE_ROLE_KEY=<Settings > API Keys > service_role / secret>
   HOMOLOG_DB_URL=<Connect > Session pooler (porta 5432), com a senha do banco>
   ```
   Os scripts recusam rodar se qualquer valor apontar para a produção (`hlyukumgyzswfndlzwcf`).

## 2. Execução (eu rodo, sem imprimir segredos)
| Passo | Comando | O que prova |
| --- | --- | --- |
| Migrations 0001-0023 | `node scripts/wjb-ai/homologacao-supabase/01-migrations.mjs --ate 0023` | schema atual recriado do zero só por migrations versionadas; registro com sha256 detecta divergência |
| Backup + restauração | `node scripts/wjb-ai/homologacao-supabase/03-backup-restauracao.mjs` | backup restaurável **antes** da 0024 |
| 0024 | `node scripts/wjb-ai/homologacao-supabase/01-migrations.mjs` | aplica só o que falta, com backup automático antes |
| Testes reais (Auth + PostgREST) | `node scripts/wjb-ai/homologacao-supabase/02-seed-e-testes-api.mjs` | 29 verificações com JWT de verdade: isolamento, falsificação de status, idempotência, concorrência (5 envios simultâneos = 1 pedido), permissão de aprovação |
| F2 em staging (login real) | `bash scripts/wjb-ai/homologacao-supabase/staging.sh` | prévia, confirmação, duplicidade, 404 entre empresas, troca de empresa ativa, equipe barrada |
| Backup final | `03-backup-restauracao.mjs` de novo | restauração com os dados de teste |

## 3. Testado antes do projeto existir (Postgres 17 local)
- `01-migrations.mjs`: aplica em duas etapas, não reaplica, detecta arquivo alterado depois de aplicado.
- `03-backup-restauracao.mjs`: restauração idêntica em contagem de linhas nas 20 tabelas.
- Guarda contra produção: bloqueia na hora.
O `02` e o `staging.sh` dependem de Auth/PostgREST reais e só rodam no projeto de homologação.

## 4. Rollback
Na homologação: `scripts/wjb-ai/homologacao/03_rollback_0024.sql` pelo SQL Editor do projeto de homologação, ou apagar o projeto inteiro (encerra também o custo).
