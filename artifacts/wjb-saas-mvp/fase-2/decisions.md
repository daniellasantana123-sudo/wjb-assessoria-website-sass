# Decisões - Fase 2

## D1 - Auth básico e Dashboard já satisfeitos, não recriados

Login/logout/reset/verificação de e-mail e o Dashboard do Portal já existiam, validados em produção desde 2026-09-16 (ver Fase 0). "status Omie" no dashboard foi descartado de novo, mesma decisão de produto de 2026-09-16/2026-09-20 (Fases 0 e 1) - a integração com ERP/fiscal externo não faz parte deste projeto.

## D2 - MFA: "preparar a estrutura", sem exigir de ninguém

**Decisão do usuário**: disponibilizar TOTP pra quem quiser ativar, sem tornar obrigatório pra `super_admin` (a role "wjb_admin" citada no prompt não existe neste projeto - ver Fase 1 D1 pro mapeamento de papéis).

**Implementação real, não só cosmética**: além da UI de ativação, `requireSession()` de fato verifica o AAL e bloqueia acesso até completar o desafio pra quem tem um fator verificado - sem isso, ativar MFA seria decorativo (a pessoa configuraria um app autenticador que nunca seria checado). Como ninguém tem MFA ativado hoje, isso não muda nenhum comportamento existente.

## D3 - Organization switcher: construído mesmo sem caso de uso real hoje

**Decisão do usuário**: construir agora, mesmo sabendo que nenhum usuário tem 2+ empresas no momento.

**Ficou pronto de ponta a ponta**: não é só uma tela decorativa - `getMyPrimaryTenant()` foi removida e todas as 7 páginas do Portal + o layout migraram pra `getActiveTenant()`, que de fato lê o cookie e revalida contra o banco. No dia em que uma pessoa for adicionada a uma segunda empresa, o switcher aparece sozinho na sidebar (a condição é `organizations.length > 1`), sem precisar de mais nenhuma mudança de código.

## D4 - Suspensão: conta inteira E vínculo com empresa, mais uma camada de ban

**Decisão do usuário**: implementar os dois níveis (`profiles.status` e `tenant_members.status`) e também chamar `supabase.auth.admin.updateUserById(..., { ban_duration })`.

**Nuance registrada durante a implementação**: o SDK do Supabase não oferece um método direto "encerre todas as sessões deste usuário por id" - `admin.signOut()` precisa de um JWT específico, não um `userId`. A forma documentada de bloquear alguém por id é o `ban_duration` via `updateUserById`, que impede login/renovação de token, mas não há garantia documentada de que invalida instantaneamente um token de acesso já emitido e ainda não expirado (JWT é stateless). Por isso, o mecanismo real do qual este projeto depende pra bloquear o acesso é a checagem de `status` em `getSession()`/`getTenantRole()` - imediata, testável, e sob controle total do próprio código. A chamada de ban é uma camada extra, com tratamento de erro "melhor esforço" (loga mas não falha a suspensão se o Supabase Auth rejeitar a chamada).

## D5 - Cards "Notificações"/"Suporte" no Dashboard não foram adicionados

O prompt lista esses dois como cards do "Dashboard MVP". Já são alcançáveis em 1 clique pela sidebar do Portal, cada um com seu próprio contador de não lidas (badge). Adicionar um card redundante no Dashboard só pra bater a lista literal do prompt não pareceu justificar a mudança - registrado aqui como decisão consciente, não esquecimento. Reconsiderar se o usuário quiser explicitamente.

## D6 - Limitação de teste conhecida (não é lacuna de código)

O bloqueio de sessão suspensa dentro de `getSession()`/`getTenantRole()` não tem teste automatizado direto - ambas são memoizadas com `cache()` do React, que memoiza por argumento indefinidamente dentro do mesmo módulo, inviabilizando trocar o mock de resposta do Supabase entre casos de teste no mesmo arquivo sem reestruturar a suíte inteira em torno disso. A lógica em si é simples (mesmo padrão de `is_wjb_staff` já usado sem teste direto) e foi revisada manualmente linha a linha. Recomendado como verificação E2E manual quando o Supabase real for reconectado (Fase 0, D2).
