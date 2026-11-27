# Fase 10F - Integrações governamentais e NFS-e

**Situação:** desenvolvimento desbloqueado; **operações reais bloqueadas**. Nenhuma chamada ao governo foi feita: sem certificado legítimo, sem cofre e com o portão de transmissão fechado. Só documentação pública foi lida.

## 1. Contratos conferidos em fonte oficial (novo nesta fase)
Fonte principal: **Manual dos Contribuintes - Emissor Público Nacional API v1.0 (17/03/2025)**, baixado de gov.br/nfse (Documentação atual) e lido localmente (texto extraído do PDF num ambiente descartável, sem dependência nova no projeto). Complemento: FAQ v1.5 (23/11/2026).

| Operação | Caminho | Status no código | Fonte |
| --- | --- | --- | --- |
| Emissão (DPS → NFS-e, síncrona) | `POST /nfse` | confirmado | Manual, 1.3.2 a |
| **Substituição** | o próprio `POST /nfse`, com a DPS trazendo a chave da nota substituída; a SEFIN gera o evento de cancelamento por substituição | confirmado | Manual, 1.3.2 a |
| **Consulta da NFS-e pela chave** | `GET /nfse/{chaveAcesso}` | **novo: confirmado e implementado** (`queryNfse`) | Manual, 1.3.2 b |
| Chave pela DPS | `GET /dps/{id}` (só ator da nota) | confirmado | Manual, 1.4.2 a; FAQ 26.4 |
| NFS-e gerada? | `HEAD /dps/{id}` (qualquer certificado válido) | confirmado | Manual, 1.4.2 b |
| **Eventos** (cancelamento e101101, manifestação) | `POST /nfse/{chaveAcesso}/eventos` | **era "pendente", passou a confirmado** | Manual, 1.5.2 a |
| Consulta de eventos | `GET /nfse/{chaveAcesso}/eventos[/{tipoEvento}[/{numSeqEvento}]]` | **novo: confirmado** | Manual, 1.5.2 b, c, d |
| Parâmetros municipais | `GET /parametros_municipais/{codigoMunicipio}/convenio`, `/{codigoServico}`, `/{CPF/CNPJ}` | registrado (não usado) | Manual, 1.2 |
| URL base da API | `https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional` | **corrigido para "inferido"**: a página oficial só publica o endereço do swagger | gov.br/nfse, APIs prod. restrita e produção |
| mTLS com "Autenticação de Cliente" | obrigatório | confirmado | FAQ 17.1 e 17.7 |
| Campo JSON da DPS, formato de erro, códigos HTTP | continuam **inferidos ou pendentes** | sem fonte pública | só no swagger autenticado |

**Consequência:** o portão de transmissão continua **fechado**, porque ainda há campos não confirmados (`requestDpsField`, `responseErrorsField`, `requestEventField`, `baseUrl`...). Isso é intencional: nada é inventado.

## 2. O que avançou no código
- **Consulta da NFS-e pela chave** (`SefinTransport.queryNfse`): transporte oficial monta `GET` no caminho do manual; só 404 = "não encontrada"; 403, 5xx e redirecionamento = **indeterminado** (nunca conclui nada); chave fora do formato é recusada antes de qualquer chamada. O transporte simulado aplica a mesma regra de sigilo (só ator da nota). Testes: `wjb-fase10f-nfse.test.ts`, **5/5**.
- **Contrato com fonte exata** em `official-transport.ts`: cada campo cita a seção do manual.

## 3. Já existente e preservado (Fases 7 a 10D)
Emissão simulada; geração da DPS e validação no XSD oficial (produção v1.01, produção restrita NT 009 r1 e **r2**); assinatura XMLDSig preparada (bloqueada para certificado real até o algoritmo ser confirmado na documentação vigente); XML do cancelamento `e101101` e do grupo `subst` validados no XSD do release 2; catálogo oficial de rejeições (Anexo I); histórico por eventos; auditoria só com códigos; permissões (ninguém tem `fiscal.submit`).

## 4. Pendente de validação contábil (não presumido)
| Ponto | Situação no código |
| --- | --- |
| `indDest` e destinatário diferente do tomador | 0 só com declaração explícita `recipientIsTaker: true`; sem ela, não gera DPS para envio oficial |
| Regras municipais (convênio, alíquota, regime) | regras oficiais do Anexo I implementadas; parâmetros do município não são consultados |
| Prazos de cancelamento | não codificados: a SEFIN decide e a rejeição volta com o código oficial |
| Condições de substituição | XML validado no XSD; regra de negócio aguarda o contador |

## 5. Mapa de integrações futuras
| Integração | Pré-requisitos |
| --- | --- |
| SEFIN Nacional, produção restrita | certificado novo, cofre, swagger lido com certificado legítimo, autorização |
| ADN (distribuição `GET /DFe/{NSU}`, DANFSe, parâmetros) | os mesmos; contratos só no swagger do ADN |
| Consulta pública | página web aberta com a chave de acesso (`www.nfse.gov.br/consultapublica`, FAQ 26.3); uso automatizado não avaliado |
| Produção | homologação concluída em produção restrita + aprovação expressa |

**Sugestão para a próxima fase:** extrair o texto do manual do ADN para contribuintes (v1.1, 03/11/2026) e do manual de decisão administrativa ou judicial, do mesmo modo, para mapear o ADN sem depender do swagger.
