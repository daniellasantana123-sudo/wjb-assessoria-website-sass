# Fase 10B - API NFS-e Nacional: comprovado x pendente

**Data:** 26/11/2026.
**Fontes:** só páginas públicas do gov.br/nfse. Não houve nenhum acesso autenticado, certificado ou chamada ao governo.

**Legenda:**
- **CONFIRMADO:** lido em fonte oficial.
- **INFERIDO:** dedução a conferir.
- **PENDENTE:** sem fonte pública.
- **TESTADO:** coberto por teste local (XSD, simulador ou cliente falso).

## 1. Novidades oficiais desde a Fase 10A
| Item | Status | Fonte |
| --- | --- | --- |
| NT 009 **release 2** em produção restrita desde 24/11/2026; **produção prevista para 07/12/2026** (sem cronograma formal) | CONFIRMADO | notícia CGNFS-e de 25/11/2026 (gov.br/nfse/noticias) |
| A antiga previsão de "releases 1 a 3 em produção em 01/12/2026" deixou de valer | CONFIRMADO | notícias de 29/10 e 25/11/2026 |
| O release 3 trará nova versão da NT 009 e **mudança da série no ID/chave da NFS-e** | CONFIRMADO (anúncio, sem leiaute) | notícia de 25/11/2026 |
| XSD de produção restrita de **24/11/2026** | CONFIRMADO e TESTADO | `esquemas-xsd-producao-restrita-20261124.zip`, SHA-256 em `oficial/xsd/FONTE.md` |
| Anexo I de produção restrita de 24/11/2026: 476 códigos (+17 novos, -7 removidos, 25 mensagens alteradas) | CONFIRMADO | `anexo_i-...-prodrest-v1-01-20261124.xlsx` |
| E0718 agora diz "...ou possuir uma **representação concedida pelo emitente**" | CONFIRMADO | Anexo I de 24/11 (reforça o modelo A) |
| FAQ v1.5 (23/11/2026): sem mudança em 17.2 (E0718), 17.7 (procuração), 18.1 (série 00001-49999) e 18.2 (E0010) | CONFIRMADO | gov.br/nfse/perguntas-frequentes |
| Procuração e Alternância de Perfis em produção desde 31/10/2026 | CONFIRMADO | notícia de 25/11/2026 |
| XSD de **produção** posterior a 09/02/2026 | não existe | página de documentação atual |

## 2. Achado corrigido nesta fase
A DPS gerada pelo conector era **recusada** pelo XSD do release 2, que vale em produção restrita desde 24/11: `indDest` saiu do grupo IBS/CBS e virou **obrigatório em `infDPS`**, logo depois de `toma`.

**Correção:**
- leiaute `producao-restrita-nt009-r2-20261124` registrado, com a regra `indDestInInfDps`;
- a DPS emite `indDest=0` só nesse leiaute;
- a DPS valida nos 3 pacotes (`wjb-ai-dps-xsd.test.ts`).

`indDest=0` significa "tomador = adquirente = destinatário". O pedido da plataforma só tem um destinatário, o próprio tomador. **Pendente: o contador da WJB confirmar.** O caso "destinatário diferente" (valor 1 + grupo `dest`) não é suportado e não tem caminho automático.

## 3. Contrato da API
| Item | Status | No código |
| --- | --- | --- |
| URL base SEFIN de produção restrita | CONFIRMADO | `SEFIN_API_CONTRACT.baseUrl` |
| `POST /nfse` síncrono; corpo = DPS assinada em GZip + Base64 dentro de JSON | CONFIRMADO (estrutura) | `OfficialSefinTransport.emit` |
| Nome do campo do JSON de envio (`dpsXmlGZipB64`) | **INFERIDO** (pelo padrão `eventoViaXmlGZipBase64` do FAQ 17.1) | `requestDpsField` |
| Campos da resposta (`chaveAcesso`, `nfseXmlGZipB64`) | **INFERIDO** | `responseAccessKeyField`, `responseNfseField` |
| Formato da chave de acesso (50 dígitos) | **INFERIDO** | `accessKeyPattern`; fora do formato = indeterminado |
| Corpo de erro (`erros[].Codigo/Descricao`) e códigos HTTP | **PENDENTE** | só 400/422 com código `E` + 4 dígitos viram rejeição; o resto é indeterminado |
| `HEAD /dps/{id}` (aberto a qualquer certificado válido) | CONFIRMADO, TESTADO | `dpsExists` |
| `GET /dps/{id}` (chave só para ator da nota) | CONFIRMADO, TESTADO | `accessKeyForDps`; 403/404 = conciliação |
| Procurador tratado como ator no `GET /dps` | **PENDENTE** | `null` vira conciliação, nunca reenvio |
| Rate limit | **PENDENTE** | fila com recuo de 1 a 16 min |
| Swagger da SEFIN/ADN | **PENDENTE**: exige certificado (403/TLS) | portão bloqueia (`GATE_CONTRACT_UNCONFIRMED`) |
| Manual dos Municípios API v1.2 e Guia ADN v1.1 (PDF públicos de 23/11 e 03/11) | baixados; texto não extraível sem ferramenta própria (fontes codificadas) | não usados |

## 4. Assinatura e mTLS
| Item | Status |
| --- | --- |
| XMLDSig enveloped em `infDPS`, `ds:Signature` depois de `infDPS` | CONFIRMADO (FAQ 17.1), TESTADO |
| Algoritmo RSA-SHA1/SHA-1, C14N 20010315, 2 Transforms | só no Manual Integrado v1.00.02 (2022, pasta de documentos antigos). **Nenhum documento vigente confirma.** A assinatura com certificado real continua bloqueada |
| mTLS com ICP-Brasil e Autenticação de Cliente; certificado do procurador aceito | CONFIRMADO (FAQ 17.1, 17.7) |
| Verificação de LCR pela SEFIN | CONFIRMADO (FAQ 17.3) |

## 5. Testes de contrato locais (sem HTTP para o governo)
Com cliente HTTP falso (`wjb-ai-fase10b.test.ts`), estão cobertos:
- emissão autorizada;
- rejeição com código oficial;
- 5xx, 4xx genérico (409/429), corpo ilegível, 2xx sem chave e chave fora do formato, que sempre dão **indeterminado**;
- `HEAD` 200/404/500 e `GET` 403;
- id de DPS malformado recusado antes de qualquer requisição;
- host fora da produção restrita, porta ou credencial na URL e cliente real sem portão, todos recusados;
- mensagem com CPF/CNPJ mascarada;
- timeout seguido de conciliação **sem reenvio**;
- dois envios simultâneos do mesmo pedido com a **mesma DPS** (E0014 conciliado).

## 6. Checklist para a primeira conexão oficial **somente leitura** (autorização futura)
- [ ] Certificado e-CNPJ **novo** (nunca o exposto), no cofre contratado.
- [ ] Autorização registrada (quem, quando, escopo "leitura-documentacao-e-consulta") e `WJB_AI_SEFIN_READ_AUTHORIZED=true` só na máquina autorizada.
- [ ] `sefin-readonly.ts`: só `GET` de swagger/docs e `HEAD /dps/{id}` em produção restrita; corpo nunca vai para log.
- [ ] Ler o swagger, registrar os nomes reais no `SEFIN_API_CONTRACT` (trocando "inferido" por "confirmado" com a fonte) e reescrever os testes de contrato.
- [ ] Confirmar o algoritmo de assinatura no swagger ou manual autenticado; registrar a fonte.
- [ ] Nenhum `POST` nesta etapa.

## 7. Acompanhamento
- **07/12/2026 (previsto):** release 2 em produção. Quando houver cronograma formal, preencher `validFrom.producao` do leiaute r2.
- **Release 3:** nova NT 009 e mudança da série no ID. Pode afetar `dps-id.ts` e `isApiSeries`. Baixar o pacote novo numa pasta nova, sem sobrescrever.
