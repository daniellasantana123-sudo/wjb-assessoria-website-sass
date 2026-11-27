# Fase 10C - Pendências da WJB

São coisas que só a WJB pode fazer ou decidir. As pendências técnicas, que dependem dessas, estão no relatório (doc 01, seção 6).

## A. Urgentes
| # | Pendência | Quem | Como |
| --- | --- | --- | --- |
| A1 | **Revogar o certificado exposto** e emitir um novo **e-CNPJ** (emitido depois de 26/11/2026) | titular do certificado | na Autoridade Certificadora; guardar o protocolo; senha nova por canal separado, nunca pelo chat |
| A2 | **Diagnosticar o banco de produção** | responsável com acesso ao painel do Supabase | checklist do doc 03, só leitura; trazer só números e `true`/`false` |
| A3 | Cobrar a resposta do **suporte do Supabase** | responsável pela conta | perguntas do doc 04, seção 5 |
| A4 | **Decidir sobre o hotfix do Next.js** | WJB | a produção tem advisories críticos; o hotfix está pronto e testado (doc 02) |

## B. Decisões técnicas e comerciais
| # | Decisão | Opções / recomendação |
| --- | --- | --- |
| B1 | Provedor do cofre de certificados | AWS Secrets Manager ou Azure Key Vault (recomendado para o 1º teste); custo de cerca de US$ 0,40/certificado/mês na AWS (doc 06) |
| B2 | Responsável pela conta do cofre e pelo MFA | uma pessoa da WJB |
| B3 | Chaves **de teste** da Stripe | gravadas pela pessoa autorizada com o script (doc 08), nunca pelo chat |
| B4 | Agendar a rota de alertas (avisos de vencimento do certificado) | aprovar o agendamento quando o módulo for ligado |
| B5 | Plano do Supabase de produção com backup | plano pago com backup diário (o gratuito pausa e não guarda backup acessível) |

## C. Validação do responsável contábil
| # | Pergunta |
| --- | --- |
| C1 | `indDest`: nos serviços que a WJB emitirá, o destinatário pode ser diferente do tomador? Se sim, quais dados do grupo `dest` coletar? (doc 07, seção 2) |
| C2 | Cancelamento: quais motivos (1, 2 ou 9) e prazos a WJB vai aceitar, e quem aprova? |
| C3 | Substituição: em que casos a WJB substitui em vez de cancelar? |

## D. Já decidido (registro)
- Certificado antigo bloqueado por regra; certificados de teste só fictícios.
- WhatsApp só Click-to-Chat (+55 11 97614-6375); o 2º número continua só na configuração.
- Nenhuma emissão oficial, cobrança real, produção ou IA externa sem autorização específica.
- Link by Stripe: fora, porque não há suporte da Stripe para empresa brasileira (doc 08).
