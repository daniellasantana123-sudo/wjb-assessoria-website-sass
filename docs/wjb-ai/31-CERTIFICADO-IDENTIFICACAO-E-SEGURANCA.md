# 31 - Certificado digital da WJB: identificação e segurança

**Data:** 21/11/2026 · **Situação:** a WJB informou ter um certificado ICP-Brasil **A1 (arquivo PFX)** associado à responsável pela empresa. **Ninguém do projeto teve acesso ao arquivo nem à senha**, e nada foi pedido no chat. Este documento prepara a verificação, que a própria responsável faz no computador dela.

## 1. Segurança imediata: o certificado pode estar comprometido?

Antes de qualquer uso, a responsável responde estas perguntas. **Um único "sim" basta para considerar o certificado comprometido.**

| Pergunta | Se a resposta for "sim" |
| --- | --- |
| O arquivo PFX e a senha foram enviados juntos (ou em sequência) por e-mail, WhatsApp, chat ou mensagem? | comprometido |
| O arquivo ficou em pasta compartilhada, nuvem pessoal sem MFA, pen drive ou computador de terceiros? | comprometido |
| A senha está anotada junto do arquivo, ou é fraca ou reaproveitada de outro serviço? | comprometido |
| Contador anterior, software house, despachante ou funcionário que saiu já teve o arquivo e a senha? | comprometido |
| Há uso desconhecido (nota, procuração, acesso ao e-CAC) que ninguém reconhece? | comprometido, e investigar |
| Não sabe responder com segurança? | tratar como comprometido |

**Se estiver comprometido:**
1. Pedir à Autoridade Certificadora que emitiu o certificado a **revogação** (pelo site ou atendimento da AC, com validação do titular).
2. Emitir um **novo** certificado e-CNPJ A1, de preferência exclusivo para a plataforma da WJB.
3. Conferir no e-CAC as procurações e os acessos feitos com o certificado antigo.
4. Não usar o certificado antigo em nenhum teste.

Na dúvida, a recomendação é emitir um certificado novo e dedicado: o custo (doc 26) é pequeno perto do risco de alguém emitir nota ou agir no e-CAC em nome da WJB.

## 2. e-CNPJ ou e-CPF?

O tipo não aparece no nome do arquivo: precisa ser lido dentro do certificado.

| | e-CNPJ (empresa) | e-CPF (pessoa) |
| --- | --- | --- |
| Identificador no OtherName | **2.16.76.1.3.3** = CNPJ; também traz 2.16.76.1.3.4 (dados do responsável) e 2.16.76.1.3.2 (nome do responsável) | **2.16.76.1.3.1** = data de nascimento + CPF do titular |
| Assina DPS da WJB (modelo B) | sim, é o emitente | só se a SEFIN aceitar a representação legal (FAQ 17.7/28.4); o documento de 2022 exige a raiz do CNPJ ou o CPF do emitente |
| Serve para a WJB emitir pelos clientes (modelo A) | sim, com procuração dos clientes para o CNPJ da WJB | só com procuração dos clientes para o CPF da pessoa |
| Recomendação | **usar** | **não usar na plataforma**: amarra a emissão de todos os clientes a uma pessoa física, que pode sair da empresa, e expõe dados pessoais e responsabilidade individual |

## 3. Procedimento local de verificação

Ferramenta: `scripts/wjb-ai/certificado/verificar-certificado.mjs` (Node + OpenSSL 3, **sem rede**).

**Como a responsável roda (no próprio computador, com o projeto clonado):**
1. Deixar o PFX numa pasta **fora** do projeto (o script recusa arquivo de dentro dele).
2. No terminal, na pasta do projeto:
   `node scripts/wjb-ai/certificado/verificar-certificado.mjs ~/Documentos/certificado.pfx --saida ~/Documentos/relatorio-certificado.json`
3. Digitar a senha quando pedido. Ela **não aparece** na tela e não é gravada.
4. Opcional: `--cadeia <arquivo.pem>` com os certificados públicos da cadeia ICP-Brasil (baixados do ITI ou da AC) para conferir a cadeia.
5. Opcional: `--verificar-revogacao`, que baixa a lista de revogação (LCR) indicada no próprio certificado. Acessa o servidor da AC, por isso fica desligado por padrão.
6. Enviar à equipe **só o relatório JSON**, nunca o PFX nem a senha.

**O que o relatório traz:**
- tipo (e-CNPJ ou e-CPF);
- CNPJ e se confere com o da WJB (dado público);
- CPF do titular ou responsável **mascarado** (`***.123.456-**`) e só as **iniciais** do nome;
- AC emissora, validade e dias restantes;
- impressão digital SHA-256;
- algoritmo e tamanho da chave;
- Assinatura Digital, Não Recusa e Autenticação de Cliente;
- se é certificado de AC;
- algoritmo de proteção do PFX e se o PFX é legado;
- se a chave privada corresponde ao certificado e se o Node consegue usá-lo em mTLS;
- cadeia e revogação (verificadas ou não).

**O que nunca sai:** chave privada (a conferência com o certificado é feita dentro do Node, sem exportar), senha, o certificado em si (que contém nome e CPF), CPF completo e nome completo. Uma limpeza final mascara qualquer número com formato de CPF em qualquer campo; os testes provaram que essa limpeza era necessária (um caso de teste vazava o CPF pelo nome do emissor).

**Testado** (`src/tests/unit/wjb-ai-certificado-local.test.ts`, 6 testes) com certificados **fictícios** gerados na hora: e-CNPJ que confere, e-CPF, e-CNPJ de outra empresa, PFX legado, senha errada e arquivo de dentro do repositório. Nenhum certificado real foi usado.

O `.gitignore` passou a bloquear `*.pfx`, `*.p12`, `*.key`, `*.pem`, `*.crt`, `*.cer`, `*.der` e `relatorio-certificado*.json`.

## 4. Requisitos de assinatura: o que é vigente e o que não é

| Requisito | Fonte | Vigência |
| --- | --- | --- |
| Assinatura obrigatória pela API (E0717), válida (E0714), do emitente ou de quem tem procuração ou representação (E0718) | Anexo I v1.01 (09/02/2026 e 20/10/2026) | **vigente** |
| Certificado ICP-Brasil v3, não AC, Assinatura Digital + Não Recusa, OtherName CNPJ/CPF, cadeia, LCR (E0715/E0716, E1200-E1209) | Anexo I v1.01 | **vigente** |
| mTLS com EKU de Autenticação Cliente; certificados da conexão e da assinatura podem ser do procurador | Anexo I (RN_RECEPCAO_DPS), FAQ v1.4 (18/11/2026) | **vigente** |
| Sem prefixo de namespace (E1228), UTF-8 (E1229) | Anexo I v1.01 | **vigente** |
| XMLDSig enveloped em `infDPS`, C14N 20010315, **RSA-SHA1/SHA-1**, KeyInfo só com `X509Certificate` | Manual Integrado v1.00.02 (set/2022), publicado em "leiaute e esquemas antigos" | **não confirmado como vigente**: nenhum documento atual público trata do algoritmo |

**Consequência implementada:** o assinador real (`XmlDsigDpsSigner`) **recusa assinar com certificado real** enquanto o algoritmo não for confirmado na documentação autenticada (`AlgorithmNotConfirmedError`, antes mesmo de abrir o cofre). Com certificado de teste, segue funcionando nos testes. RSA-SHA1 e RSA-SHA256 estão implementados e verificados de forma independente (doc 29); a escolha final sai da leitura autenticada.

## 5. Compatibilidade com mTLS

Testado contra um servidor **local** que exige certificado de cliente (CA, servidor e cliente fictícios gerados na hora, `src/tests/unit/wjb-ai-sefin-readonly.test.ts`):
- o cliente apresenta o certificado e o servidor identifica o titular;
- certificado fora da cadeia confiável é recusado no handshake;
- TLS 1.2 como mínimo.

**Achado:** o **Node 24 (OpenSSL 3) não abre PFX com criptografia legada** (RC2-40 ou 3DES, comum em arquivos gerados por ferramentas antigas ou exportados do Windows): erro "Unsupported PKCS12 PFX data". Um PFX moderno (AES-256) funciona. O script de verificação mostra qual é o caso. Se for legado, a conversão para AES-256 é feita **uma vez, localmente, pela responsável**, no momento de entrada no cofre, com o OpenSSL. Nunca no servidor da plataforma nem por terceiros.

## 6. Arquitetura recomendada

```
Responsável (computador dela)
  1. verifica com o script local (sem rede)  ->  relatório sem dados sensíveis para a equipe
  2. se legado, converte para AES-256 (local)
  3. cadastra no COFRE pelo console, com MFA (o projeto nunca vê o arquivo)
                     |
                     v
Cofre exclusivo de homologação (gerenciador de segredos; nada contratado ainda)
                     |  só por useCertificate (reconfere autorização, impressão digital e titular; grava a trilha)
                     v
Processo de transmissão isolado (fora do site da Hostinger)
  - leitura autenticada: sefinReadOnly (GET docs / HEAD /dps; produção restrita; travas no código)
  - assinatura: bloqueada até o algoritmo ser confirmado
                     |
                     v
Trilha imutável fiscal_certificate_usage (0028) + alertas (vencimento, uso negado)
```

| Controle | Onde |
| --- | --- |
| Custódia | só no cofre; banco guarda referência `vault://`, titular, validade e impressão digital |
| Acesso restrito | só `useCertificate`; nenhuma tela, rota ou agente chama o cofre |
| Auditável | cada uso (ok, negado, erro) na trilha imutável |
| Só com autorização expressa | leitura da SEFIN exige `WJB_AI_SEFIN_READ_AUTHORIZED=true` + registro de quem autorizou, quando e o escopo; assinatura exige ainda o algoritmo confirmado |
| Primeira operação só de leitura | `sefinReadOnly` aceita **apenas** GET em caminhos de documentação (`docs`/`swagger`) e HEAD em `/dps/{id}`; emissão, eventos e consulta de nota são recusados **antes de abrir conexão**; hosts só de produção restrita |

## 7. Checklist para autorizar a primeira conexão oficial (só leitura)

**Certificado**
- [ ] Avaliação de comprometimento (seção 1) respondida pela responsável; se houver qualquer "sim", certificado revogado e novo emitido.
- [ ] Relatório do script local recebido, com: tipo **e-CNPJ**, CNPJ **confere** com o da WJB, validade com folga (mais de 30 dias), Autenticação de Cliente e Assinatura Digital + Não Recusa, não é AC, chave RSA de 2048 bits ou mais, chave corresponde ao certificado.
- [ ] Cadeia ICP-Brasil conferida (`--cadeia`) e revogação conferida (`--verificar-revogacao`), ou conferência equivalente pela AC.
- [ ] Se for e-CPF: decisão registrada da WJB de emitir um e-CNPJ antes de seguir.

**Cofre e acesso**
- [ ] Cofre aprovado pela WJB (nenhum contratado ainda), exclusivo de homologação, com MFA e trilha do provedor ligada.
- [ ] PFX (convertido para AES-256, se legado) cadastrado pela responsável no console do cofre; impressão digital registrada na autorização do modelo B da WJB.
- [ ] Processo de transmissão separado do site, com papel de acesso que só lê aquele segredo.

**Autorização**
- [ ] Autorização escrita da WJB: quem autoriza, data e escopo "leitura da documentação e consulta HEAD /dps em produção restrita".
- [ ] `WJB_AI_SEFIN_READ_AUTHORIZED=true` só no processo de transmissão de homologação, e desligada depois da leitura.

**Execução (quando autorizada)**
- [ ] Ler o swagger da SEFIN e do ADN de produção restrita e guardar em `docs/wjb-ai/oficial/swagger/` com SHA-256 e data.
- [ ] Opcional: um HEAD `/dps/{id}` de uma DPS inexistente, para confirmar a conexão.
- [ ] Atualizar a matriz de contratos (doc 29, seção 4) e confirmar o algoritmo de assinatura; só então liberar o assinador para certificado real.
- [ ] Conferir a trilha de uso do certificado depois da leitura.
- [ ] Nova autorização da WJB para qualquer emissão de teste (doc 25, seção 7).
