# Decisões - Fase 5

## D1 - Achado de segurança real: `my_tenant_ids()` não respeitava status, corrigido junto da suspensão de empresa

**Contexto**: ao implementar "suspender empresa" (RF explícito do prompt), percebi que `my_tenant_ids()` (função SECURITY DEFINER usada pela RLS de `documents`, `obligations`, `tickets`, `messages`, `notifications`, `omie_client_mappings`) nunca filtrava `tenant_members.status` - mesmo depois da Fase 2 ter introduzido a suspensão de membership (`suspendMember`), a checagem de status só existia no nível de aplicação (`getTenantRole()`), nunca na RLS, que é o mecanismo do qual este projeto diz depender de verdade.

**Decisão**: corrigir `my_tenant_ids()` e `is_tenant_owner()` na mesma migration (`CREATE OR REPLACE FUNCTION`, assinatura idêntica - nenhuma policy precisou ser recriada), em vez de abrir uma migration separada "fora de escopo". Suspender uma empresa ou um vínculo individual agora bloqueia de verdade no banco, não só na aplicação.

**Impacto**: qualquer teste/uso anterior que dependesse de um `tenant_member`/`tenant` "suspenso mas ainda com RLS liberada" deixa de funcionar - comportamento correto, não uma regressão.

## D2 - Feature flags: só 3 keys, todas com ponto de checagem real

**Contexto**: o prompt lista "Omie, documentos, notificações, demais features do MVP" como escopo de feature flags.

**Decisão**: implementar só `omie_gclick`, `documents`, `notifications` - as únicas 3 explicitamente nomeadas. "Demais features do MVP" é vago demais pra virar flags concretas sem inventar quais - criar uma flag pra `obligations`/`tickets`/`messages` sem nenhum código checando o valor seria um toggle decorativo (o super_admin "desativa" e nada muda), o que é pior do que não ter a flag: passaria a falsa impressão de controle operacional. Se o usuário quiser flags pra outras features específicas, cada uma precisa de um ponto de chamada real definido - mesmo trabalho que os 3 casos aqui.

## D3 - Kill switch de feature corta só a escrita, nunca a leitura

**Contexto**: desligar `documents` não deveria fazer documentos já enviados desaparecerem, nem `omie_gclick` desligado deveria apagar o mapeamento já configurado.

**Decisão**: `uploadDocument` bloqueia só o envio (leitura/download continuam); `syncOmieClient` bloqueia só a sincronização nova (o CTA do Portal também soma a checagem de flag, pra não mostrar um link "ativo" que na prática está desligado); `notifyTicketOrMessageEvent` é tudo-ou-nada porque não faz sentido meia notificação. Nenhuma flag jamais apaga dado existente.

## D4 - "Testar conexão" do Omie é uma chamada real (`ListarClientes`), não um health check fake

**Contexto**: o prompt pede "testar conexão" como item separado de "sincronizar".

**Decisão**: `testConnection()` chama a API real do Omie (`ListarClientes`, 1 registro por página) só pra confirmar que as credenciais autenticam - não cria/altera nenhum cliente. Mesma ressalva de "não testado ao vivo nesta sessão" já registrada pra `upsertClient` na Fase 4 (nenhuma credencial disponível).

## D5 - "wjb_admin" não existe; tratado como `super_admin`

**Contexto**: o prompt define segurança como "somente `super_admin`, `wjb_admin` e permissions específicas". Este schema nunca teve um papel `wjb_admin` - só `super_admin`/`contador`/`atendimento` (`0001_core_schema.sql`).

**Decisão**: tratar "wjb_admin" como sinônimo do papel administrativo máximo já existente (`super_admin`), em vez de criar um novo valor de enum sem nenhuma distinção real de permissões da Fase 5 pra justificá-lo. Todas as ações mais sensíveis desta fase (`tenants.suspend`, `feature_flags.manage`) são exclusivas de `super_admin`.

## D6 - "Alterar role"/"Revogar acesso"/"Reenviar convite" de tenant_members: staff-only, sem liberar pro `owner`

**Contexto**: `inviteMember` já é liberado pro `owner` da própria empresa (Fase 2). As novas ações são mais sensíveis (trocar quem manda numa empresa, cortar acesso de vez).

**Decisão**: `updateMemberRole`/`revokeMemberAccess` ficam staff-only (`members.manage`), mesmo nível de `suspendMember` (Fase 2) - um `owner` não pode promover a si mesmo/rebaixar outro `owner`/se auto-revogar sem supervisão da WJB. `resendMemberInvite` é a exceção deliberada: usa a mesma regra de `inviteMember` (staff OU `owner`), porque reenviar um convite tem o mesmo risco que enviar o primeiro.

## D7 - `resendMemberInvite`/`resendStaffInvite` não testados contra o caso real "convite já aceito"

**Contexto**: nenhum projeto Supabase real está conectado nesta sessão (herdado da Fase 0) - não dá pra confirmar empiricamente o que `inviteUserByEmail` retorna quando o e-mail já confirmou a conta.

**Decisão**: reaproveitar a mesma chamada já usada no convite original, tratando qualquer erro do Supabase como "não foi possível reenviar - a pessoa pode já ter aceitado" (mensagem honesta sobre a incerteza, não uma afirmação categórica). Documentado como risco em `phase-handoff.md`.
