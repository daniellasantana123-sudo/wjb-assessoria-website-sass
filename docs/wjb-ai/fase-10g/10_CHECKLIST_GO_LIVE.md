# Fase 10G - Checklist de go-live

Legenda: ✅ feito e verificado · ⏳ aguardando terceiro · 🔒 aguardando autorização · ⛔ bloqueado por dependência

## 1. Já em produção (27/11)
- ✅ Next.js 16.4.6 (26/11).
- ✅ Formulários só por POST depois de carregados; dados retirados da URL e da origem enviada ao GA4 antes de qualquer tag.
- ✅ Servidor só atende o domínio oficial; prévias `*.hostingersite.com` recebem 421.
- ✅ Prévia do PR #1 removida.

## 2. Antes de publicar as Fases 10C a 10G
- ⏳ Auditoria do banco de produção analisada (`analisar-auditoria.mjs`), caminho decidido, backup ou PITR confirmado (doc 02).
- ⏳ Resposta do Supabase ao chamado e backup anterior a 12/10 preservado, se existir.
- ⏳ Prévias desligadas no hPanel (doc 01).
- 🔒 `qa.yml` na `main` e proteção da `main` (doc 08).
- 🔒 Publicar os alertas das rotinas (`hotfix/alertas-rotinas`, sem migration).
- 🔒 Merge da 10C a 10G, auditado, com CI verde.
- 🔒 Migrations 0024 a 0038 em lotes, cada uma com backup testado; chaves `WJB_*` desligadas.

## 3. Antes de ligar pagamentos
- ⏳ Chaves de teste da Stripe e Sandbox real com os 13 cenários (doc 03).
- ⏳ Métodos ligados no Dashboard (Pix, boleto, Apple/Google Pay); confirmação do Pix Automático com a Stripe.
- ⏳ Preços aprovados dos novos serviços (doc 04).
- ⏳ Origens de cobrança dos clientes atuais registradas no Admin (doc 04).
- 🔒 Chaves de produção da Stripe e `WJB_PAYMENTS_ENABLED` (cobrança real).

## 4. Antes da emissão fiscal oficial
- ⛔ Certificado novo, com novo par de chaves (doc 06).
- 🔒 Cofre AWS aprovado e configurado (doc 05).
- ⏳ Respostas do contador ao questionário (doc 07).
- ⛔ Swagger autenticado lido; contrato da API fechado.
- 🔒 Primeiro teste em produção restrita (checklist do doc 25, seção 7).
- 🔒 Produção fiscal.

## 5. Depois de cada publicação
- `bash scripts/wjb-ai/producao/monitorar.sh --servidor` sem falhas. Ler os cabeçalhos mais de uma vez; o otimizador de imagens precisa dar 200.
- Validação do GTM com a coleta **bloqueada** (doc 01, seção 3).
- Rotina de lembretes do dia seguinte com `ok: true`.
