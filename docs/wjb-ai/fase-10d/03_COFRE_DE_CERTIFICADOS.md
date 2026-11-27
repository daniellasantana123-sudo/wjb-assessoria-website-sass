# Fase 10D - Cofre de certificados: adaptadores e configuração

**Data:** 26/11/2026. **Situação:** adaptadores **implementados e testados com cliente HTTP falso**. Nada foi contratado nem configurado: `createCertificateVault()` continua recusando, e ligar o cofre é o Portão 3 do go-live (autorização própria).

## 1. O que existe
| Peça | Arquivo | O que faz |
| --- | --- | --- |
| Assinatura AWS SigV4 | `src/lib/wjb-ai/fiscal/vault/aws-sigv4.ts` | assina requisições à AWS só com `node:crypto`, sem SDK. **Conferida contra o exemplo publicado pela AWS** (IAM ListUsers, `AKIDEXAMPLE`): assinatura idêntica |
| AWS Secrets Manager | `vault/secret-stores.ts` (`AwsSecretsManagerStore`) | `GetSecretValue` em `https://secretsmanager.<região>.amazonaws.com/` |
| Azure Key Vault | `vault/secret-stores.ts` (`AzureKeyVaultStore`) | token OAuth (`client_credentials`, escopo `https://vault.azure.net/.default`) e `GET https://<cofre>.vault.azure.net/secrets/<nome>?api-version=7.4`; o token é reaproveitado até 1 min antes de vencer e descartado em 401/403 |
| Cofre de certificados | `vault/secrets-manager-vault.ts` (`SecretsManagerCertificateVault`) | lê o par de segredos pela referência `vault://aws/<nome>` ou `vault://azure/<nome>`, abre a chave e confere que ela é do certificado |

**Garantias, todas testadas** (`wjb-ai-fase10d-vault.test.ts`, 13 testes):
- só HTTPS, só para o host oficial. O host vem de região ou nome do cofre validados por padrão, nunca de texto livre, o que impede desviar a chamada (SSRF);
- erros viram códigos (`VAULT_NOT_FOUND`, `VAULT_ACCESS_DENIED`, `VAULT_UNAVAILABLE`, `VAULT_BAD_RESPONSE`, `VAULT_CONFIG`). Nem o corpo da resposta nem o valor do segredo aparecem em mensagem ou log;
- tempo limite de 10 s por chamada;
- a chave privada precisa estar **cifrada** (PKCS#8) mesmo dentro do cofre; chave sem cifra, senha errada ou chave de outro certificado = recusa;
- a referência precisa ser do provedor configurado: um cofre AWS não lê `vault://azure/...`.

**Depois do cofre**, continuam valendo a cada uso:
- a política do certificado (cadeia ICP-Brasil, revogação, incidente de 26/11, chave pública bloqueada);
- o registro do ciclo de vida (só o ativo, do modelo e da empresa certos).

## 2. Formato no cofre (2 segredos por certificado)
| Segredo | Conteúdo |
| --- | --- |
| `<nome>` | JSON `{"format":"wjb-cert-v1","certificatePem":"-----BEGIN CERTIFICATE-----…","privateKeyPem":"-----BEGIN ENCRYPTED PRIVATE KEY-----…"}` |
| `<nome>-senha` | a senha da chave cifrada |

**Por que não guardar o PFX direto:** o Node não abre PKCS#12 sem biblioteca, e adicionar uma só para isso ampliaria a superfície de ataque. A conversão é feita **uma vez, pela titular, no computador dela**:

```sh
# no computador da titular; nada disso vai para o repositório nem para o chat
openssl pkcs12 -in certificado.pfx -clcerts -nokeys -out cert.pem
openssl pkcs12 -in certificado.pfx -nocerts -nodes | openssl pkcs8 -topk8 -v2 aes-256-cbc -out chave-cifrada.pem
# a segunda linha pede a senha do PFX e uma senha NOVA para a chave cifrada
# PFX antigo (cifra RC2/3DES) no OpenSSL 3: acrescente -legacy aos dois "openssl pkcs12"
```

Depois disso, ela grava os dois segredos direto no cofre, pelo console do provedor, e **apaga** `cert.pem`, `chave-cifrada.pem` e as cópias do PFX do computador.

## 3. Configuração futura (quando autorizado)
| Provedor | Variáveis (só no servidor, nunca `NEXT_PUBLIC_*`) | Permissão mínima |
| --- | --- | --- |
| AWS | região (ex.: `sa-east-1`), chave de acesso de um usuário IAM dedicado | `secretsmanager:GetSecretValue` só nos ARNs dos dois segredos |
| Azure | tenant, client id, client secret de uma aplicação dedicada, nome do cofre | papel "Key Vault Secrets User" só nesse cofre |

**Passos da ativação (Portão 3):**
1. contratar;
2. criar a identidade com a permissão mínima;
3. gravar as variáveis na Hostinger;
4. ligar a fábrica (`createCertificateVault()` passa a devolver `SecretsManagerCertificateVault`). Essa mudança de código é revisada;
5. cadastrar e girar o certificado novo (doc 05 da Fase 10C);
6. testar na homologação.

## 4. Limites que continuam
- **mTLS:** o handshake no Node exige a chave em memória. É o caso deste desenho (o cofre guarda o segredo e o servidor usa a chave só durante a operação). Chave **não exportável** (KMS/HSM) para o mTLS exigiria um proxy TLS dedicado; fica fora desta fase (doc 06 da Fase 10C).
- **Algoritmo de assinatura** ainda não confirmado em fonte vigente: o assinador recusa certificado real (`AlgorithmNotConfirmedError`).
