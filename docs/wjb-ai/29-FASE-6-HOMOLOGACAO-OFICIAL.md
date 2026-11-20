# 29 - Fase 6: preparação para a homologação oficial

**Data:** 20/11/2026 · **Ambiente:** branch `wjb-ai/f2-solicitar-nfse` + projeto `wjb-ai-homologacao`. Nada na `main`, nada na produção, nenhuma conexão com as APIs do governo, nenhum certificado real instalado.

## 1. Resumo

| Pedido | Situação |
| --- | --- |
| Requisitos oficiais da assinatura | **Confirmados** no Manual Integrado e no Anexo I (seção 2) |
| Algoritmo aceito pela SEFIN hoje | **RSA-SHA1 / SHA-1 / C14N inclusivo** é o único documentado oficialmente; o documento é de 2022 (pasta "leiaute e esquemas antigos") e nenhum documento atual o substitui. Confirmação definitiva só com o swagger ou o primeiro envio. |
| Assinatura digital real local | **Implementada e testada** com certificado de TESTE gerado na hora (não ICP-Brasil) |
| Validação criptográfica (não só XSD) | **Feita de forma independente**: libxml2 canonicaliza, OpenSSL confere digest e assinatura RSA |
| Swagger autenticado da SEFIN | **Não lido**: exige certificado ICP-Brasil, que não foi autorizado nesta fase |
| WJB como contribuinte de teste | **Preparado** (modelo B com o e-CNPJ da WJB); a habilitação do CNPJ não pode ser conferida sem certificado |
| Representação (certificado da WJB + procuração) | **Preparada** (modelo A), com bloqueio antes do envio e conferência na hora do uso |
| Infraestrutura de segurança | cofre por interface, barreira de uso do certificado, trilha imutável (0028), alertas |

## 2. Requisitos oficiais de assinatura e certificado

Fontes: **Manual Integrado do Sistema Nacional NFS-e v1.00.02** (set/2022, `manualintegradosnnfse_v1-00-02-producao.pdf`, itens 6.1.1 a 6.1.4) e **Anexo I v1.01** de produção (09/02/2026) e de produção restrita (20/10/2026), abas RN_RECEPCAO_DPS e RN DPS_NFS-e.

### Assinatura da DPS
| Item | Requisito | Onde está no código |
| --- | --- | --- |
| Padrão | XML Digital Signature, **enveloped** | `national/xmldsig.ts` |
| Elemento assinado | `infDPS`, pelo atributo `Id`; `Reference URI="#<Id>"` | idem |
| Posição | `Signature` logo depois de `infDPS`, dentro de `DPS` | idem |
| Canonicalização | `http://www.w3.org/TR/2001/REC-xml-c14n-20010315` (inclusiva, sem comentários) | `national/xml-c14n.ts` |
| Transforms | exatamente 2: `enveloped-signature` e C14N | assinador e verificador |
| SignatureMethod | `http://www.w3.org/2000/09/xmldsig#rsa-sha1` | perfil `rsa-sha1` (padrão) |
| DigestMethod | `http://www.w3.org/2000/09/xmldsig#sha1` | idem |
| KeyInfo | `X509Data/X509Certificate` só do titular (EndCertOnly); **proibidos** `X509SubjectName`, `X509IssuerSerial`, `X509IssuerName`, `X509SerialNumber`, `X509SKI`; evitar `KeyValue` | verificador recusa |
| Namespace | `xmlns="http://www.w3.org/2000/09/xmldsig#"` na própria tag `Signature`; **prefixos proibidos** (E1228) | parser recusa prefixo |
| Documento | XML 1.0, UTF-8, declaração única `<?xml version="1.0" encoding="UTF-8"?>` (E1229); sem espaços, quebras ou comentários entre tags | `buildDpsXml` |
| Lista de revogação | não enviar; a SEFIN monta e confere | — |

### Certificado
| Requisito | Rejeição se faltar |
| --- | --- |
| ICP-Brasil, raiz ICP-Brasil | E1208 (transmissão) / E0716 (assinatura) |
| Versão 3 | E1200 / E0716 |
| Não ser de AC (Basic Constraint) | E1200 / E0716 |
| **Transmissão (mTLS):** Extended Key Usage "Autenticação Cliente" | E1200 |
| **Assinatura:** Key Usage "Assinatura Digital" e "Não Recusa" | E0716 |
| CNPJ em OtherName `2.16.76.1.3.3` ou CPF em `2.16.76.1.3.1` | E1209 / E0716 |
| Dentro da validade | E1203 / E0715 |
| Cadeia válida; LCR acessível; não revogado | E1205, E1206, E1207 / E0715 |
| Assinatura do emitente, ou de quem tem procuração ou representação legal | **E0718** |
| Tipo A1 ou A3 | Manual 6.1.3 |

`national/certificate-inspect.ts` lê do X.509 público o CNPJ/CPF do OtherName, os bits de Key Usage, o EKU, o indicador de AC, a versão, a validade e a impressão digital SHA-256. O Node não decodifica OtherName nem Key Usage; há um leitor DER mínimo só para essas duas extensões. A cadeia até a raiz ICP-Brasil e a LCR continuam sendo conferidas pela SEFIN.

## 3. Validação do algoritmo de assinatura

**O que foi provado** (`src/tests/unit/wjb-ai-xmldsig.test.ts`, 10 testes, todos passando):
1. A canonicalização C14N do conector é **idêntica byte a byte** à do libxml2 (`xmllint --c14n`), inclusive com acentos, aspas, `&`, `<` e apóstrofo.
2. A DPS assinada com RSA-SHA1 tem o `DigestValue` igual ao SHA-1 do C14N calculado pelo libxml2, e a `SignatureValue` é **verificada pelo OpenSSL** (`openssl dgst -sha1 -verify`) sobre o `SignedInfo` canonicalizado pelo libxml2. Nenhuma das duas verificações usa o código do projeto.
3. A DPS assinada é válida nos **dois XSD oficiais** com o bloco de assinatura completo.
4. Adulterar o conteúdo, trocar o algoritmo no `SignedInfo` ou trocar o certificado do `KeyInfo` invalida a assinatura (E0714); sem assinatura dá E0717; `KeyValue` no `KeyInfo` é recusado.
5. RSA-SHA256 também funciona, mas **só como opção explícita**: o padrão segue o documento oficial.

**O que não foi provado:** que a SEFIN aceita esta assinatura. Isso depende de certificado ICP-Brasil legítimo, da cadeia, da LCR e do primeiro envio em produção restrita.

**Consequência para o cofre:** o **AWS KMS não assina SHA-1**. Enquanto o algoritmo oficial for RSA-SHA1, essa opção fica fora da DPS. Gerenciador de segredos (chave em memória do processo de transmissão) ou HSM com PKCS#11 atendem.

## 4. Matriz dos contratos oficiais de API

| Item | Status | Fonte |
| --- | --- | --- |
| Transporte | **CONFIRMADO**: REST/JSON sobre TLS (1.0 ou superior) com **autenticação mútua** | Manual Integrado 6.1.2 |
| Corpo do documento | **CONFIRMADO**: XML compactado em GZip, em Base64, dentro do JSON | Manual Integrado 6.1.1 c; FAQ 17.1 |
| Nome do campo JSON do envio da DPS | **NÃO CONFIRMADO** (o FAQ cita `eventoViaXmlGZipBase64` para eventos; o da DPS está no swagger) | swagger com certificado |
| `POST /nfse` síncrono | CONFIRMADO | Manual API v1.2 |
| `GET /nfse/{chaveAcesso}` | CONFIRMADO (existência) | idem |
| `HEAD /dps/{id}` (qualquer certificado) / `GET /dps/{id}` (só atores da nota) | CONFIRMADO | idem; FAQ 26.4 |
| Eventos `POST/GET /nfse/{chave}/eventos` | CONFIRMADO (existência) | Manual API v1.2 |
| Rejeições de recepção (E1200-E1209, E1225, E1226, E1228, E1229, E1235, E1242) | **CONFIRMADO** | Anexo I, RN_RECEPCAO_DPS |
| Rejeições de regra (E0001 a E1638) | **CONFIRMADO**: 441 códigos em produção e 466 em produção restrita, com mensagem e efeito oficiais | `national/rejeicoes-*.json` |
| Formato JSON da resposta de erro e códigos HTTP | **NÃO CONFIRMADO** | swagger com certificado |
| Tipos de todos os campos JSON | **NÃO CONFIRMADO** | swagger com certificado |
| Algoritmos de autenticação (TLS) | PARCIAL: TLS mútuo com certificado ICP-Brasil; suítes e versão mínima vigente não publicadas | Manual Integrado 6.1.2 |
| Algoritmo de assinatura | CONFIRMADO no documento de 2022 (RSA-SHA1); vigência atual a confirmar | Manual Integrado 6.1.4 |
| Versionamento de leiaute | CONFIRMADO: produção v1.01 (09/02/2026); produção restrita NT 009 r1 (20/10/2026); mesmo `versao`, esquemas diferentes | XSD oficiais |

Os testes de contrato foram atualizados com o que é oficial: XSD dos dois ambientes, assinatura conforme o Manual, regras de recepção E1228/E1229 no simulador, regras de alíquota do Anexo I e catálogo oficial de rejeições. O que depende do swagger está isolado em `national/transport.ts`; quando o swagger for lido, muda só esse arquivo e os testes dele.

## 5. Regras fiscais do Anexo I que entraram nesta fase

As regras 501 a 513 definem, pela combinação de situação no Simples, apuração (`regApTribSN`), regime especial, tributação, retenção e **situação do convênio do município de incidência**, se a alíquota (`pAliq`) é proibida ou obrigatória (E0595, E0600, E0602, E0604, E0617, E0619, E0621, E0625, E0628, E0631, E0635, E0640). Antes o conector nunca informava `pAliq` e seria rejeitado em várias combinações. Agora:
- o cadastro fiscal tem `regApTribSN`, a situação do convênio (com data da conferência) e `pAliq`, sempre preenchidos pelo contador;
- `fiscal/aliquota-rules.ts` aplica as regras oficiais e as regras 226 (E0162) e 230 (E0175);
- o checklist de prontidão mostra o código oficial do problema;
- a DPS leva `regApTribSN` e `pAliq` na posição do XSD (validado nos dois esquemas).

Fora do escopo (o cadastro não oferece): benefício municipal (E0612), deduções e imunidades.

## 6. Modelos de emissão

**Contribuinte de teste: a própria WJB (modelo B).** A WJB emite em nome próprio, com o próprio e-CNPJ: titular do certificado = emitente, sem procuração. O mesmo e-CNPJ serve depois ao modelo A. Pendência: conferir se o CNPJ da WJB está habilitado no Sistema Nacional, o que só a consulta autenticada ou o Emissor Nacional mostram.

**Representação (modelo A).** Certificado e-CNPJ da WJB + procuração eletrônica de cada cliente no Portal de Serviços da RFB (serviço da NFS-e). Barreiras:
1. no cadastro e na prontidão: procuração ativa, não revogada, no prazo, escopo NFS-e, para o mesmo CNPJ do certificado da WJB;
2. **na hora do uso** (`useCertificate`): a autorização é reavaliada; procuração revogada entre o cadastro e o envio bloqueia e fica na trilha;
3. na SEFIN: E0718 se a procuração não existir na RFB, tratado como rejeição com alerta crítico.

Nenhuma emissão em nome de terceiros acontece sem autorização válida: não há caminho no código que assine sem passar por `useCertificate`.

## 7. Infraestrutura de segurança

| Item pedido | Implementação |
| --- | --- |
| Controle de acesso ao certificado | só `useCertificate` obtém a chave; nenhuma rota, tela ou agente chama o cofre; produção recusada |
| Cofre compatível | interface `CertificateVault`; nenhum serviço contratado (`createCertificateVault()` recusa); `TestCertificateVault` só aceita `vault://teste/...` |
| Auditoria de cada uso | `fiscal_certificate_usage` (0028): permitido, negado ou erro, com impressão digital e motivo; **imutável** (nem o servidor altera ou apaga); falha ao gravar a trilha interrompe o uso |
| Certificado trocado no cofre | impressão digital do que veio do cofre comparada à registrada; diferente = negado |
| Autorização e revogação de procurações | 0027 (revogação definitiva, sem apagar) + reavaliação no uso |
| Numeração por emitente e série | 0027 (`allocate_dps_number`, trava por série, número fixo por pedido) |
| Prevenção de duplicidade | idempotência por pedido + número fixo + consulta antes de enviar + E0014 tratado como conciliação |
| Reconciliação de resultado desconhecido | fila: consulta antes de reenviar; alerta crítico se ficar mais de 30 min sem resolução |
| Monitoramento e alertas | `fiscal/monitoring.ts`: certificado e procuração vencidos ou a 30 dias, resultado desconhecido parado, fila de erros, rejeição de certificado ou procuração, uso de certificado negado. Painel em `/admin/nfse` e rotina `POST /api/wjb-ai/cron/alertas` (aviso in-app a contadores e super admin; **não agendada**) |

## 8. Agentes

- Ferramenta nova `explain_rejection` (Atendimento e Supervisão): devolve **só a mensagem oficial** do catálogo; código fora do catálogo é dito como tal. O Fiscal não tem acesso a ela.
- Cadastro continua com `check_emission_readiness`, que agora inclui as regras de alíquota.
- Nenhum modelo externo. Nenhum agente escolhe código, alíquota, regime ou tributação.

## 9. Testes

| Bateria | Resultado |
| --- | --- |
| Unitários | **516 passando** (60 arquivos); novos: 10 de assinatura real, 30 da Fase 6 |
| Assinatura independente (libxml2 + OpenSSL) | C14N byte a byte; digest e RSA-SHA1 verificados pelo OpenSSL nos dois leiautes |
| XSD oficiais | DPS assinada e DPS com `regApTribSN`/`pAliq` válidas nos dois pacotes |
| Postgres 17 local | 0024-0028: 38 + 23 + **8 novos (T63-T70)**; rollback das cinco migrations restaura o banco |
| API real da homologação | **56 sem falha** (6 novos da 0028) |
| E2E com login real | **17/17** (inclui a rotina de alertas) |
| Regressão E2E do site | 92 passando, 0 falhas |
| Lint, tipos, build | ok; com o módulo desligado, as rotas novas respondem 404 |

## 10. Pendências

| Pendência | Depende de |
| --- | --- |
| Ler o swagger da SEFIN e do ADN (campos JSON, tipos, erros, HTTP) | certificado ICP-Brasil autorizado |
| Confirmar se RSA-SHA1 ainda é o exigido | swagger/manual atual ou primeiro envio |
| Habilitação do CNPJ da WJB no Sistema Nacional | consulta autenticada |
| Cofre real | escolha e contratação pela WJB (doc 30) |
| Transporte mTLS real | cofre + certificado + autorização |
| Benefício municipal, deduções, imunidade, IBS/CBS completo | decisão do contador e modelagem |
| GET /dps com procuração (procurador conta como ator?) | primeiro teste |
| Agendar as rotinas da fila e de alertas | aprovação da WJB |

## 11. Checklist para autorizar a primeira conexão oficial em produção restrita

Primeira conexão = só leitura do swagger e consulta `HEAD /dps` de uma DPS inexistente. **Não inclui emissão.**

**Autorizações**
- [ ] Autorização por escrito da WJB para instalar o certificado no cofre e abrir conexão com a produção restrita (escopo: leitura do swagger e consulta).
- [ ] Responsável técnico e contador responsável nomeados.

**Certificado e cofre (doc 30)**
- [ ] Cofre contratado, exclusivo de homologação, com MFA e trilha do provedor ligada.
- [ ] e-CNPJ A1 da WJB cadastrado no cofre pelo super admin, com o titular presente; nunca em disco, e-mail ou chat.
- [ ] Metadados conferidos por `inspectCertificate` (CNPJ da WJB no OtherName, Key Usage, EKU de cliente, versão 3, não AC, validade).
- [ ] Impressão digital registrada na autorização (modelo B da WJB).

**Sistema**
- [ ] Migrations 0024-0028 no ambiente que fará a conexão (nunca a produção da WJB sem autorização própria).
- [ ] Transporte mTLS implementado com timeout, sem log de corpo, de XML ou de certificado, e com saída liberada para as LCR das ACs.
- [ ] Interruptor de emergência testado (`WJB_AI_ENABLED`).

**Depois da conexão (antes de qualquer emissão)**
- [ ] Swagger registrado em `docs/wjb-ai/oficial/` com hash e data; matriz da seção 4 atualizada.
- [ ] Testes de contrato do transporte escritos contra o swagger.
- [ ] Algoritmo de assinatura reconfirmado.
- [ ] Nova autorização da WJB para a primeira emissão de teste (checklist do doc 25, seção 7).
