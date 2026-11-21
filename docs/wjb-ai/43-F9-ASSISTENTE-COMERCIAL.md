# 43 - Fase 9: assistente comercial (Dani) no site

## 1. Auditoria antes de mudar
A Dani (`src/components/assistant/`, `src/lib/assistant/`) é um fluxo determinístico: menu, resposta do serviço, qualificação pelo `LeadForm` e WhatsApp. Ela não usa modelo de IA. Nada do que existia foi removido: o menu, as saudações por página, o link direto `/dani`, o formulário e o caminho para o especialista continuam iguais.

## 2. O que foi acrescentado
| Item | Onde |
| --- | --- |
| Item de menu "Emitir notas fiscais (NFS-e)". **Só aparece** quando o catálogo comercial responde, ou seja, com o interruptor ligado | `assistant-config.ts`, `AssistantPanel` |
| Tela comercial com perguntas fechadas: o que você precisa (emissão, contabilidade, combo, alto volume, emitir agora). Na emissão: MEI, ME/EPP ou profissional, ou já cliente de contabilidade | `src/lib/assistant/commercial-flow.ts`, `AssistantCommercial.tsx` |
| Classificação de texto livre **sem IA** (palavras-chave). O texto fica só na tela: não é guardado nem enviado. A tela avisa para não escrever CPF, CNPJ nem dados de notas | `classifyCommercialText` |
| Respostas com os valores do catálogo **aprovado**, buscados no servidor (`/api/commercial/catalog`, que responde 404 com o interruptor desligado). Sem catálogo, a Dani não cita preço | `commercialAnswer` |
| Encaminhamento: lista de interesse (com o plano já marcado no formulário) e WhatsApp da intenção | ações `route` e `whatsapp` |
| "Quero emitir uma nota agora": explica que a emissão não está disponível, que o emissor público é gratuito, e oferece registrar interesse. A Dani **nunca** diz que uma nota foi emitida (teste unitário) | `emitirAgora` |
| Saudação própria em `/emissao-de-notas` | `assistantPageGreetings` |
| Funil: a escolha vira `select_service` com `service_id` = `nfse_<intenção>`, pela camada já existente, que descarta dado pessoal e depende de consentimento | `trackAssistantEvent` |

## 3. Chat do site não é bot de WhatsApp
Os botões de WhatsApp da Dani só abrem a conversa com mensagem pronta (doc 42). A Dani não lê nem responde nada dentro do WhatsApp.

## 4. Testes
- Unitários: as três jornadas e o MEI, as respostas com valores, o desconto só na mensalidade, nenhum preço sem catálogo, nunca "nota emitida", a classificação de 8 frases e os encaminhamentos.
- E2E (homologação): MEI recebe R$ 24,90 e o link do MEI Digital; o texto livre "contabilidade e emissão de notas" vira combo (20%); "emitir agora" explica a indisponibilidade e leva à lista de interesse; "contabilidade completa" leva a `/planos`.
- Responsivo: o painel com a resposta comercial cabe na tela em 320x568, 390x844 e 844x390 (doc 45).
