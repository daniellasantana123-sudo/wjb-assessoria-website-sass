# Fase 10C - Gestão de certificados digitais

**Data:** 26/11/2026. **Branch:** `feature/wjb-fase-10c`. **Ambiente:** local e homologação (`wjb-ai-homologacao`).

Nenhum certificado real foi usado, aberto ou pedido nesta fase. O certificado da WJB exposto antes da Fase 10B continua bloqueado por regra de código, sem que o projeto conheça o arquivo.

## 1. O que já existia (Fases 6 e 10B, preservado)
- Cofre só por referência `vault://...`. Nenhum cofre real contratado: `createCertificateVault()` recusa.
- Política aplicada ao certificado real a cada uso (`certificate-policy.ts`), sempre com falha fechada:
  - cadeia até uma âncora confiável;
  - revogação: sem verificador ou com resposta "desconhecida", recusa;
  - chave RSA de 2048 bits ou mais, e assinatura do certificado só com SHA-256, SHA-384 ou SHA-512;
  - o certificado final não pode ser de AC e precisa de Assinatura Digital e Autenticação de Cliente;
  - **incidente:** certificado da WJB emitido antes de 26/11/2026 00:00 (Brasília) é recusado em qualquer modelo;
  - o modelo A exige e-CNPJ;
  - lista de impressões digitais comprometidas no código.
- Trilha imutável de uso (`fiscal_certificate_usage`), só com impressão digital e códigos.
- Leitor local do certificado (`scripts/wjb-ai/certificado/verificar-certificado.mjs`): roda no computador da titular, sem rede, e nunca exporta a chave.

## 2. O que a Fase 10C acrescentou
| Requisito do documento da Fase 10C | Como ficou | Onde |
| --- | --- | --- |
| Tipo do certificado | e-CNPJ obrigatório no modelo A; A1/A3 registrado | política + `fiscal_certificates.kind` |
| Titularidade e CNPJ | titular do registro = titular do certificado no cofre; rotação só para o mesmo titular (também conferido no banco); papel WJB exige o CNPJ da WJB; e-CNPJ de cliente precisa ser da própria empresa (conferido no banco) e certificado da WJB nunca entra como "cliente" | `evaluateRotation` (`ROTATION_HOLDER`, `WJB_HOLDER`, `CLIENT_HOLDER_*`), 0037 |
| Cadeia ICP-Brasil | a rotação **fora de testes** exige repositório ICP-Brasil real (`kind: "icp-brasil"`) | `VERIFICATION_NOT_REAL` |
| Integridade | impressão digital do material no cofre = a registrada, no cadastro, na rotação e em cada uso | `VAULT_MATERIAL_CHANGED`, `CERT_FINGERPRINT_MISMATCH` |
| Validade e expiração | o certificado novo precisa durar 7 dias ou mais; o vencido não é ativado (banco) | `CANDIDATE_EXPIRES_SOON`, gatilho da 0036 |
| Revogação | a rotação reaplica a política: revogado entre o cadastro e a troca = recusa | teste "revogado entre o cadastro e a rotação" |
| Fingerprint | a impressão digital SHA-256 identifica o certificado: registro único, bloqueio e trilha | migration 0036 |
| **Chave pública** (revisão de segurança) | o comprometimento é da **chave**: um certificado reemitido com o mesmo par de chaves tem outra impressão digital. O SHA-256 da chave pública (SPKI) é registrado; a chave de todo certificado retirado entra numa lista permanente própria, e a rotação para um certificado com a mesma chave é recusada | migration 0037, `ROTATION_SAME_KEY` |
| **Bloqueio permanente** | tabelas `fiscal_certificate_blocklist` e `fiscal_certificate_key_blocklist`: nem o servidor altera, apaga ou esvazia (gatilhos de UPDATE, DELETE e TRUNCATE). Única exceção: apagar o perfil de quem bloqueou zera o autor, e o bloqueio continua | migrations 0036 e 0037 |
| **Rotação segura** | um único ativo por titular; a troca é atômica e o anterior vira "substituído" e entra na lista permanente | `rotate_fiscal_certificate`, `rotateToCertificate` |
| RBAC | leitura só da equipe, e só das colunas públicas (documento do titular e referência do cofre não saem pela API); bloqueio manual só do super admin; rotação e cadastro só pelo servidor | RLS + funções da 0036, permissão por coluna da 0037 |
| MFA | leitura e bloqueio exigem sessão com MFA (aal2) **no banco**, e a ação da tela exige MFA recente | políticas restritivas + `require_aal2()` + `criticalGuard` |
| Auditoria sem segredos | bloqueio gravado no `audit_log` só com motivo e o início da impressão digital | `blockCertificateAction` |
| **Alertas de 90, 60, 30, 15 e 7 dias** | aviso uma vez por certificado e marco, mais o aviso de vencido; o de 7 dias é crítico. O marco é reservado antes do envio (sem aviso em dobro) e liberado se o aviso não for gravado (não se perde). Registro fora do ar aparece na resposta da rota | `planExpiryNotices`, `deliverExpiryNotices`, rota `/api/wjb-ai/cron/alertas` |
| Isolamento entre tenants | o certificado de uma empresa nunca gira o de outra; cliente não vê nenhum certificado, nem o da própria empresa | teste de isolamento, T229, C16 |
| Procurações eletrônicas | já existiam (modelo A, Fase 5); agora a procuração aponta para um certificado que precisa estar **ativo** no registro | `useCertificate` + `lifecycleBlocker` |

**A data de emissão nunca prova segurança.** O corte de 26/11 só *recusa* os certificados antigos. Para *aceitar* um certificado novo, continuam obrigatórias:
- a cadeia ICP-Brasil real;
- a consulta de revogação real;
- o algoritmo;
- o titular.

Tudo isso é conferido no cadastro, na rotação e em cada uso.

## 3. Uso do certificado (ordem das verificações)
1. Ambiente de produção: recusa nesta fase.
2. A autorização de emissão é reavaliada na hora, porque a procuração pode ter sido revogada.
3. O material é lido do cofre.
4. A impressão digital e o titular do material são comparados com a autorização.
5. **Novo:** o certificado precisa estar *ativo* no registro, **no modelo e na empresa do pedido** (o ativo de outra empresa não serve), e nem a impressão digital nem a chave podem estar nas listas permanentes. Registro ausente ou fora do ar = uso negado (`CERT_LIFECYCLE_UNVERIFIED`, `CERT_LIFECYCLE_UNAVAILABLE`, `CERT_ROLE_MISMATCH`, `CERT_TENANT_MISMATCH`).
6. A política completa é aplicada: cadeia, revogação, algoritmo e incidente.
7. Só então o certificado é usado, e cada resultado entra na trilha.

## 4. Tela do Admin
`/admin/nfse/certificados` (aparece só com o módulo WJB AI ligado):
- **registro:** titular (WJB ou nome da empresa), impressão digital abreviada, validade com o marco atual e status;
- **bloqueios permanentes:** motivo e data;
- **formulário "Bloquear certificado":** só para o super admin. Recebe **só** a impressão digital SHA-256, que é dado público do certificado, e exige digitar BLOQUEAR. O servidor recusa qualquer texto com cara de chave ou senha.

O bloqueio manual é por impressão digital do certificado. Se o certificado nunca foi registrado, a chave dele não é conhecida, e só a impressão digital fica bloqueada. Para certificados registrados, bloquear também bloqueia a chave.

O cadastro e a rotação **não têm botão**: sem cofre contratado, não há de onde ler o certificado, e a tela diz isso.

## 5. Como a WJB vai bloquear o certificado exposto (quando quiser)
1. No computador da titular, rodar `node scripts/wjb-ai/certificado/verificar-certificado.mjs`. A senha é digitada sem aparecer na tela e nada sai da máquina.
2. Copiar só a linha "Impressão digital SHA-256".
3. Um super admin, com MFA, cola essa linha em `/admin/nfse/certificados`.

Isso é opcional: o corte por data já recusa o certificado. Mas registra o bloqueio de forma explícita e permanente.

## 6. Recebimento do novo e-CNPJ (sequência segura)
1. A titular revoga o certificado antigo na AC e guarda o protocolo.
2. Emissão do novo e-CNPJ, que precisa ser emitido depois de 26/11/2026. A senha nova é entregue por canal separado, **nunca pelo chat**.
3. Contratação do cofre (doc 06) e implementação de `createCertificateVault()`, de `createIcpBrasilTrustStore()` (raízes do ITI conferidas por SHA-256) e de `createRevocationChecker()` (LCR/OCSP).
4. A titular importa o PFX **direto no cofre**. O PFX nunca passa pelo repositório, pelo Supabase, pelo chat nem por logs.
5. O servidor cadastra o certificado como pendente, a partir do cofre, depois de aplicar a política completa.
6. Um super admin com MFA aprova a rotação. O ativo anterior, se houver, fica bloqueado para sempre.

## 7. Onde nunca fica certificado, senha ou chave
- GitHub;
- frontend;
- localStorage ou sessionStorage;
- logs;
- arquivos versionados;
- Supabase;
- chat.

O `.gitignore` bloqueia `*.pfx`, `*.p12`, `*.key`, `*.pem`, `*.crt`, `*.cer` e `*.der`. A varredura desta fase está no doc 02.
