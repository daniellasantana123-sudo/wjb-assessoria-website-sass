# Fase 10G - Pendências externas

| # | Responsável | Pendência | Bloqueia | Doc |
| --- | --- | --- | --- | --- |
| 1 | WJB (hPanel) | **desligar as prévias automáticas da Hostinger** | PR seguro, proteção da `main` | 01 |
| 2 | WJB (Hostinger) | pedir os logs de acesso da prévia (26/11 21:56 a 27/11 15:29 UTC) e do período vulnerável do Next.js | encerrar a investigação | 01 |
| 3 | WJB (Supabase) | rodar a auditoria somente leitura e enviar o CSV | caminho de recuperação, merge | 02 |
| 4 | WJB (Supabase) | conferir Backups/PITR e enviar o chamado (texto revisado) | recuperação | 02 |
| 5 | WJB (Stripe) | configurar as chaves de **teste** com o script; criar o webhook de teste | Sandbox real | 03 |
| 6 | WJB (Stripe) | ligar Pix, boleto, Apple Pay e Google Pay no modo de teste; confirmar o Pix Automático | métodos | 03 |
| 7 | WJB (comercial) | aprovar preços dos novos serviços | catálogo | 04 |
| 8 | WJB (equipe) | registrar no Admin as origens de cobrança dos clientes atuais (honorários no Omie) | contratação segura pela Stripe | 04 |
| 9 | WJB (AWS) | aprovar a conta e o custo (≈ US$ 1 a 3/mês) | cofre | 05 |
| 10 | Titular do certificado | revogar o exposto; emitir o novo com novo par de chaves | certificado real | 06 |
| 11 | Contador | responder o questionário (`indDest`, cancelamento, substituição, municípios, regime) | emissão oficial | 07 |
| 12 | Administrador do GitHub | autorizar e aplicar a proteção da `main` (depois do `qa.yml` na `main`) | governança | 08 |
| 13 | Responsável no GitHub | acompanhar o repositório (*Watch*) com e-mail ligado | receber os alertas | 02 |
| 14 | WJB (GA4) | procurar `page_location`/`page_referrer` com `name=` ou `phone=` e pedir exclusão se houver; ignorar os acessos de validação (`utm_source=validacao10g`) | privacidade | 01 |
| 15 | Quem tiver iPhone ou Mac | roteiro manual de 5 minutos no Safari real | evidência em Safari | 09 |

## Autorizações necessárias
- Publicar `hotfix/alertas-rotinas` (só workflows e scripts).
- Publicar o `qa.yml` na `main` e aplicar a proteção.
- Merge da 10C a 10G; migrations em produção.
- Qualquer operação no banco de produção, inclusive recuperação em projeto separado.
- Contratação do cofre; uso de certificado real; cobrança e emissão reais.
