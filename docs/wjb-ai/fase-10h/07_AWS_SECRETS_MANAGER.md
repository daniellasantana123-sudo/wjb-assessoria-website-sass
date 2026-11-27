# Fase 10H - AWS Secrets Manager

**Situação:** preparado, **não contratado**. Guia completo de ativação e custos no doc 05 da Fase 10G; política de acesso mínimo no doc 05 da Fase 10F. Nada mudou no código nesta fase.

## 1. Validação dos itens pedidos
| Item | Situação | Evidência |
| --- | --- | --- |
| Adaptadores (AWS e Azure) | prontos; assinatura SigV4 própria conferida no vetor oficial da AWS | `wjb-fase10d-vault.test.ts` (unitários, na suíte de 767) |
| Política de acesso mínimo | só `GetSecretValue` nos 2 ARNs de cada certificado; gravação só pela titular | doc 05 da 10F |
| Criptografia | chave PKCS#8 cifrada + senha em segredo separado + KMS do cofre | `materialFromSecrets` recusa chave sem cifra, senha errada e chave que não corresponde ao certificado |
| Controle de acesso e isolamento entre empresas | uso conferido contra papel e empresa; equipe não lê a referência do cofre (RLS por coluna, 0037) | `wjb-ai-fase10c.test.ts`, banco T246 a T255 |
| Auditoria | `fiscal_certificate_usage` imutável + CloudTrail na AWS | 0028 |
| Rotação | troca atômica, anterior bloqueado para sempre | 10C |
| Alertas | vencimento (aplicação) + proposta de alarmes CloudWatch | doc 05 da 10G |
| Disponibilidade e falhas | 5xx → `VAULT_UNAVAILABLE`, 403 → `VAULT_ACCESS_DENIED`, segredo inexistente → `VAULT_NOT_FOUND`; uso **negado** em qualquer falha (falha fechada) | `secret-stores.ts`, testes 10D |
| Custos | ≈ US$ 1 a 3/mês no modelo A, + ≈ US$ 0,80 por cliente no modelo B | doc 05 da 10G |

## 2. Procedimento de ativação (depois da aprovação)
1. WJB aprova a conta e o custo.
2. Conta AWS `sa-east-1` com MFA no usuário raiz e orçamento de US$ 10/mês.
3. Usuário humano da titular (gravar) e usuário `wjb-app-cofre` (só ler), conforme o doc 05 da 10G.
4. Certificado **novo** gravado pela titular no formato `wjb-cert-v1`.
5. Implementação técnica: `createCertificateVault()` lendo a configuração em tempo de execução; teste de leitura real sem nenhuma chamada ao governo.
6. Cadastro pela referência do cofre e conferência do certificado no Admin.
