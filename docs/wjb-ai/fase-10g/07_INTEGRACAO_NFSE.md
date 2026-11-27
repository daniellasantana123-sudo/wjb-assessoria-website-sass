# Fase 10G - Integração NFS-e

**Situação:** desenvolvimento desbloqueado, operações reais bloqueadas (sem certificado seguro, sem cofre e sem autorização). Nenhuma chamada ao governo nesta fase.

## 1. Estado técnico (o que já existe e está testado)
| Item | Situação | Teste |
| --- | --- | --- |
| Contrato oficial da API | caminhos de emissão, DPS, consulta pela chave e eventos conferidos no **Manual dos Contribuintes v1.0 (17/03/2025)**; URL base e JSON ainda **inferidos** | `wjb-fase10f-nfse.test.ts` |
| Consulta da NFS-e pela chave (`GET /nfse/{chaveAcesso}`) | implementada nos transportes oficial (fechado pelo portão) e simulado; 404 = não encontrada, o resto é indeterminado | 5/5 |
| Geração da DPS e XML | validada nos XSD oficiais (produção v1.01, produção restrita NT 009 r1 e r2) | testes de contrato com `xmllint` |
| Assinatura digital | XMLDSig preparada e conferida por verificação independente (OpenSSL); **recusada para certificado real** enquanto o algoritmo não for confirmado na documentação vigente | `wjb-ai-xmldsig.test.ts` |
| Cancelamento (e101101) e substituição (grupo `subst`) | XML validado no XSD do release 2; elegibilidade e auditoria só com códigos | Fase 10D |
| Rejeições | catálogo oficial do Anexo I (produção e produção restrita) | Fase 6 e 10B |
| Tratamento de erros | só 400/422 com código `E\d{4}` vira rejeição; o resto é indeterminado e vai para conciliação, nunca reenvio às cegas | Fase 10B |
| Logs de auditoria e permissões | trilha sem dado pessoal; ninguém tem `fiscal.submit`; MFA nas ações críticas | Fases 3 a 10A |
| Portão de transmissão | fechado: contrato não confirmado, sem cofre, sem cadeia e revogação reais, interruptor desligado | Fase 10B |

**Homologação oficial (quando houver certificado seguro, cofre e autorização):** checklist do primeiro teste em produção restrita no doc 25 (Fase 5), seção "primeiro teste oficial". Primeiro passo: ler o swagger autenticado e fechar os campos inferidos do contrato.

## 2. Questionário para o contador responsável
Responda cada item com a regra e, se possível, a fonte (lei, manual, nota técnica ou orientação do município). Nada disto será presumido no sistema.

**A. Destinatário (`indDest`)**
1. Nas notas dos clientes atendidos pela WJB, o destinatário do serviço é sempre o próprio tomador? Em que casos não é?
2. Quando o destinatário for diferente do tomador, quais dados dele devemos coletar (grupo `dest`)?
3. Hoje o sistema só gera DPS para envio oficial quando o cliente declara que o destinatário é o tomador. Essa regra está correta como padrão?

**B. Cancelamento**
4. Qual o prazo máximo para cancelar uma NFS-e pelo Sistema Nacional, para os municípios dos clientes? Há prazos diferentes por município?
5. Depois do prazo, qual o procedimento (cancelamento extemporâneo pelo município, nota de substituição, outro)?
6. Quais motivos de cancelamento (códigos do evento e101101) a WJB usa e quem aprova cada pedido?

**C. Substituição**
7. Em quais situações a WJB emite nota de substituição em vez de cancelar?
8. Há limite de valor, de prazo ou de campos que podem mudar na substituição?

**D. Regras municipais**
9. Lista dos municípios dos clientes e, para cada um: convênio ativo no Sistema Nacional (sim ou não, com data), alíquota de ISS por código de serviço e regras de retenção.
10. Há município com regras próprias que exija revisão manual de toda nota?

**E. Regime e tributos**
11. Para clientes do Simples Nacional, qual valor de `regApTribSN` usar em cada caso?
12. IBS/CBS: a WJB vai informar nas notas em 2026? Em quais casos?
13. Quem define o código de tributação nacional (`cTribNac`) e o NBS de cada serviço de cada cliente, e com que frequência isso é revisto?

**F. Operação**
14. Quem na WJB pode aprovar perfis fiscais (`fiscal_profile.approve`)?
15. Procurações eletrônicas (modelo A): quais clientes já outorgaram procuração à WJB na RFB?

## 3. Próximos passos técnicos (sem dependência externa)
- Extrair do manual do ADN (v1.1, 03/11/2026) os contratos de distribuição e DANFSe, como foi feito com o manual de contribuintes.
- Incorporar as respostas do questionário como regras com fonte citada e testes.
