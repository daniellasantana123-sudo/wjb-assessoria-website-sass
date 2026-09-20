# Decisões - Fase 6.5

## D1 - Remover a implementação real em vez de corrigir "no lugar"

**Contexto**: `omie.adapter.ts` (Fase 4) chamava a API do Omie ERP, comprovadamente a API errada para esta integração (ver `audit-report.md` Gap G1). Corrigir o payload/endpoint "no lugar" exigiria conhecer o schema real da G-Click, que não está confirmado nesta sessão.

**Decisão**: remover o arquivo inteiro, em vez de deixá-lo lá "quase certo" ou tentar adivinhar a correção. `provider.ts` passa a sempre devolver o adapter no-op. A interface `OmieGClickAdapter` (contrato) foi preservada - é provider-agnóstica e continua válida; só a implementação concreta incorreta foi removida. Isso é consistente com a regra do prompt "preservar interfaces válidas" e evita o risco de um código "quase funcional" ser reativado no futuro por engano sem que alguém perceba que ainda está errado.

## D2 - Não inventar nomes de variável de ambiente novos

**Contexto**: o prompt sugere `GCLICK_CLIENT_ID`/`GCLICK_CLIENT_SECRET`/`GCLICK_API_BASE_URL` como nomes preferíveis, "se confirmados pela documentação".

**Decisão**: não introduzir esses nomes agora. A documentação oficial confirma QUE existe um fluxo de "gerar credenciais" -> token, mas não confirma os nomes exatos dos parâmetros de entrada desse endpoint (poderia ser client_id/secret, poderia ser e-mail/senha da conta G-Click, poderia ser uma chave única emitida por suporte). Introduzir `GCLICK_CLIENT_ID`/`GCLICK_CLIENT_SECRET` sem essa confirmação seria assumir uma forma de OAuth client-credentials que não foi provada - o mesmo tipo de erro que causou o Gap G1, só em um nível mais abstrato. `OMIE_APP_KEY`/`OMIE_APP_SECRET` foram simplesmente removidas, sem substituto ainda. Ver `credentials-model.md` para os nomes candidatos registrados (não implementados).

## D3 - CTA do Portal: URL fixa confirmada como fallback, não como valor único

**Contexto**: a documentação oficial confirma uma URL de login única (`https://visao.gclick.com.br/login`) para todos os clientes.

**Decisão**: usar essa URL como fallback quando `external_portal_url` não está configurado, mas **não remover** o campo manual - a mesma documentação menciona personalização visual do portal, então um domínio próprio no futuro não é descartado. Isso é uma correção aditiva e não-destrutiva: nenhuma migration foi alterada, o campo continua existindo com o mesmo propósito (override manual), só ganhou um valor padrão sensato em vez de exigir preenchimento sempre.

## D4 - Classificação final: `BLOCKED_BY_PROVIDER`, não `BLOCKED_BY_CREDENTIALS`

**Contexto**: o prompt define dois estados de bloqueio possíveis. `BLOCKED_BY_CREDENTIALS` implica que "toda a arquitetura foi validada" e "a única pendência é conexão/teste com credencial real".

**Decisão**: classificar como `BLOCKED_BY_PROVIDER`, não `BLOCKED_BY_CREDENTIALS`, porque falta mais que credenciais - falta a própria especificação técnica (host, schema de request/response, formato do token) que só existe na documentação Postman, inacessível nesta sessão. Mesmo com credenciais reais em mãos hoje, não seria possível implementar `upsertClient`/`testConnection` corretamente sem inventar o schema. Ver `phase-handoff.md` para o que isso implica no gate da Parte 22 do prompt (que só autoriza `VALIDATED` ou `BLOCKED_BY_CREDENTIALS` a prosseguir pra Fase 7).

## D5 - Não implementar "tarefas"/"pré-tarefas" mesmo com mais clareza sobre o produto

**Contexto**: esta auditoria confirmou que "Listar tarefas"/"Criar pré-tarefa" existem e não são `partner_only` - poderia parecer motivo para implementá-los agora.

**Decisão**: manter fora do escopo. "Existir e não ser partner-only" não é o mesmo que "ter schema técnico confirmado" - a mesma limitação de acesso ao Postman que bloqueia `upsertClient` também bloqueia esses dois. Implementar sem o schema real repetiria o erro do Gap G1 (documentação real, aplicação incorreta do formato).
