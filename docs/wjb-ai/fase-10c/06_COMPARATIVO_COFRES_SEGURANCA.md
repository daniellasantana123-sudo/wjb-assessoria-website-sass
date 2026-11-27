# Fase 10C - Comparativo de cofres para o certificado A1

**Data da pesquisa:** 26/11/2026. **Fontes:** só documentação pública dos fornecedores; URLs no fim. **Nada foi contratado** e nenhuma conta foi criada.

## 1. Três coisas diferentes
| Categoria | O que faz | Exemplos |
| --- | --- | --- |
| **Armazenamento de segredos** | guarda o PFX (e a senha) criptografado e entrega o arquivo a quem tem permissão; a chave privada **sai** do serviço e vai para a memória do servidor | AWS Secrets Manager, Google Secret Manager, Azure Key Vault (segredos/certificado exportável), Vault KV |
| **Gerenciamento de chaves (KMS/HSM)** | guarda a chave **sem deixá-la sair**; o serviço executa as operações com ela | AWS KMS, Azure Key Vault (chave não exportável), Azure Managed HSM, Google Cloud KMS, Vault Transit |
| **Operação criptográfica** | assinar, decifrar, fazer TLS | assinatura do XML e handshake mTLS |

O certificado A1 precisa de **duas** operações com a mesma chave:
- **assinar o XML** da DPS (XMLDSig);
- **autenticar o cliente** na conexão mTLS com a SEFIN.

## 2. Requisitos que decidem
1. **Algoritmo:** o único documento oficial que descreve a assinatura (Manual Integrado v1.00.02, 2022) indica **RSA-SHA1** (PKCS#1 v1.5 com SHA-1). **Não está confirmado** que ainda vale: só o swagger ou um manual autenticado vigente confirmam.
2. **mTLS no Node.js:** o `tls.createSecureContext` só aceita a chave em memória (`key`/`pfx`). A alternativa por *engine* de OpenSSL está **obsoleta** no OpenSSL 3, e a documentação não traz nenhum callback de assinatura para certificado de cliente. **Conclusão: com a arquitetura atual, o mTLS exige a chave na memória do servidor.**
3. **Hospedagem atual:** Hostinger, sem conta em AWS, Azure ou GCP.

## 3. Comparativo
| Serviço | PFX/A1 | Chave não exportável | Assina RSA-SHA1? | mTLS no Node | Preço de referência |
| --- | --- | --- | --- | --- | --- |
| **AWS Secrets Manager** | guarda o PFX como segredo (até 64 KB) | não (entrega o arquivo) | não assina | sim (PFX vai para a memória) | US$ 0,40/segredo/mês + US$ 0,05/10 mil chamadas |
| **AWS KMS** | importa chave RSA | sim | **não**: só SHA-256/384/512, sem modo raw | não | US$ 1/chave/mês; custo por assinatura RSA não confirmado |
| **Azure Key Vault (certificados)** | importa PFX/PEM | opcional (política) | não há RS1; há **RSNULL** ("cenários TLS"). Montar o DigestInfo SHA-1 no cliente é dedução **não confirmada** | só se exportável | não confirmado (página sem valores) |
| **Azure Managed HSM** | importa chave | sim | mesmos algoritmos (RSNULL, sem RS1) | não | por hora por pool; valor não confirmado |
| **Google Secret Manager** | guarda o PFX | não | não assina | sim | não confirmado |
| **Google Cloud KMS** | importa chave RSA | sim (não dito explicitamente) | sem SHA-1, mas tem **RSA_SIGN_RAW_PKCS1_2048**: DigestInfo montado no cliente | não | não confirmado |
| **HashiCorp Vault Transit** | importa rsa-2048 (BYOK) | sim (padrão; uma vez exportável, não volta) | **sim**: `hash_algorithm=sha1` + `pkcs1v15` (marcado como legado); também `prehashed` | não | HCP: não confirmado; autohospedado: sem licença na edição comunitária (não confirmado) |
| **HashiCorp Vault KV** | guarda o PFX | não | não assina | sim | o mesmo do Vault |

"Não confirmado" quer dizer que a página oficial não trazia o valor ou a afirmação explícita. Não chutamos preço.

## 4. Recomendação técnica

### Agora (1º teste oficial, produção restrita): **cofre de segredos**
Escolher **AWS Secrets Manager**, ou **Azure Key Vault** com o certificado guardado como segredo. Motivos:
- é o único arranjo que atende ao mesmo tempo o mTLS e a assinatura, **qualquer que seja o algoritmo** confirmado;
- custo baixo: cerca de US$ 0,40 por mês por certificado, mais as chamadas (AWS);
- a chave existe na memória do servidor só durante o uso, e o código já faz isso: carrega do cofre, usa e descarta;
- auditoria do lado do provedor (CloudTrail ou logs do Key Vault), somada à trilha própria (`fiscal_certificate_usage`).

**Controles obrigatórios:**
- credencial de leitura do cofre **só** no servidor, com permissão para ler um único segredo;
- MFA na conta do provedor;
- alerta de leitura fora do padrão;
- rotação da credencial de acesso.

### Depois (endurecimento): **chave não exportável para a assinatura**
Se o algoritmo vigente for confirmado:
- **RSA-SHA1:** HashiCorp Vault Transit (assina SHA-1 direto) ou Google Cloud KMS (assinatura raw).
- **SHA-256:** também AWS KMS e Azure.

O mTLS continua precisando da chave na memória, ou de um proxy TLS dedicado com HSM. Fica para quando houver volume que justifique.

### Descartado nesta arquitetura
**AWS KMS como cofre único.** Ele não assina SHA-1 e não serve para mTLS no Node.js.

## 5. Financeiro (referência, sem contratação)
| Cenário | Custo mensal estimado |
| --- | --- |
| AWS Secrets Manager, 1 certificado da WJB + 10 de clientes (modelo B) | cerca de US$ 4,40 + chamadas (baixo; depende do volume de emissão) |
| + AWS KMS para chaves | +US$ 1 por chave por mês (não resolve SHA-1) |
| HCP Vault | não confirmado; pedir proposta |
| Azure Key Vault / Managed HSM | não confirmado; usar a calculadora oficial |

Fora o cofre, há custos que a WJB precisa considerar:
- conta no provedor (AWS ou Azure), com responsável e MFA;
- tempo de configuração;
- monitoramento.

Nada disso foi contratado.

## 6. Decisão pedida à WJB
1. Provedor do cofre: AWS ou Azure (recomendado: o que a WJB já tiver ou preferir administrar).
2. Responsável pela conta e pelo MFA.
3. Aprovação do custo mensal estimado.
4. Só depois: implementar `createCertificateVault()` (`kind: "gerenciador-de-segredos"`), com testes em homologação.

## Fontes
- AWS KMS, algoritmos: https://docs.aws.amazon.com/kms/latest/developerguide/symm-asymm-choose-key-spec.html
- AWS KMS, importação: https://docs.aws.amazon.com/kms/latest/developerguide/importing-keys.html
- AWS KMS, preço: https://aws.amazon.com/kms/pricing/
- AWS Secrets Manager, preço: https://aws.amazon.com/secrets-manager/pricing/
- AWS Secrets Manager, limites: https://docs.aws.amazon.com/secretsmanager/latest/userguide/reference_limits.html
- Azure Key Vault, chaves: https://learn.microsoft.com/en-us/azure/key-vault/keys/about-keys-details
- Azure Managed HSM: https://learn.microsoft.com/en-us/azure/key-vault/managed-hsm/about-keys-details
- Azure Key Vault, certificados: https://learn.microsoft.com/en-us/azure/key-vault/certificates/about-certificates
- Azure Key Vault, preço: https://azure.microsoft.com/en-us/pricing/details/key-vault/
- Google Cloud KMS, algoritmos: https://docs.cloud.google.com/kms/docs/algorithms
- Google Cloud KMS, importação: https://docs.cloud.google.com/kms/docs/importing-a-key
- Google Cloud, preços: https://cloud.google.com/kms/pricing e https://cloud.google.com/secret-manager/pricing
- Vault Transit: https://developer.hashicorp.com/vault/api-docs/secret/transit
- HashiCorp, preços: https://www.hashicorp.com/en/pricing
- Node.js TLS: https://nodejs.org/api/tls.html
