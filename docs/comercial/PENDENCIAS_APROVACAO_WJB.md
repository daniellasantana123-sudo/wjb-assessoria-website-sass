# Pendências que dependem da WJB

Só o que não pode ser resolvido no código sem inventar dados.

| # | Item | Situação | O que a WJB precisa fazer |
| --- | --- | --- | --- |
| 1 | **Teste real de recebimento de lead** | Supabase reativado; envio de teste não feito para não criar lead nem e-mail sem autorização | Enviar um contato de teste pelo site, conferir no Admin e no e-mail de aviso, e apagar o registro. Confirmar que a migration `0023_lead_pipeline.sql` foi aplicada |
| 2 | **Depoimentos** | 8 depoimentos fictícios com o aviso "Depoimentos ilustrativos", mantidos por decisão de 09/11 | Recomendação: trocar por depoimentos reais autorizados por escrito ou retirar a seção. O aviso é pequeno e pode não ser percebido |
| 3 | **CRC no site** | Fora do site por decisão de 09/11 (o número está no código e no JSON-LD) | Confirmar com o CRCSP se a publicidade da organização contábil exige o registro visível. Se exigir, basta pedir que ele volte ao rodapé |
| 4 | **Fotos da equipe** | Iniciais no lugar das fotos | Enviar as fotos oficiais aprovadas (Daniella já tem foto no projeto, aguardando aprovação) |
| 5 | **WhatsApp principal** | Todos os CTAs usam o 1º número cadastrado; os dois aparecem no rodapé e no contato | Confirmar qual é o número comercial principal |
| 6 | **Tags do GA4 no GTM** | Variáveis, acionador e tags criados no GTM, ainda não publicados | Concluir o teste no modo Visualizar e publicar. **Atualizar o acionador "Eventos WJB"**: trocar `newsletter_signup` por `sign_up` e criar a variável `DLV - method` |
| 7 | **Google Ads** | Não iniciado | Conta, ação de conversão "Lead do site" e vínculo com GA4 |
| 8 | **Proteção anti-robô do CDN da Hostinger** | Ativa | Avaliar desligar; bloqueia ferramentas de teste e pode afetar o robô de verificação de anúncios |
| 9 | **Revisão jurídica** | Política de cookies, privacidade e termos são minuta operacional | Revisar antes de campanhas pagas |
