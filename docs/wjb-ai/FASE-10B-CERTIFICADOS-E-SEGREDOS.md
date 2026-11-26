# Fase 10B - Certificados e segredos

**Data:** 26/11/2026.
**Este documento não contém** certificado, chave, senha, CPF ou caminho de arquivo privado.

## 1. Incidente do certificado (26/11/2026)
Um arquivo PFX com a chave privada de um certificado da WJB foi compartilhado numa conversa, junto com a senha. A partir daí, o certificado deve ser tratado como **comprometido**.

**Trocar a senha do PFX não resolve:** quem copiou o arquivo antes da troca continua com a chave privada.

**O projeto nunca abriu, importou, leu ou guardou esse arquivo, e continua sem fazer isso.** Por isso o código bloqueia o certificado sem conhecê-lo, por regra (seção 3).

### Checklist da WJB (fora do sistema)
- [ ] A titular pede à Autoridade Certificadora a **revogação** do certificado exposto e guarda o protocolo.
- [ ] Conferir que o certificado aparece como revogado (LCR/OCSP da AC). A SEFIN rejeita certificado revogado (E1206).
- [ ] Pedir a **reemissão**. Para emitir pela WJB (modelo A), o novo certificado deve ser **e-CNPJ da WJB**, tipo A1 ou A3, com Assinatura Digital, Não Recusa e Autenticação de Cliente.
- [ ] Nova senha forte e exclusiva, entregue por canal separado do arquivo, nunca por chat, e-mail, issue ou commit.
- [ ] Apagar as cópias do PFX exposto em todos os lugares onde ele passou (downloads, área de transferência, histórico de conversa, backups locais).
- [ ] Opcional: calcular, **no próprio computador e sem rede**, a impressão digital SHA-256 do certificado revogado, com `scripts/wjb-ai/certificado/verificar-certificado.mjs`, e colocá-la em `CERTIFICATE_POLICY.compromisedFingerprints`. A impressão digital é dado público do certificado. Esse passo é uma segunda barreira; a primeira (data de emissão) já vale sem ele.
- [ ] O certificado novo só entra no projeto com **nova autorização expressa**, depois da contratação do cofre (seção 4).

## 2. Arquitetura (o que existe no código)
| Peça | Arquivo | Estado |
| --- | --- | --- |
| Assinador simulado (`FakeSigner`) | `national/signing.ts` (`SimulatedDpsSigner`) | ativo; marca SIMULADO |
| Assinador XMLDSig real (`VaultSigner`) | `national/signing.ts` (`XmlDsigDpsSigner`) | existe; recusa certificado real enquanto o algoritmo não for confirmado (`AlgorithmNotConfirmedError`) |
| Cofre | `certificate-vault.ts` | `createCertificateVault()` **recusa**; só `TestCertificateVault` (`vault://teste/`) |
| Uso do certificado | `useCertificate` | reavalia a autorização, confere impressão digital e titular, aplica a **política** (seção 3) e grava a trilha |
| Política de certificado | `national/certificate-policy.ts` (novo) | falha fechada |
| Transporte simulado (`FakeTransport`) | `national/simulated-transport.ts` | ativo |
| Transporte oficial (`OfficialTransport`) | `national/official-transport.ts` (novo) | cliente HTTP injetado; só produção restrita; cliente real exige o comprovante do portão |
| Portão de transmissão | `national/transmission-gate.ts` (novo) | sempre bloqueado nesta fase; audita cada recusa |

**Sequência de um envio oficial, quando liberado:**
1. O portão abre e emite o comprovante.
2. O transporte oficial é criado com esse comprovante.
3. `useCertificate` confere a autorização, a impressão digital, o titular e a política.
4. Assinatura.
5. mTLS.

Qualquer falha em um desses passos impede o envio, e a recusa fica registrada.

## 3. Política de certificado (falha fechada)
| Regra | Código de bloqueio |
| --- | --- |
| Certificado da WJB emitido antes de 26/11/2026 00:00 (Brasília), em **qualquer** modelo: o exposto e as cópias dele | `CERT_ISSUED_BEFORE_INCIDENT` |
| Modelo A exige e-CNPJ (e-CPF recusado) | `WJB_CERT_NOT_ECNPJ` |
| Impressão digital na lista de comprometidos (aceita formato com dois-pontos e maiúsculas) | `CERT_COMPROMISED` |
| Cadeia sem âncora confiável; AC vencida; cadeia longa | `CERT_CHAIN_UNTRUSTED`, `CERT_CHAIN_EXPIRED`, `CERT_CHAIN_TOO_LONG` |
| Sem repositório ICP-Brasil configurado | `CERT_CHAIN_UNVERIFIED` |
| Revogado; revogação desconhecida; sem verificador | `CERT_REVOKED`, `CERT_REVOCATION_UNKNOWN`, `CERT_REVOCATION_UNVERIFIED` |
| Chave diferente de RSA ≥ 2048; certificado assinado fora de SHA-256/384/512 com RSA | `CERT_KEY_UNSUPPORTED`, `CERT_SIGNATURE_ALGORITHM` |
| Certificado de AC usado como certificado final; sem Assinatura Digital ou Autenticação de Cliente | `CERT_LEAF_IS_CA`, `CERT_LEAF_USAGE` |
| Fora da validade (comparada por instante, não por dia) | `CERT_OUT_OF_VALIDITY` |
| Configuração inválida (impressão digital malformada) | erro na carga: o bloqueio nunca é desligado em silêncio |

A trilha (`fiscal_certificate_usage` e `audit_log`) guarda só a impressão digital pública, o ambiente, o resultado e os códigos. Nunca guarda chave, senha, a referência `vault://`, CPF ou CNPJ.

## 4. Custódia recomendada (nada contratado)
| Requisito | Por quê |
| --- | --- |
| Gerenciador de segredos com **acesso só do servidor**, chave nunca exportada para o navegador nem para o banco | a chave privada é o ativo mais sensível |
| Assinatura **RSA-SHA1** possível, se a documentação vigente confirmar o Manual de 2022 | o AWS KMS não assina SHA-1 (doc 29); a escolha do cofre depende dessa confirmação |
| Segregação de funções: quem cadastra o certificado não aprova o uso; aprovação de perfil fiscal com MFA (0035) | uma conta comprometida sozinha não emite |
| Registro de cada uso (já existe: `useCertificate` + 0028) e alerta de uso fora do horário ou em volume | detecção |
| Rotação: certificado novo antes do vencimento (alerta de 30 dias já existe) e revogação imediata em suspeita | |
| MFA no painel do cofre, na Hostinger e no Supabase | credenciais administrativas ignoram a RLS (doc 53) |
| Raízes ICP-Brasil baixadas do ITI, conferidas por SHA-256 e versionadas; verificação LCR/OCSP | hoje `createIcpBrasilTrustStore()` e `createRevocationChecker()` recusam |

Custos de referência ficam no doc 26. **Nenhuma contratação foi feita.**

## 5. Segredos do projeto
- `.gitignore` bloqueia `*.pfx`, `*.p12`, `*.key`, `*.pem`, `*.crt`, `*.cer`, `*.der`.
- Teste automático (`wjb-ai-fase10b.test.ts`): nenhuma rota, ação ou componente aceita PFX/P12 ou chave privada.
- Certificados de teste são gerados na hora (`src/tests/helpers/test-pki.ts`), não têm relação com a ICP-Brasil e são apagados no fim.
- Chaves da Stripe: só de teste (`sk_test_`), lidas de `.env.stripe.local` (permissão 600, fora do Git). Código e banco recusam modo live.
- Homologação Supabase: `.env.homolog.local` (600), e os scripts recusam a referência da produção.
