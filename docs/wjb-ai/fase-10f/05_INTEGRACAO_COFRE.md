# Fase 10F - Cofre de certificados (AWS Secrets Manager; Azure como alternativa)

**Situação:** adaptadores prontos e testados com *fetch* falso (Fase 10D). **Nenhum serviço contratado.** `createCertificateVault()` continua recusando.

## 1. Arquitetura (revisada nesta fase)
| Camada | Proteção |
| --- | --- |
| Arquivo no cofre | JSON `wjb-cert-v1` com a chave **cifrada** (PKCS#8, AES-256-CBC) e o certificado público |
| Senha da chave | **segredo separado** (`<nome>-senha`): quem tiver só um dos dois não usa a chave |
| Cofre | AWS Secrets Manager cifra cada segredo com uma chave KMS (padrão `aws/secretsmanager` ou chave própria) |
| Transporte | HTTPS com SigV4 próprio (conferido no vetor oficial da AWS), sem SDK |
| Leitura | `materialFromSecrets`: recusa chave sem cifra, senha errada e certificado que não corresponde à chave, sempre com o mesmo erro, sem detalhe |
| Uso | `useCertificate` reavalia autorização, ciclo de vida, papel e empresa a cada uso e grava a trilha |

O servidor **nunca escreve** no cofre: a titular grava pelo console (doc 04, seção 2).

## 2. Privilégio mínimo (AWS)
Usuário IAM dedicado só para a aplicação. Política proposta, **um par de ARNs por certificado** (sem curinga para outros segredos):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "LerSoOsCertificadosDaWjb",
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": [
        "arn:aws:secretsmanager:sa-east-1:<conta>:secret:wjb-cert-<nome>-??????",
        "arn:aws:secretsmanager:sa-east-1:<conta>:secret:wjb-cert-<nome>-senha-??????"
      ]
    }
  ]
}
```
- Com chave KMS própria, acrescentar `kms:Decrypt` só nessa chave, com a condição `kms:ViaService = secretsmanager.sa-east-1.amazonaws.com`.
- **Sem** `PutSecretValue`, `CreateSecret`, `DeleteSecret` ou `ListSecrets` para a aplicação.
- Gravação: usuário humano separado (a titular), com MFA no console.
- **Isolamento entre empresas:** a referência `vault://aws/<nome>` fica gravada no registro do certificado de cada empresa (RLS: a equipe não lê `vault_reference` pela API). Certificado de cliente só pode ser usado para a empresa dele (`CERT_TENANT_MISMATCH`), e o cadastro confere o CNPJ.

## 3. Rotação (testada com cofre de teste)
1. Novo segredo `wjb-cert-<nome-novo>`, gravado pela titular.
2. Cadastro do certificado novo como pendente (política completa).
3. Troca atômica (`rotate_fiscal_certificate`): o novo vira ativo e o anterior fica **bloqueado para sempre**, por impressão digital e por chave.
4. Só depois: apagar o segredo antigo no cofre (agendamento de exclusão de 7 a 30 dias da AWS).

Testes: `wjb-ai-fase10c.test.ts` (cadastro, ativação, rotação, bloqueio do anterior, uso negado depois) e `wjb-fase10d-vault.test.ts` (adaptadores AWS e Azure, formato, erros).

## 4. Estimativa de custos (referência pública, conferir na calculadora oficial no dia da contratação)
| Item | AWS Secrets Manager | Azure Key Vault (Standard) |
| --- | --- | --- |
| Armazenamento | ≈ US$ 0,40 por segredo por mês → **2 segredos por certificado ≈ US$ 0,80/mês** | sem cobrança por segredo guardado |
| Chamadas | ≈ US$ 0,05 por 10 mil chamadas | ≈ US$ 0,03 por 10 mil operações |
| Chave de cifragem | `aws/secretsmanager`: sem custo mensal; chave KMS própria: ≈ US$ 1/mês + ≈ US$ 0,03 por 10 mil usos | chave gerenciada: sem custo; HSM (Premium) cobra à parte |
| Exemplo: certificado da WJB (modelo A, procuração) | **≈ US$ 1 a 2 por mês** | **< US$ 1 por mês** |
| Exemplo: 50 clientes com certificado próprio (modelo B) | ≈ US$ 40/mês (100 segredos) + chamadas | ≈ poucos dólares por mês |

**Fora do cofre**, já registrado na Fase 10C: certificado A1 da WJB (≈ R$ 150 a 300 por ano), conta AWS ou Azure com cobrança em dólar (IOF de cartão internacional) e horas de configuração.

**Recomendação:** AWS Secrets Manager com o modelo A (só o certificado da WJB, com procuração dos clientes), que mantém o custo perto de US$ 2/mês. Azure fica como alternativa se a WJB já tiver conta Microsoft com faturamento.

## 5. Para ativar (depende de autorização e contratação)
- [ ] Autorização da contratação e do custo.
- [ ] Conta na região `sa-east-1` com MFA no usuário raiz e alerta de cobrança.
- [ ] Usuário IAM da aplicação com a política da seção 2; chave de acesso guardada **só** no servidor (nunca `NEXT_PUBLIC_*`, nunca no `.env` compartilhado com prévias).
- [ ] Certificado novo gravado pela titular (doc 04).
- [ ] Implementar `createCertificateVault()` lendo a configuração em tempo de execução (o adaptador já existe).
