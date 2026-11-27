# Fase 10H - Integração NFS-e (validação)

**Situação:** validação simulada concluída nesta fase; operações reais **bloqueadas** (certificado, cofre, contrato no swagger, regras do contador). Nenhuma chamada ao governo, nenhum endpoint ou regra inventados. Nenhum código fiscal mudou nesta fase.

| Item | Como foi validado nesta fase | Resultado |
| --- | --- | --- |
| Consulta da NFS-e pela chave (`GET /nfse/{chaveAcesso}`, Manual dos Contribuintes v1.0) | unitários oficial e simulado | aprovado (na suíte de 767) |
| DPS e XML nos XSD oficiais (produção, produção restrita r1 e r2) | `xmllint` na CI Linux (unitários Node 22 e 24) | aprovado |
| Assinatura digital simulada (XMLDSig) | verificação independente com OpenSSL | aprovado |
| Emissão simulada, revisão, fila, rejeições, histórico de eventos | staging na homologação (`staging-nfse*`, login real com MFA) | **49/49** (com Admin e certificados) |
| Cancelamento e substituição | XML no XSD do release 2; elegibilidade e auditoria (unitários 10D) | aprovado |
| Logs de auditoria (sem dado pessoal) e permissões (ninguém tem `fiscal.submit`; aprovação só com `fiscal_profile.approve`) | staging + banco (job `banco`) | aprovado |
| Isolamento entre empresas | banco (RLS) + staging | aprovado |

**Para a homologação oficial:**
- [ ] certificado novo (doc 08);
- [ ] cofre (doc 07);
- [ ] swagger autenticado lido e contrato fechado;
- [ ] respostas do contador ao questionário (doc 07 da 10G);
- [ ] autorização expressa;
- [ ] primeiro teste em produção restrita (checklist do doc 25, seção 7).
