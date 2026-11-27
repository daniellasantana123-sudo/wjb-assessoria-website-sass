# Fase 10F - Infraestrutura do certificado digital A1

**Situação:** a infraestrutura está desbloqueada e testada **só com certificados fictícios gerados na hora**. O **certificado exposto continua bloqueado** e todos os mecanismos das fases 10B a 10E foram preservados. Usar um certificado real depende da **substituição**: certificado novo, não comprometido e com **novo par de chaves**.

## 1. Mapa do que foi pedido
| Item | Situação | Onde |
| --- | --- | --- |
| Interface administrativa | pronta (10C) + **conferência de certificado novo (10F)** | `/admin/nfse/certificados` |
| Upload protegido por MFA | **novo**: só super admin com MFA recente | `validateCertificateUploadAction` |
| Formato | **novo**: aceita `.cer`/`.crt` (DER) e `.pem` com um certificado; recusa PFX/P12 e qualquer arquivo com chave privada **sem ler** | `certificate-upload.ts` |
| Titularidade (e-CNPJ ou e-CPF) | pronta (OtherName ICP-Brasil, leitor DER próprio) | `certificate-inspect.ts` |
| CNPJ da empresa | pronta: e-CNPJ de cliente = CNPJ da empresa; da WJB nunca como cliente | `evaluateRotation` |
| Cadeia ICP-Brasil | pronta por interface; **âncoras reais não configuradas** (falha fechada) | `verifyChain`, `createIcpBrasilTrustStore` |
| Revogação | pronta por interface; **LCR/OCSP real não configurado** (falha fechada) | `RevocationChecker` |
| Validade e incidente de 26/11 | prontos (certificado da WJB emitido antes de 26/11 00:00 é recusado) | `certificate-policy.ts` |
| Criptografia | chave só cifrada (PKCS#8 AES-256) no cofre, nunca na plataforma | doc 05 |
| Controle de acesso | super admin para conferir, cadastrar, bloquear; RLS por coluna (equipe não lê documento do titular nem referência do cofre) | 0036/0037 |
| Rotação segura | pronta: atômica, mesmo titular, **outra chave**, o anterior fica bloqueado para sempre | `rotate_fiscal_certificate` |
| Bloqueio permanente | pronto: por impressão digital **e** por chave pública | 0036/0037 |
| Auditoria de uso | pronta: trilha imutável `fiscal_certificate_usage` + `fiscal.certificate_upload_checked` | 0028 |
| Alertas 90, 60, 30, 15, 7 dias e no vencimento | prontos (10C), aviso único por marco | `certificate-lifecycle.ts`, rota de alertas |

## 2. Decisão de desenho: o "upload" recebe só a parte pública
A plataforma **nunca recebe a chave privada nem a senha**. Motivos:
- o servidor tem só permissão de **leitura** no cofre (privilégio mínimo). Receber a chave pela web exigiria permissão de escrita e faria o segredo passar pelo servidor, por logs de proxy e pela memória do processo;
- um PFX enviado pela web é exatamente o tipo de material que foi exposto em 26/11.

**Fluxo de substituição:**
1. A titular emite o certificado novo **com novo par de chaves** (reemissão com a mesma chave é recusada pela lista de chaves bloqueadas).
2. No computador dela, sem rede: `node scripts/wjb-ai/certificado/verificar-certificado.mjs` (titular, validade, compatibilidade; relatório sem documento completo).
3. Ela exporta **só o certificado público** (`.cer`) e o super admin o envia em **Conferir certificado novo**. O resultado mostra o documento mascarado, as datas, a impressão digital e **todos** os bloqueios.
4. A titular converte o PFX para o formato do cofre (`wjb-cert-v1`, doc 05) e grava os dois segredos **direto no console do cofre**; depois apaga as cópias locais.
5. A equipe cadastra pela referência do cofre (`registerCertificateFromVault`). A política roda de novo sobre o que veio do cofre, e o uso confere que a impressão digital é a mesma registrada.

## 3. O que foi testado
| Teste | Resultado |
| --- | --- |
| Unitário `wjb-fase10f-certificado-upload.test.ts` (PKI fictícia): chave privada e PFX recusados; vazio, grande e lixo recusados; cliente válido aceito sem expor o CNPJ inteiro; DER aceito; e-CNPJ de outra empresa recusado; chave bloqueada recusada; certificado da WJB anterior a 26/11 recusado; sem cadeia e revogação reais nada passa; certificado de AC recusado | **10/10** |
| Homologação `staging-fase10f.spec.ts` (Supabase de homologação, login real com MFA): arquivo com chave recusado; certificado fictício conferido e recusado por falta de cadeia real; nenhuma linha nova em `fiscal_certificates`; trilha sem conteúdo do arquivo; contador não vê o formulário | ver doc 00 |
| Regressão da 10C (ciclo de vida, rotação, bloqueio, uso) | sem mudança, segue passando |

## 4. Para usar um certificado real (bloqueado)
- [ ] Revogação do certificado exposto confirmada pela AC, com a nova impressão digital informada só pelo script local.
- [ ] Certificado novo, novo par de chaves.
- [ ] Âncoras ICP-Brasil (raiz e ACs intermediárias) configuradas em `createIcpBrasilTrustStore`.
- [ ] Verificação de revogação real (LCR/OCSP) configurada.
- [ ] Cofre contratado (doc 05) e autorização expressa.
