# Fase 10C - Validação da NFS-e Nacional

**Data:** 26/11/2026. **Fontes:** XSD e documentos públicos do gov.br/nfse. Não houve chamada ao governo, swagger autenticado, certificado real nem transmissão.

**Legenda:**
- **CONFIRMADO:** fonte oficial lida.
- **TESTADO:** teste local (XSD com `xmllint`, cliente falso ou simulador).
- **INFERIDO:** dedução a conferir.
- **PENDENTE:** sem fonte pública.

## 1. Situação por item
| Item pedido | Status | Detalhe |
| --- | --- | --- |
| NT 009 release 2 | CONFIRMADO, TESTADO | produção restrita desde 24/11/2026; produção "prevista para 07/12/2026", sem cronograma formal (leiaute sem data de produção) |
| Schemas XSD oficiais | CONFIRMADO, TESTADO | pacote de 24/11 baixado de novo nesta fase: SHA-256 igual ao registrado e os 4 arquivos versionados idênticos byte a byte; +2 XSD de evento copiados (`oficial/xsd/FONTE.md`) |
| Estrutura da DPS | TESTADO | válida nos 3 pacotes (produção 09/02, release 1 e release 2) |
| **Campo `indDest`** | CONFIRMADO, TESTADO, **depende do contador** | ver seção 2 |
| Catálogo de rejeições | CONFIRMADO, TESTADO | Anexo I de 24/11 (476 códigos) desde a Fase 10B |
| Contratos da API SEFIN | INFERIDO / PENDENTE | nomes do JSON e corpo de erro só no swagger; o portão recusa enquanto houver campo não confirmado |
| Swagger autenticado | PENDENTE | exige certificado ICP-Brasil (403/TLS); bloqueado até o novo e-CNPJ e o cofre |
| Algoritmo de assinatura | PENDENTE | RSA-SHA1 só no Manual Integrado de 2022; nenhum documento vigente confirma. O assinador recusa certificado real (`AlgorithmNotConfirmedError`) |
| Canonicalização XML | TESTADO | C14N 20010315 igual ao `xmllint --c14n`, byte a byte (Fase 6) |
| mTLS | CONFIRMADO (exigência), TESTADO (local) | ICP-Brasil com Autenticação de Cliente; testado contra servidor TLS local com certificado de teste |
| Consulta de situação | CONFIRMADO, TESTADO | `HEAD /dps/{id}` e `GET /dps/{id}` com cliente falso; 403/404 viram conciliação, nunca reenvio |
| **Cancelamento** | TESTADO (XML), PENDENTE (envio) | ver seção 3 |
| **Substituição** | TESTADO (XML), PENDENTE (regra e envio) | ver seção 3 |
| Idempotência | TESTADO | número da DPS fixo por pedido; envio simultâneo do mesmo pedido = mesma DPS; E0014 conciliado |
| Erros e rejeições | TESTADO | só 400/422 com código `E` + 4 dígitos viram rejeição; o resto é indeterminado e vai para conciliação |
| Produção restrita x produção | TESTADO | o transporte oficial aceita só o host de produção restrita; `isFiscalProductionAllowed()` é sempre falso |
| Portão único de transmissão | TESTADO | continua **fechado**; agora também lista `eventPath` e `requestEventField` entre os itens não confirmados |
| Rótulo "SIMULAÇÃO - SEM VALOR FISCAL" | TESTADO | mantido em todas as telas, avisos e na API de prévia |

## 2. `indDest`: regra implementada (pede validação do contador)
**Fonte oficial:** XSD do release 2, tipo `TSRTCIndDest`.
- **0:** o destinatário é o próprio tomador/adquirente identificado na NFS-e (tomador = adquirente = destinatário).
- **1:** o destinatário não é o adquirente: outra pessoa física ou jurídica, ou outro estabelecimento. Nesse caso entra o grupo `dest` (`TCRTCInfoDest`).

**Antes (Fase 10B):** o conector emitia `indDest=0` em todo pedido do release 2.

**Agora (Fase 10C):** o valor **nunca é presumido** (`national/ind-dest.ts`).

| O que o pedido declara | O que o conector faz |
| --- | --- |
| "Sim, o próprio tomador" | `indDest=0` |
| "Não, outra pessoa ou outro estabelecimento" | **não gera a DPS**: exige o grupo `dest`, que a plataforma não coleta; vai para o contador |
| Não informado (padrão) | **não gera a DPS**: o contador confirma |

**Onde aparece:**
- **Portal:** campo **opcional** "Quem recebe o serviço é o próprio tomador?", com a opção padrão "Não sei / deixar para o contador". Opcional de propósito: não muda o fluxo de quem já usa a simulação.
- **Admin:** o detalhe do pedido mostra "Destinatário do serviço (indDest)".
- **API:** o rascunho aceita `recipientIsTaker` só como booleano. Qualquer outro tipo é recusado (422).
- **Leiautes:** quem não tem `indDest` (produção de 09/02) não exige a informação.

**Pergunta ao responsável contábil da WJB:**
1. Para os serviços que a WJB emitirá, há casos em que o destinatário é diferente do tomador?
2. Se sim, quais dados do grupo `dest` precisam ser coletados?

Sem essa resposta, esses casos ficam fora do automático.

## 3. Cancelamento e substituição
**Cancelamento pelo emitente (evento `e101101`):**
- `national/events-xml.ts` monta o `pedRegEvento` com os campos e a ordem do XSD oficial (`pedRegEvento_v1.01.xsd` + `tiposEventos_v1.01.xsd`, release 2):
  - `tpAmb=2`, `verAplic`, `dhEvento` (`-03:00`, sem milissegundos);
  - autor (CNPJ ou CPF), `chNFSe`;
  - `xDesc` fixo "Cancelamento de NFS-e";
  - `cMotivo` (1 erro na emissão, 2 serviço não prestado, 9 outros);
  - `xMotivo` (15 a 255 caracteres).
- **Validado com `xmllint`** contra o XSD oficial. O texto é escapado, então não há injeção de XML.
- Recusa produção, chave fora do padrão oficial, motivo fora da tabela e descrição curta ou longa.
- **Divergência no próprio XSD:** a documentação de `TSIdPedRegEvt` fala em "PRE" + chave + tipo do evento + `nPedRegEvento` (62 posições), mas o tipo limita a 59 e o padrão só aceita 59. Seguimos o padrão, que é o que o validador aplica.
- **Pendentes:**
  - assinatura do evento (o XSD a marca como opcional e o algoritmo não está confirmado);
  - **caminho da API de eventos e JSON** (só no swagger; o nome `eventoViaXmlGZipBase64` aparece no FAQ v1.5, então está registrado como INFERIDO);
  - prazos e regras municipais de cancelamento.

**Substituição (grupo `subst` da DPS):**
- A DPS substituta leva `chSubstda`, `cMotivo` (01, 02, 03, 04, 05 ou 99) e `xMotivo` opcional (15 a 255 caracteres), logo depois de `cLocEmi`, como o XSD exige. **Validada com `xmllint`.**
- **Pendente:** o evento `e105102` (cancelamento por substituição) existe no XSD, mas nenhum documento lido diz se o emitente o envia ou se a SEFIN o gera ao autorizar a substituta. Não foi implementado para não presumir.
- **Pendente:** regras de negócio da substituição (prazo, quais campos podem mudar, motivo 99 com descrição obrigatória ou não). Ficam no Anexo I e no swagger.

**Não há tela de cancelamento nem de substituição.** Uma nota simulada não tem valor fiscal, então não há o que cancelar. O fluxo de tela entra junto com a primeira emissão oficial, revisada pelo contador.

## 4. O que muda quando o release 3 sair
O anúncio de 25/11 menciona **mudança da série no ID/chave**. Isso pode afetar:
- `dps-id.ts`, `isApiSeries`;
- o `ACCESS_KEY_PATTERN` dos eventos;
- o `Id` do `pedRegEvento`.

Procedimento: baixar o pacote numa pasta nova, conferir o SHA-256, registrar o leiaute com a data de vigência e rodar os testes de XSD.
