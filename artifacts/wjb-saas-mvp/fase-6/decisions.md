# Decisões - Fase 6

## D1 - "Marcar como lida"/"marcar todas como lidas" viraram ações explícitas (mudança de comportamento deliberada)

**Contexto**: desde a Fase 3, `NotificationsList` chamava `markAllNotificationsAsRead()` automaticamente toda vez que a página `/portal/notificacoes`/`/admin/notificacoes` era visitada - um efeito colateral de renderizar a lista, não uma ação do usuário. O prompt desta fase lista "marcar como lida" e "marcar todas como lidas" como capacidades explícitas do centro de notificações.

**Decisão**: mudar o comportamento - cada notificação agora linka pra `GET /api/notifications/[id]/read` (marca só aquela e redireciona) e existe um botão "Marcar todas como lidas" (só aparece se houver alguma não lida). Isso é uma mudança de UX real em relação ao que existia, não uma adição aditiva - documentado aqui porque "preserve tudo que já estiver funcional" poderia ser lido como "não mude nada", mas o comportamento anterior não atendia ao critério explícito do prompt (ação do usuário, não efeito colateral de leitura).

**Impacto**: quem visita a página de notificações agora precisa clicar em algo pra marcar como lida (uma notificação individual ou todas) - antes, só abrir a página já marcava tudo.

## D2 - `tenant_id`/`recipient_id` não foram renomeados para "organization_id"/"user_id"

**Contexto**: o diagrama do modelo de dados do prompt usa `organization_id`/`user_id`.

**Decisão**: manter os nomes já existentes (`tenant_id`, `recipient_id`) - toda outra tabela do projeto (tickets, messages, obligations, documents, omie_client_mappings) usa `tenant_id`, e `recipient_id` é mais descritivo que `user_id` pro caso específico de notificação (quem recebe, não necessariamente "o usuário" de um contexto genérico). Renomear só esta tabela criaria inconsistência sem ganho funcional - mesmo racional já registrado na Fase 6 da migration em si.

## D3 - Notificação de convite só no envio inicial, não no reenvio

**Contexto**: `resendMemberInvite`/`resendStaffInvite` (Fase 5) já reenviam o e-mail nativo do Supabase Auth (com o link de acesso). O prompt pede notificação de `invitation`.

**Decisão**: `notifyInvitation` só é chamada no convite inicial (`inviteMember`/`inviteStaffMember`). Chamá-la também no reenvio mandaria um segundo e-mail (WJB, genérico) além do e-mail nativo do Supabase (com o link de fato) toda vez que alguém clicasse "reenviar" - redundante e potencialmente confuso pra quem recebe dois e-mails parecidos de fontes "diferentes" pro mesmo evento.

## D4 - `document_requested` e `system_message`: tipos definidos, sem disparo real

**Contexto**: o prompt lista 6 tipos. Só 4 têm um evento real do produto que os justifique.

**Decisão**: `document_requested` (WJB pede um documento específico ao cliente) e `system_message` (aviso/broadcast) não têm nenhuma feature real por trás - não existe hoje uma tela de "solicitar documento" nem um "enviar aviso para uma/todas as empresas". Os dois tipos foram adicionados à union e ao mapa de títulos (`NOTIFICATION_TITLES`) pra estarem prontos assim que uma fase futura construir a feature correspondente, mas nenhuma Server Action os dispara - inventar um disparo fake violaria a regra geral do projeto de nunca simular funcionalidade que não existe (mesmo racional do status `conflict` do Omie, Fases 4/5).

## D5 - `integration_status` só in-app, sem e-mail; só em falha, não em sucesso

**Contexto**: o prompt não distingue canal por tipo de notificação.

**Decisão**: uma falha de sincronização com o Omie é um evento operacional interno (só a WJB vê), não urgente o bastante pra justificar e-mail a cada tentativa - e quem clicou em "Sincronizar" já vê o erro na hora, inline (por isso `excludeActorId`). Sucesso não gera notificação nenhuma (o próprio painel de integrações já mostra o status atualizado). Reconsiderar se o volume de sincronizações crescer a ponto de precisar de um resumo por e-mail.

## D6 - `account_security` sempre com e-mail, mesmo em reativação

**Contexto**: uma conta suspensa não consegue logar pra ver uma notificação in-app.

**Decisão**: `notifyAccountSecurity` sempre envia e-mail (além de gravar a notificação in-app, que fica esperando caso a pessoa volte a ter acesso) - é o único canal garantido de alcançar alguém que talvez não consiga entrar na plataforma. Assunto sempre genérico ("Alteração de segurança na sua conta"), nunca revela o motivo específico no assunto - só no corpo, que é o esperado.

## D7 - Mobile não verificado visualmente nesta sessão

**Contexto**: o critério de aceite do prompt inclui "Mobile".

**Decisão**: sem ferramenta de captura de tela/navegador disponível nesta sessão, a verificação foi por revisão de código - todos os componentes novos (`SupportCard`, `NotificationsList` reescrito) reaproveitam padrões já usados e validados no resto do site (`Container`, `buttonVariants`, `flex-wrap`, sem largura fixa) e não introduzem nenhum layout novo de alto risco (grid complexo, tabela larga). Recomendado validar visualmente num dispositivo real antes de publicar, mesma ressalva já registrada em fases anteriores quando a ferramenta de navegador não estava disponível.
