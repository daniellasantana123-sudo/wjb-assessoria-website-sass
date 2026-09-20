# Decisões - Fase 3

## D1 - Módulo de documentos já existia; esta fase endureceu, não recriou

O prompt descreve um "MVP" de documentos que, na prática, já estava construído e validado desde a SAAS FASE 2 (2026-09-16) - tabela, bucket, upload, listagem, exclusão, RLS, limite de tamanho, auditoria de upload/exclusão. Nenhuma tabela nova foi criada, nenhuma rota de listagem/upload foi refeita do zero. O trabalho real desta fase foi fechar gaps de segurança/observabilidade que o prompt pedia e que genuinamente não existiam - ver `architecture.md`.

## D2 - Busca só em `/portal/documentos` e `/portal/guias`, não no Admin

`DocumentsList` é reaproveitada em 3 lugares: as duas páginas do Portal (uma lista por página, um `?q=` cada) e `/admin/empresas/[id]` (duas listas - Documentos e Guias - na MESMA página). Um único `?q=` na URL do Admin colidiria entre as duas listas (ou exigiria nomes de parâmetro distintos e lógica de merge de query string pra não perder o filtro de uma lista ao submeter o da outra). Como staff normalmente lida com poucos documentos por empresa de cada vez (não é o mesmo volume que um usuário revisando meses de guias), a busca não foi adicionada lá nesta fase - a prop `searchAction` é opcional, então o Admin continua funcionando exatamente como antes.

## D3 - "Filtros" do MVP: categoria (já existia) + busca (nova), sem inventar mais dimensões

O prompt pede "categorias" e "filtros" como itens separados do MVP. Categoria já existia (Documentos x Guias, rotas separadas). Não adicionei filtro por data ou por quem enviou - nenhuma necessidade concreta foi identificada pra isso, e inventar campos de filtro sem um caso de uso real teria sido especular. Reconsiderar se o usuário pedir explicitamente.

## D4 - `document.category_changed` não foi implementado

O prompt lista essa ação de auditoria, mas não existe (e não foi criada) nenhuma funcionalidade de "mudar a categoria de um documento depois de enviado" - hoje a categoria é escolhida no momento do upload e não muda depois (mesmo texto de `0005_documents_table.sql`: "documento é substituído por um novo envio, não editado"). Auditar uma ação que não existe seria simular uma feature falsa. Se essa funcionalidade for pedida numa fase futura, o `entity`/`action` já está definido no prompt e pode ser usado sem mudança.

## D5 - Antimalware: ponto de extensão real, sem simular um scanner

O adapter sempre retorna `{ clean: true }` porque nenhum provider de antivírus foi confirmado (ClamAV, VirusTotal, ou qualquer outro) - implementar uma verificação "de mentira" (ex.: checar assinatura de arquivo manualmente sem uma base de definições real) daria uma falsa sensação de proteção. A estrutura (Adapter Pattern, ponto de chamada em `uploadDocument`) está pronta; só falta a WJB escolher e confirmar um provider.

## D6 - TTL da URL assinada de download: 60 segundos, não os 10 minutos de antes

Antes, a URL de 10 minutos precisava durar o tempo da pessoa olhar a lista inteira e eventualmente clicar em algum documento. Agora que a URL só é gerada no momento do clique (via redirect), 60 segundos é mais que suficiente pro navegador completar o redirect - e reduz a janela em que uma URL vazada (ex.: em um proxy corporativo, em logs de rede) continuaria válida.
