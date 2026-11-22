# 54 - Diagnóstico do banco de produção (somente leitura, 22/11/2026 ~00h UTC)

**Projeto:** `wjb-website-app` (ref `hlyukumgyzswfndlzwcf`).

**Método:** verificações de leitura executadas **no próprio servidor da Hostinger**, por SSH, usando as credenciais que já estão lá. A chave não saiu do servidor nem foi exibida. Foram consultados só status, contagens e nomes. **Nada foi alterado, restaurado ou reiniciado.**

## 1. Resultado
| Verificação | Resultado |
| --- | --- |
| DNS do projeto | resolve |
| Auth (`/auth/v1/health`) | **200**: o serviço responde (antes, em 20/11, o projeto não saía de "Coming up") |
| Tabelas expostas pela API (`/rest/v1/`, com a chave de serviço) | **nenhuma** |
| `profiles`, `tenants`, `obligations`, `leads` e demais | `PGRST205`: "Could not find the table 'public.profiles' in the schema cache" |
| Usuários no Auth (só a contagem) | **0** |
| Site público | no ar (200). `/portal` redireciona para o login (307) |

## 2. Leitura (sem afirmar a causa)
Antes do incidente, o banco tinha a conta da CEO, as empresas, as obrigações sincronizadas do G-Click e os leads (docs 19 e CLAUDE.md). Hoje a API não enxerga **nenhuma** tabela e o Auth tem **zero** usuários. Duas hipóteses, que só o painel ou o suporte separam:
1. **O projeto voltou sem os dados.** A plataforma pode ter recriado o banco ou feito uma restauração vazia; em 20/11 o painel mostrava "No backups yet".
2. **Os serviços (PostgREST e Auth) ainda não recarregaram o esquema** depois da volta.

**Impacto atual:**
- login do Portal e do Admin impossível (não há usuários);
- leads não são gravados no banco (o e-mail pelo Resend continua);
- lembretes de obrigação e a integração G-Click sem base para operar.

O site comercial segue no ar.

## 3. O que NÃO foi possível verificar (exige o painel ou o suporte)
- Saúde do PostgreSQL (conexões, logs), a existência real do esquema `public` e das tabelas, integridade dos dados.
- Backups e PITR disponíveis.
- Histórico de migrations aplicadas.
- Resposta do chamado aberto no suporte do Supabase (nenhuma resposta foi registrada neste repositório).

## 4. Ações recomendadas (para a WJB; nenhuma executada)
1. **No painel do Supabase, só olhar:**
   - Table Editor / Database > Tables: o esquema `public` tem tabelas?
   - Authentication > Users: há usuários?
   - Database > Backups: há backup? de quando?
   - Logs do Postgres.
2. **No chamado do suporte:** informar que o projeto voltou, mas a API não vê tabelas e o Auth está com 0 usuários. Perguntar se os dados existem e se é possível recuperá-los (PITR, snapshot interno).
3. **Não** rodar migration, "reset", "restore" nem recriar tabelas antes da resposta: isso pode sobrescrever o que ainda dá para recuperar.
4. **Se os dados não puderem ser recuperados**, planejar a reconstrução com a WJB:
   - aplicar as migrations 0001-0023 num banco vazio;
   - recriar a conta da CEO;
   - reimportar as empresas do G-Click (a importação por CNPJ existe desde 01/10);
   - reenviar convites.

   Documentos enviados e leads antigos só voltam com backup. Os leads chegaram também por e-mail (Resend), o que permite recuperação parcial.
5. **Teste de restauração isolado:** quando houver um backup, restaurá-lo num **projeto separado** (nunca por cima da produção) e conferir contagens e login, antes de qualquer decisão sobre a produção. O roteiro de backup e restauração já usado na homologação (`03-backup-restauracao.mjs`, `run.sh`) serve de base.

## 5. Consequência para a publicação
Nenhuma etapa que dependa do banco (B, D, E, F do doc 51) pode começar enquanto este diagnóstico não for resolvido. A **etapa A** (hotfix do Next.js) não toca no banco e pode seguir, com aprovação.
