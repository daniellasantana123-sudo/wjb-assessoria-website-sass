# Fase 10F - Pendências e autorizações

## 1. Autorizações necessárias (nenhuma foi presumida)
| # | Autorização | Para quê | Doc |
| --- | --- | --- | --- |
| 1 | **Decisão sobre as prévias da Hostinger** (desligar no painel, fechar o PR #1 ou aceitar o risco) | a prévia da 10C grava na produção | 01 |
| 2 | **Deploy dos hotfixes A (prévias) e B (formulários)** | proteção das prévias futuras e correção de privacidade | 08 |
| 3 | Proteção da `main` (seção 3) | impedir push direto e exigir CI | este |
| 4 | Merge da 10C a 10F e migrations 0024 a 0038 em lotes | publicar o módulo, desligado | 08 |
| 5 | Qualquer operação no banco de produção, inclusive recuperação em projeto separado | auditoria e incidente | 02 |
| 6 | Contratação do cofre (≈ US$ 1 a 2/mês no modelo A) | certificado real | 05 |
| 7 | Uso de certificado real, chamada ao governo, emissão e cobrança reais | operação | 04, 06 |

## 2. Pendências externas
| Responsável | Pendência | Bloqueia |
| --- | --- | --- |
| WJB | rodar `auditoria-somente-leitura.sql` e enviar o CSV | caminho de recuperação, merge |
| WJB | conferir Backups/PITR no painel e **enviar o chamado ao Supabase** (texto pronto no doc 02) | recuperação |
| WJB | pedir à Hostinger os logs de acesso (prévia desde 26/11; período vulnerável do Next.js) | investigação |
| WJB | desligar as prévias da Hostinger | novos PRs |
| WJB (Stripe) | gravar as chaves de **teste** com `configurar-chaves.mjs` e criar o webhook de teste | Sandbox real (11 cenários) |
| WJB (Stripe) | confirmar com a Stripe se a conta tem Pix Automático; decidir sobre boleto | ligar esses métodos |
| WJB | decidir onde ficam os honorários (Omie ou Stripe, por cliente) | cobrança de honorários |
| WJB | aprovar preços (seção 4) | catálogo além da emissão de notas |
| Titular do certificado | revogar o exposto e emitir o novo com **novo par de chaves** | certificado real |
| Contador | `indDest`, destinatário diferente do tomador, regras municipais, prazos de cancelamento, substituição | emissão oficial |
| WJB (GA4) | procurar `page_location` com `email=`/`phone=` e pedir exclusão se houver | privacidade |
| Responsável no GitHub | acompanhar o repositório (*Watch*) com e-mail ligado, para receber os alertas | alertas das rotinas |

## 3. Proteção da `main` (pronta, NÃO aplicada)
Pré-requisito: `qa.yml` precisa estar na `main` para as verificações existirem. Sem isso, exigir verificações trava todo merge. Comando para quem tem permissão de administrador, **só depois da autorização**:

```sh
gh api -X PUT repos/daniellasantana123-sudo/wjb-assessoria-website-sass/branches/main/protection \
  -H "Accept: application/vnd.github+json" --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "checks": [
      { "context": "estatico" },
      { "context": "unitarios (22)" },
      { "context": "unitarios (24)" },
      { "context": "banco" },
      { "context": "e2e" }
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": { "required_approving_review_count": 1, "dismiss_stale_reviews": true },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON
```
- `enforce_admins: false` deixa o administrador publicar um **hotfix de segurança** sem PR, como no Next.js, com aprovação expressa do Product Owner. Para fechar também essa porta, trocar para `true`.
- **Antes**, desligar as prévias: com a proteção, todo merge passa por PR, e todo PR cria prévia.
- Revisão de migrations, detecção de segredos, auditoria de dependências, isolamento entre empresas e Node.js 22/24 já estão nos jobs exigidos (doc 05 da 10E).

## 4. Catálogo comercial para a Stripe
Regra: **nenhum preço novo foi criado**. Só entra na Stripe o que estiver aprovado no catálogo do banco.

| Categoria | Preço existente no projeto | Situação para a Stripe |
| --- | --- | --- |
| Planos de emissão de notas (5) e combo de 20% | aprovados em 21/11 (Fase 9), versionados no banco | **pronto** (modo de teste) |
| Honorários contábeis mensais | só valores "a partir de" (MEI R$ 120, Simples R$ 350, Presumido R$ 700, planilha de 05/09) e a matriz de acréscimos, hoje fora do site por decisão da WJB (21/09) | **aguardando decisão**: o valor final é por cliente; precisa de proposta aprovada por cliente ou tabela aprovada para cobrança |
| Abertura de empresa, alterações contratuais, regularizações, certidões, serviços fiscais, consultorias, serviços adicionais | nenhum preço no projeto | **aguardando aprovação**; a estrutura já aceita (`servico_avulso:<código>`, pagamento avulso `mode=payment`) |

Nos testes, valores **fictícios** são marcados como tal no próprio teste (ex.: "R$ 10,00, valor FICTÍCIO de teste").

## 5. Riscos
| Risco | Situação | Mitigação |
| --- | --- | --- |
| Prévia com `.env` de produção | aberta; só 2 inícios do processo, ambos nossos | doc 01; pacote A |
| Banco de produção | estado desconhecido; problema desde 12-13/10 | doc 02 |
| Exposição de dados de formulário em URL | corrigida no pacote B; nos logs da aplicação: 0 ocorrências | doc 08, seção 6 |
| Rotinas falhando sem aviso | alertas prontos; valem depois do merge | doc 02, seção 6 |
| Bloqueio de Host derrubar a produção | evidência indireta de que o `Host` chega certo; saída por `WJB_ALLOWED_HOSTS` | doc 08, seção 3 |
| Cobrança em dobro (Stripe e Omie) | origem única no banco (0038), só na homologação | doc 07 |
