# Checklist - pronto para Google Ads

| # | Item | Situação |
| --- | --- | --- |
| 1 | Páginas de serviço com CTA, formulário e WhatsApp contextual | Feito (Fase 3) |
| 2 | Formulário com validação, anti-spam e deduplicação | Feito (Fase 4) |
| 3 | UTMs, `gclid` e página de entrada gravados com o lead | Feito (Fase 4) |
| 4 | Lead gravado no banco | **Bloqueado**: Supabase pausado; migration `0023_lead_pipeline.sql` pendente |
| 5 | Camada de eventos sem dado pessoal, com deduplicação | Feito (Fase 6) |
| 6 | Consent Mode v2 e revogação ("Preferências de cookies") | Feito (Fase 6) |
| 7 | CSP liberando os domínios do Google | Feito (Fase 6) |
| 8 | Política de cookies citando GA4 e Google Ads | Feito; aparece só quando o GTM estiver ligado. Revisão jurídica recomendada |
| 9 | ID do contêiner GTM no código | **Pendente WJB** |
| 10 | Tags GA4 e Google Ads configuradas no GTM | **Pendente WJB** (passo a passo em `PLANO_TRACKING_GA4_GTM_WJB.md`) |
| 11 | Teste no modo Visualizar + DebugView | Pendente, depois do item 10 |
| 12 | Conta do Google Ads vinculada ao GA4 e ao Search Console | Pendente WJB |
| 13 | Proteção anti-robô do CDN da Hostinger | Pendente WJB; pode atrapalhar o robô de verificação de anúncios |
| 14 | Velocidade mobile | LCP ~2 s com limitação real (Fase 5) |
| 15 | Conversões offline (lead qualificado, contrato) | Futuro: importação pelo `gclid` |
