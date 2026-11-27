# Fase 10E - Correção definitiva da instabilidade dos formulários no WebKit

**Data:** 26/11/2026. **Situação:** **corrigido e verificado na CI** (Chromium, Firefox, WebKit e iPhone emulado: 216 aprovados, 0 instáveis), sem aumentar retry nem tempo de espera.

## 1. Sintoma
Na CI, os testes do formulário de contato falhavam **na primeira tentativa** no WebKit e no iPhone emulado, e passavam na repetição. Isso aconteceu 3 vezes em 2 execuções.

## 2. Causa: dois defeitos reais, ligados à hidratação do Next.js
| # | Defeito | Prova | Impacto real |
| --- | --- | --- | --- |
| 1 | O formulário não tinha `method`, e o botão aceitava clique **antes da hidratação**. Sem o JavaScript pronto, o navegador fazia o envio nativo: **GET para a mesma página, com nome, e-mail e telefone na URL** | leitura do código: `<form onSubmit noValidate>` sem `method` | a tela recarrega, a confirmação não aparece e **dados pessoais vão para a URL**, e daí para logs, histórico e o `page_view` do analytics |
| 2 | **O que a pessoa digitava antes da hidratação era apagado**: ao registrar os campos, o `react-hook-form` aplicava os valores padrão vazios | experimento com a hidratação atrasada de propósito: o nome digitado voltou vazio (`VALOR_DEPOIS=""`) | num celular lento, a pessoa vê o nome sumir; o envio então falha na validação |

O WebKit da CI é mais lento para hidratar. Por isso o teste preenchia os campos antes da hidratação e falhava; na repetição, com o navegador aquecido, a hidratação vinha antes. **Não era defeito do teste.**

Há ainda um terceiro ponto, achado na mesma revisão: se o validador, baixado sob demanda, **não carregasse** (rede ruim), o envio não fazia nada nem mostrava erro.

## 3. Correção
| Onde | O quê |
| --- | --- |
| `src/hooks/use-hydrated.ts` | `false` no HTML do servidor e até a hidratação; `true` depois |
| Contato (e todos os que usam `LeadForm`: `/contato`, `/solicitar-proposta`, páginas de serviço, assistente Dani), newsletter, pré-cadastro de emissão de notas, ações do Admin | campos dentro de `<fieldset disabled>` até a hidratação; botão desativado até a hidratação; `method="post"` |
| Popup de saída, configuração de MFA, assistente comercial, chat de NFS-e (só aparecem depois de ação no navegador) | `method="post"` como defesa |
| Contato, newsletter, popup | se o validador não carregar, mostra o erro com WhatsApp e e-mail |

Num aparelho comum, a hidratação leva uma fração de segundo. A pessoa não percebe os campos desativados, mas nada do que ela digita se perde.

**Envio duplicado:** continua protegido de duas formas. O botão fica desativado durante o envio, e o `submissionId` faz o servidor ignorar a repetição. Testado com clique duplo: um envio só.

**Confirmação do lead:** a mensagem "Mensagem enviada!" só aparece com resposta de sucesso da API. A conversão (`generate_lead`) só é registrada quando o servidor confirma que gravou.

## 4. Testes (`src/tests/e2e/forms-hydration.spec.ts`, reproduzem a condição)
- com o JavaScript desligado: botão desativado e `method="post"`;
- com a hidratação atrasada de propósito: botão e campos desativados até ficarem prontos; o envio conclui e a URL não leva dados;
- com a hidratação atrasada: **o que foi digitado continua no campo** (o caso que reproduzia o defeito);
- clique duplo: um envio só.

| Execução | Resultado |
| --- | --- |
| Local, Chrome desktop e celular | 104/104 |
| CI Linux, Chromium, Firefox, WebKit e iPhone emulado | 216 aprovados, **0 instáveis** (antes: 3 instáveis) |

**Não testado:** Safari num iPhone ou Mac real, e o teclado virtual do celular.
