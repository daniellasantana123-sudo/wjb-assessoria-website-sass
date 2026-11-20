# 24 - Fase 4: integração fiscal oficial (análise e conector em modo simulado)

**Data:** 20/11/2026 · **Status:** pesquisa da documentação oficial + conector **simulado** com testes de contrato. **Nenhum certificado, nenhuma chamada ao governo, nada em produção.**

## 1. Como foi feita a análise
Dois agentes especializados (integrações governamentais e fiscal) leram páginas públicas do gov.br/nfse; a planilha oficial do **Anexo I v1.01** (leiaute DPS/NFS-e) foi extraída localmente (somente leitura). Limites honestos:
- **Swagger da SEFIN Nacional e do ADN não puderam ser lidos**: SEFIN responde 403 e o ADN falha no TLS sem certificado de cliente. Nomes de campos JSON, esquema de erro e códigos HTTP exatos **não foram conferidos**.
- Anexo VI (regras IBS/CBS), XSD v1.01 e notas técnicas em PDF não foram lidos por inteiro.
- O Manual Integrado de 2022 está **superado**; o que vem só dele (ex.: assinatura RSA-SHA1, namespace, TLS 1.0) está marcado como **a conferir**.

## 2. Fatos confirmados (fonte oficial)
| Tema | Fato | Fonte |
| --- | --- | --- |
| Versões | Produção: XSD v1.01 e Anexo I v1.01 (09/02/2026); leiaute em produção é o da NT 004 v2.0 até 30/11/2026. Produção restrita: Anexos e XSD de 20/10/2026 com o release 1 da NT 009 (IBS/CBS). NT 009 releases 1-3 previstos para produção em 01/12/2026 | gov.br/nfse - Documentação atual, Produção restrita, notícias de 20/10 e 29/10/2026 |
| Emissão | `POST /nfse` **síncrono** (rejeição ou NFS-e); substituição pelo próprio POST | Manual de Contribuintes - Emissor Público API v1.2 |
| Consulta | `GET /nfse/{chave}`; `HEAD /dps/{id}` (DPS já gerou nota?); `GET /dps/{id}` (chave, só para atores) | idem |
| Eventos | `POST/GET /nfse/{chave}/eventos[...]` | idem |
| Parâmetros municipais | `GET /parametros_municipais/{mun}/convenio` e `/{mun}/{codigoServico}` | idem (há divergência de caminhos com o manual antigo - conferir no swagger) |
| Distribuição | ADN `GET /DFe/{NSU}`, até 50 DF-e por consulta, aguardar 1 h quando ultNSU = maxNSU | Guia das APIs do ADN v1.0 (12/02/2026) |
| Autenticação | mTLS com certificado ICP-Brasil do solicitante; recepção rejeita certificado sem "Autenticação Cliente", fora da validade, revogado, fora da ICP-Brasil ou sem OID de CNPJ/CPF | Anexo I v1.01, aba RN_RECEPCAO_DPS (regras 1-8) |
| Corpo | XML da DPS compactado (GZip) em Base64; UTF-8, sem prefixo de namespace | Anexo I, RN_RECEPCAO_DPS 10-15 |
| **Id da DPS** | "DPS" + Cód.Mun.Emi.(7) + Tipo Insc. (1=CPF, 2=CNPJ) + Inscrição (14, CPF com zeros) + Série (5) + Número (15) = 45; divergência = **E0004** | Anexo I v1.01, LEIAUTE e regra 139 |
| **Duplicidade** | mesma série+número+município+CNPJ/CPF já gerou NFS-e = rejeição **E0014** | Anexo I v1.01, regra 145 |
| Grupos da DPS | `infDPS`: tpAmb (1 produção, 2 homologação), dhEmi, verAplic, serie, nDPS, dCompet, tpEmit, cLocEmi; `prest`(+`regTrib`: opSimpNac, regEspTrib), `toma`, `serv`(`locPrest`, `cServ`: cTribNac 6 dígitos, xDescServ, cNBS), `valores`(`vServPrest`/vServ, `trib`/`tribMun`, `totTrib`), `IBSCBS` (opcional) | Anexo I v1.01, LEIAUTE |
| Procuração | desde 01/11/2026, APIs de emissão e distribuição aceitam acesso em nome de terceiros com procuração eletrônica da RFB ou vínculo cadastral do CNPJ; validação pelo certificado da comunicação e pelas assinaturas | notícia de 31/10/2026 |
| IBS/CBS | grupo hoje "aberto" (ausência não rejeita), mas se informado tudo fica obrigatório; obrigatoriedade escalonada: 01/10/2026 serviços gerais; 01/01/2027 e 01/03/2027 para outros segmentos e Simples Nacional (Ato Conjunto RFB/CGIBS nº 7, DOU 13/11/2026). MEI: não encontrado | notícias de 29/10 e 13/11/2026 |
| Simples Nacional | Emissor Nacional obrigatório por competência a partir de 01/11/2026 (Res. CGSN 191/2026) | notícia de 29/10/2026 |

## 3. Arquitetura do conector
```text
Fila (queue.ts) -> NationalNFSeProvider (implementa FiscalProvider)
   1. número da DPS FIXO por pedido (DpsNumberAllocator; mesmo pedido = mesmo número)
   2. id da DPS (dps-id.ts, regra 139)
   3. CONSULTA antes de enviar: HEAD/GET /dps/{id} -> se já gerou, usa a chave (sem reenvio)
   4. monta a DPS (dps-xml.ts) só com parâmetros do perfil aprovado; falta = recusa
   5. GZip + Base64 -> SefinTransport.emit (POST /nfse síncrono)
   6. autorizada -> AUTORIZADA (chave de acesso)
      E0014 -> conciliação pela consulta (a nota JÁ existe), nunca rejeição
      outra rejeição -> REJEITADA com código
      falha/timeout -> RESULTADO_INDETERMINADO -> conciliação na fila
SefinTransport: SimulatedSefinTransport (regras E0004/E0014/recepção, sem rede) |
                createMtlsSefinTransport() -> BLOQUEADO nesta fase
```
- **Múltiplos contribuintes:** emitente (município, CPF/CNPJ) e parâmetros vêm por empresa (`emitterFor`, `parametersFor`), a partir do perfil aprovado; o número da DPS é sequencial **por emitente e série**.
- **Certificados:** nunca no banco; transporte real usará cofre (doc 15). Com procuração (nov/2026), o certificado de comunicação pode ser o do escritório, mas a validade jurídica e o escopo da procuração precisam de confirmação antes.
- **Armazenamento e auditoria:** tentativas em `fiscal_issuance_attempts` (já existe), eventos por pedido, `audit_log`. A NFS-e real (XML) deverá ser guardada em armazenamento protegido com checksum (próxima etapa).

## 4. Implementado nesta fase (modo simulado)
`src/lib/wjb-ai/fiscal/national/`: `dps-id.ts`, `dps-xml.ts`, `transport.ts` (contrato + transporte real bloqueado), `simulated-transport.ts`, `provider.ts` (+ `InMemoryDpsNumberAllocator`). A fila passou a consultar o status informando a empresa. **O conector nacional ainda não está ligado na fila**: a fila continua com o `MockFiscalProvider`.

Testes de contrato (14): formato do id (45 posições, CPF com zeros, tipo 1/2), divergência E0004, montagem com grupos oficiais e tpAmb 2, recusa sem parametrização do contador, IBS/CBS bloqueado sem decisão, escape de texto, envio GZip+Base64, **timeout depois de gerar a nota não gera segunda nota**, E0014 vira conciliação, números distintos por pedido e iguais no reenvio, transporte oficial bloqueado, fila + conector conciliando na mesma rodada.

## 5. Riscos
| Risco | Mitigação |
| --- | --- |
| Contrato JSON/erros do swagger diferente do assumido | transporte isolado; testes de contrato reescritos ao ler o swagger com certificado |
| Assinatura XMLDSig e algoritmo vigentes desconhecidos (manual de 2022 cita SHA-1) | não assinar nada até conferir XSD/manual vigente |
| CNPJ alfanumérico no id da DPS (Anexo diz "numérico") | conector recusa CNPJ alfanumérico até confirmação |
| Mudança de leiaute em 01/12/2026 (NT 009) e cronograma IBS/CBS | versões registradas; grupo IBS/CBS só com decisão do contador |
| Número da DPS renumerado no reenvio = nota duplicada | número fixo por pedido; consulta antes de enviar; E0014 tratado como existente |
| Procuração com escopo insuficiente | homologação primeiro com certificado do próprio emitente fictício/de teste autorizado |

## 6. Decisões necessárias para a homologação oficial
1. **Certificado de teste legítimo** (e-CNPJ A1 de uma empresa da WJB ou de cliente que autorize) e onde guardá-lo (cofre, doc 15) - sem isso não há swagger, nem produção restrita.
2. **Quem emite:** certificado do próprio contribuinte ou do escritório com procuração eletrônica (nov/2026).
3. **Contador:** parametrização por cliente (cTribNac, local de prestação, tribISSQN, tpRetISSQN, opSimpNac, regEspTrib, totTrib) e decisão sobre IBS/CBS (informar ou não antes da obrigatoriedade).
4. **Série da DPS** por emitente e política de numeração (a próxima migration cria a sequência persistente).
5. **Autorização expressa** para o primeiro acesso à produção restrita.
