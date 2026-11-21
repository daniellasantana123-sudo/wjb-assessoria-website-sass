# 40 - Fase 8: decisão de avanço (go/no-go)

| Pergunta | Decisão | Por quê |
| --- | --- | --- |
| Pode levar o código da Fase 8 para a `main`? | **Não, ainda não** | depende da aprovação da WJB. O código é seguro com os interruptores desligados (regressão: 96/96), mas publicar exige uma decisão própria, e as migrations 0024-0031 não estão na produção |
| Pode ligar a comercialização na produção? | **Não** | preços, franquias, desconto e textos de aceite estão em rascunho; não há meio de pagamento |
| Pode cobrar de verdade? | **Não** | `isRealBillingEnabled()` é sempre falso; o banco só aceita assinatura simulada |
| Pode conectar o WhatsApp na Cloud API? | **Não** | os 8 itens do checklist do doc 36 estão pendentes, incluindo a autorização sobre o uso atual do número |
| Pode publicar `/emissao-de-notas`? | **Depois da decisão da WJB** | a página não mostra preço e capta só interesse; pode ir ao ar sozinha quando a WJB quiser e o código estiver na `main` |
| A auditoria de responsivo basta? | **Para a homologação, sim. Para o lançamento, não** | falta teste em aparelho real, Firefox, Safari e leitor de tela (doc 37, seção 5) |
| Pode iniciar a Fase 9? | **Só com o pedido da WJB** | proposta abaixo, não iniciada |

## Proposta de Fase 9 (não iniciada)
1. Aprovar os preços e os textos de aceite (WJB e jurídico); criar a migration que permite o status `approved`.
2. Escolher o meio de pagamento e integrá-lo em ambiente de teste (sandbox) do provedor, com autorização própria.
3. Testar em aparelhos reais, Firefox, Safari e leitor de tela.
4. Conectar o WhatsApp, se a WJB autorizar o registro do número (coexistência ou migração).
5. Plano de publicação na produção: aplicar 0024-0031 com backup, interruptores desligados e liberação gradual por empresa.
