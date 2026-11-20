# 25 - Fase 5: compatibilidade com a NFS-e Nacional

**Data:** 20/11/2026 · **Ambiente:** branch `wjb-ai/f2-solicitar-nfse` + projeto `wjb-ai-homologacao`. Nada na `main`, nada na produção, nenhuma chamada às APIs do governo e nenhum certificado real.

> **Limite deste relatório:** a compatibilidade aqui é com os **esquemas XSD oficiais** e com as **regras publicadas** pelo CGNFS-e. Não é compatibilidade comprovada com o ambiente oficial. O swagger da SEFIN e do ADN só abre com certificado ICP-Brasil, então as rotas, os nomes dos campos JSON e o formato do erro **não foram conferidos**. As implementações simuladas não comprovam nada sobre o governo; elas só reproduzem as regras que a documentação pública descreve.

## 1. Fontes oficiais usadas (todas públicas, lidas em 20/11/2026)

| Fonte | Versão/data | Como foi lida |
| --- | --- | --- |
| Esquemas XSD de **produção** v1.01 (`nfse-esquemas_xsd-v1-01-20260209.zip`) | 09/02/2026 | baixado e extraído; copiado sem alteração em `docs/wjb-ai/oficial/xsd/` |
| Esquemas XSD de **produção restrita** (`esquemas_prod_restrita_20261020.zip`, NT 009 release 1) | 20/10/2026 | idem |
| Perguntas Frequentes NFS-e v1.4 (PDF, 167 páginas) | 18/11/2026 | texto extraído localmente |
| Manual de Contribuintes, APIs do Emissor Público v1.2 | 06/10/2025 | texto extraído (6 páginas, anterior às mudanças de 2026) |
| NT 009 v1.01 (PDF) | aprovada pelo Ato Técnico Conjunto RFB/CGIBS nº 7, 09/10/2026 | texto extraído |
| Notícias do CGNFS-e (leiaute em produção, NT 009, Ato Conjunto nº 7, procuração) | 20/10, 29/10, 31/10 e 13/11/2026 | lidas pelo agente de integrações governamentais |
| Página "APIs - Produção Restrita e Produção" | vigente | URLs dos ambientes |

Os hashes dos pacotes XSD estão em `docs/wjb-ai/oficial/xsd/FONTE.md`.

## 2. O que mudou no conector por causa da documentação oficial

| Achado | Fonte | Correção |
| --- | --- | --- |
| **`dhEmi` rejeitado pelo esquema**: o formato `TSDateTimeUTC` exige `AAAA-MM-DDThh:mm:ss±hh:00`, sem milissegundos e sem "Z". O conector usava `toISOString()` (`...000Z`). | XSD v1.01 | `formatDhEmi()` no horário de Brasília (`-03:00`); teste de regressão com o XSD |
| **`finNFSe` obrigatório em `infDPS`** no leiaute da NT 009 (produção restrita), logo antes de `cLocEmi`. | XSD de produção restrita | emitido com o único valor do domínio oficial (`0` = NFS-e regular) quando o leiaute exige |
| **Mesmo `versao="1.01"`, esquemas diferentes** em produção e produção restrita | os dois XSD | registro de leiautes por ambiente e data de vigência (`national/layouts.ts`) |
| **Série pela API: 00001 a 49999** (E0010 fora da faixa); 50000-69999 aplicativo, 70000-79999 emissor web, 80000-89999 transcrição | FAQ v1.4, 18.1/18.2 | banco (0027), formulário e conector recusam série fora da faixa |
| **CNPJ alfanumérico** só no esquema de produção restrita (`[0-9A-Z]{14}`); produção ainda só numérico | os dois XSD | aceito apenas quando o leiaute vigente permite |
| **Defeito no XSD oficial de produção**: `TSSerieDPS` usa `^...$`, que em XSD são caracteres literais; validadores conformes (libxml2) recusam qualquer série. Corrigido no pacote de produção restrita. | XSD de produção | documentado; o teste tolera só esse erro e só nesse pacote |
| **Assinatura**: XMLDSig *enveloped* na tag com Id (`infDPS`); `ds:Signature` logo depois de `infDPS`. Certificado ICP-Brasil v3, A1 ou A3, OtherName 2.16.76.1.3.3, Assinatura Digital + Não Recusa + Autenticação de Cliente, sem ser de AC. | FAQ 17.1/17.2, XSD | assinador simulado nessa posição; checagem dos requisitos do certificado |
| **E0718**: titular do certificado ≠ emitente, sem procuração vigente | FAQ 17.2/17.7 | conferido antes do envio (modelo A exige procuração para o CNPJ do certificado da WJB) |
| **Procuração**: com procuração eletrônica no Portal de Serviços da RFB (serviço da NFS-e), mTLS e assinatura podem ser do procurador; o `<emit>` continua com o cliente; o XML não indica a procuração; funciona em produção restrita; lote de até 50 notas | FAQ 17.7, 28.x | modelo A implementado com esses critérios |
| **GET /dps/{id}** só devolve a chave a quem é ator da nota; **HEAD** aceita qualquer certificado válido | Manual API 1.4.2, FAQ 26.4 | "existe mas sem chave" vira conciliação, nunca reenvio (não está confirmado se o procurador conta como ator) |
| **nNFSe perdido em timeout não é reaproveitado**; numeração usada nunca é reutilizada | FAQ 18.5/18.6 | o número da **DPS** continua fixo por pedido (a regra E0014 impede a segunda nota) |

## 3. Matriz de contratos, campos, autenticação e assinatura

Legenda: **CONFIRMADO** = lido na fonte oficial; **PARCIAL** = parte confirmada; **NÃO CONFIRMADO** = depende do swagger/manual com certificado.

### 3.1 APIs

| Item | Status | Detalhe | No conector |
| --- | --- | --- | --- |
| URLs base | CONFIRMADO | SEFIN restrita `https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional`; produção `https://sefin.nfse.gov.br/SefinNacional`; ADN `adn.producaorestrita.nfse.gov.br` / `adn.nfse.gov.br` | não usadas (transporte real bloqueado) |
| `POST /nfse` (emissão síncrona) | PARCIAL | existe e é síncrona; corpo é a DPS assinada, compactada em GZip e em Base64 dentro de um JSON | nome do campo JSON e formato de erro NÃO CONFIRMADOS |
| `GET /nfse/{chaveAcesso}` | PARCIAL | existe | não implementado |
| `HEAD /dps/{id}` | CONFIRMADO | aberto a qualquer certificado válido | contrato `dpsExists` |
| `GET /dps/{id}` | CONFIRMADO | chave só para ator da nota | contrato `accessKeyForDps`; procurador como ator NÃO CONFIRMADO |
| Eventos (`POST /nfse/{chave}/eventos`) | PARCIAL | existe; leiaute no Anexo II | fora do escopo (cancelamento depois) |
| Códigos HTTP e corpo de erro | NÃO CONFIRMADO | swagger exige certificado | o simulador usa `{ code, message }` |
| Lote | PARCIAL | até 50 notas por envio | não usado (envio individual) |
| Rate limit | NÃO CONFIRMADO | — | fila com recuo de 1 a 16 min |

### 3.2 DPS (XSD v1.01)

| Campo/grupo | Status | Regra |
| --- | --- | --- |
| Namespace `http://www.sped.fazenda.gov.br/nfse`, `versao` 1.00/1.01 | CONFIRMADO | XSD |
| `infDPS@Id` | CONFIRMADO | produção `DPS[0-9]{42}`; restrita `DPS[0-9]{7}(1[0-9]{14}\|2[0-9A-Z]{14})[0-9]{20}` |
| `tpAmb` | CONFIRMADO | 1 produção, 2 homologação |
| `dhEmi` | CONFIRMADO | sem milissegundos, com fuso `±hh:00` |
| `serie` / `nDPS` | CONFIRMADO | série até 5 dígitos (canal API 1-49999); número 1-15 dígitos sem zero à esquerda |
| `tpEmit`, `cLocEmi`, `dCompet` | CONFIRMADO | domínios do XSD |
| `finNFSe` | CONFIRMADO | só na NT 009 (restrita), valor único `0` |
| `prest/regTrib` (`opSimpNac`, `regEspTrib`) | CONFIRMADO | 1/2/3 e 0-6, 9 |
| `serv/cServ/cTribNac` | CONFIRMADO | 6 dígitos (código vem do contador) |
| `tribMun` (`tribISSQN`, `tpRetISSQN`) | CONFIRMADO | 1-4 e 1-3 |
| `totTrib/indTotTrib` | CONFIRMADO | valor fixo `0` |
| `IBSCBS` | CONFIRMADO (estrutura) | opcional hoje; se informado, completo; estrutura muda na NT 009 (CST/cClassTrib em `trib`, `vAjusteBC`) |
| `ds:Signature` | CONFIRMADO (posição) | enveloped, depois de `infDPS` |

### 3.3 Autenticação e assinatura

| Item | Status |
| --- | --- |
| mTLS com certificado ICP-Brasil e Autenticação de Cliente | CONFIRMADO (FAQ 17.1, 17.7) |
| Certificado da conexão e da assinatura podem ser do procurador | CONFIRMADO (FAQ 17.7) |
| Algoritmo de assinatura e de digest; canonicalização | **NÃO CONFIRMADO**. Fica em `SIGNATURE_ALGORITHM_PENDING` (rsa-sha256 provisório). Impacta a escolha do cofre (doc 26). |
| Verificação de LCR (revogação) pela SEFIN | CONFIRMADO (FAQ 17.3, erros E1206/E107) |

### 3.4 Leiautes e vigência

| Pacote | Produção restrita | Produção |
| --- | --- | --- |
| `producao-v1.01-20260209` (NT 004 v2.0 + NT 007) | até 19/10/2026 | **vigente** |
| `producao-restrita-nt009-r1-20261020` (NT 009 r1) | **desde 20/10/2026** | sem data oficial (previsão 01/12/2026; o cronograma formal ainda não foi publicado). Não é aplicado. |

Mudanças da NT 009 vistas no XSD: `finNFSe` em `infDPS`; `vDedRed` vira `vAjusteBC`; `xNome` do tomador passa a opcional; CNPJ alfanumérico; grupos de IBS/CBS reorganizados (bens móveis, locação de imóveis, ajuste de base).

**IBS/CBS (síntese oficial do CGNFS-e):** obrigatoriedade escalonada desde 01/10/2026 para serviços gerais sujeitos ao ISS; Ato Conjunto RFB/CGIBS nº 7 (13/11/2026) adiou parte para 01/01/2027 e 01/03/2027; Simples Nacional 01/01/2027 e 01/03/2027 conforme o caso. Se o grupo não vier, o ADN não rejeita; se vier, completo. A situação do MEI não foi encontrada.

## 4. O que foi implementado

| Parte | Arquivos |
| --- | --- |
| Registro de leiautes por ambiente e vigência | `src/lib/wjb-ai/fiscal/national/layouts.ts` |
| DPS conforme XSD (data, série, `finNFSe`, CNPJ por leiaute) | `national/dps-xml.ts`, `national/dps-id.ts` |
| Assinatura (contrato + simulada; ICP-Brasil bloqueada) | `national/signing.ts` |
| Transporte com contexto do certificado; simulador com E0004, E0010, E0014, E0714, E0717, E0718 e GET restrito a atores | `national/transport.ts`, `national/simulated-transport.ts` |
| Conector: leiaute vigente, assinatura, titular do certificado, conciliação | `national/provider.ts` |
| Numeração persistente e concorrente da DPS | migration **0027** + `national/dps-number.repo.ts` |
| Modelos A e B, requisitos do certificado, procuração válida/vencida/revogada | `fiscal/emitter-authorization.ts` |
| Cadastro fiscal completo e checklist de prontidão | `fiscal/profile-settings.ts`, `fiscal/profile-form.ts`, `fiscal/readiness.repo.ts`, tela `/admin/nfse/perfis` |
| Barreira contra segredos em campos | `fiscal/secret-guard.ts` + CHECKs na 0027 |
| Fluxo dos 6 agentes em simulação (com Auditoria) | `agents/runtime.ts` (`runSimulationFlow`), `agents/contracts.ts` (`check_emission_readiness`) |

**Achado de segurança corrigido na 0027:** a policy `for all` da 0024 somada ao DELETE que o Supabase concede por padrão permitia à equipe **apagar** uma autorização de emissão e o histórico dela. Agora só inserir e alterar; revogação com motivo, definitiva e auditada.

## 5. Testes e resultados

| Bateria | Resultado |
| --- | --- |
| Unitários (`npx vitest run`) | **476 passando** (58 arquivos), incluindo 29 novos da Fase 5, 25 do conector e 6 de contrato com XSD |
| Contrato XSD com `xmllint` | DPS assinada **válida nos dois esquemas oficiais**; testes negativos confirmam que formato antigo de data e domínio inválido são reprovados |
| Postgres 17 local (`scripts/wjb-ai/homologacao/run.sh`) | 38 verificações da 0024-0026 + **23 da 0027** (T40-T62), incluindo 30 chamadas concorrentes: números 1 a 20 sem repetição nem lacuna, repetição do mesmo pedido devolve o mesmo número; rollback da 0027 a 0024 restaura o banco |
| API real da homologação (`02-seed-e-testes-api.mjs`) | **50 verificações sem falha** (13 novas: série, permissões, 18 chamadas simultâneas pelo PostgREST, isolamento, procuração, chave colada, apagar, revogar) |
| E2E com login real (`staging.sh`) | **16 de 16** (2 novos: cadastro fiscal completo e autorização modelo A; achou e corrigiu a perda de campos no erro) |
| Lint, tipos, build | ok; com o módulo desligado, todas as rotas do WJB AI respondem 404 |

Cobertura dos itens pedidos: assinatura simulada; procuração válida, vencida e revogada (no cadastro e na "RFB" simulada, E0718); numeração concorrente; duplicidade e reenvio (E0014, timeout, consulta antes de reenviar); erros de validação fiscal (domínios, série, IBS/CBS, enquadramento); isolamento entre empresas; auditoria sem dado pessoal; proteção de credenciais; compatibilidade entre leiautes.

## 6. Pendências e riscos

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Algoritmo de assinatura não confirmado (SHA-1 x SHA-256) | escolha do cofre (alguns KMS não assinam SHA-1) e rejeição no primeiro envio | ler o manual/swagger com certificado antes de escolher o cofre; assinador isolado atrás de contrato |
| Nomes do JSON e formato de erro da SEFIN não conferidos | ajuste no transporte real | transporte isolado; teste de contrato a escrever contra o swagger |
| GET /dps pode negar a chave ao procurador (modelo A) | conciliação depende de outra consulta (ADN por NSU) | resultado fica "indeterminado" e vai para conciliação; nunca reenvia |
| NT 009 em produção sem data oficial | aplicar cedo demais quebraria emissões | leiaute só muda com data publicada; troca é cadastro de vigência, não código |
| Defeito do XSD oficial de produção (`TSSerieDPS`) | validação local diverge da SEFIN | documentado; confirmar no primeiro envio em produção restrita |
| Habilitação do emitente não é consultável pela WJB | rejeição na SEFIN | contador confirma e registra a data; conferência real no primeiro envio |
| Manual de API v1.2 é de 2025 | rotas podem ter mudado | reconferir com o swagger |
| Situação do MEI no IBS/CBS não encontrada | decisão do contador | registrar a decisão no cadastro, com justificativa |

## 7. Checklist para autorizar o primeiro teste oficial em produção restrita

Nada abaixo foi feito. Cada item precisa de responsável e evidência.

**Decisões e contratos (WJB)**
- [ ] Autorização expressa e por escrito para o primeiro acesso à produção restrita (escopo: só emissão de teste, sem efeito fiscal).
- [ ] Modelo de emissão definido para a empresa de teste (A ou B) e responsável técnico nomeado.
- [ ] Empresa de teste escolhida (preferência: própria WJB), com contador responsável pela parametrização.

**Certificado e cofre (doc 26)**
- [ ] Cofre escolhido e configurado, com acesso mínimo, auditoria ligada e ambientes separados.
- [ ] Certificado legítimo cadastrado no cofre (nunca no Supabase/GitHub), metadados conferidos (titular, validade, ICP-Brasil v3, Autenticação de Cliente).
- [ ] Modelo A: procuração eletrônica cadastrada no Portal de Serviços da RFB, serviço da NFS-e, em favor do CNPJ da WJB; evidência registrada.

**Leitura técnica com certificado (sem emitir)**
- [ ] Swagger da SEFIN e do ADN de produção restrita lidos; nomes do JSON, códigos HTTP e erros conferidos e registrados.
- [ ] Algoritmo de assinatura e canonicalização confirmados; assinador real implementado e testado contra o XSD.
- [ ] Transporte mTLS implementado com timeout, sem log de corpo e sem log de certificado.

**Cadastro e sistema**
- [ ] Perfil fiscal da empresa de teste aprovado (checklist de prontidão todo em ok).
- [ ] Série de produção restrita configurada (1-49999, nunca reaproveitada).
- [ ] Migrations 0024-0027 aplicadas no ambiente que fará o teste (nunca a produção da WJB sem autorização própria).
- [ ] Interruptor de emergência testado (desligar `WJB_AI_ENABLED` para tudo).

**Execução do primeiro teste**
- [ ] Uma DPS fictícia, valor simbólico, tomador fictício permitido pelo ambiente.
- [ ] Antes de enviar: HEAD /dps/{id} para confirmar que não existe.
- [ ] Depois: registrar resposta, conferir com HEAD/GET, guardar o XML da NFS-e em armazenamento protegido.
- [ ] Revisão do resultado com o contador antes de qualquer segundo envio.
