# Fase 10G - AWS Secrets Manager (cofre preferencial proposto)

**Situação:** adaptador pronto e testado sem rede (Fase 10D); arquitetura e custos na Fase 10F (doc 05). **Nada contratado**: a ativação depende da aprovação do responsável da WJB. Azure Key Vault continua como alternativa futura (adaptador também pronto).

## 1. Garantias que já valem no código
| Requisito | Como | Teste |
| --- | --- | --- |
| Frontend nunca recebe chave privada | o cofre só é lido no servidor (`server-only`); o envio pelo Admin aceita só o certificado público e recusa PFX/chave sem ler; o CI confere que o código do navegador não cita segredos | `wjb-fase10f-certificado-upload.test.ts`, `verificar-build.sh` |
| Criptografia | chave PKCS#8 cifrada (AES-256) + senha em segredo separado + cifra do próprio cofre (KMS) | `wjb-fase10d-vault.test.ts` |
| Privilégio mínimo | aplicação só com `GetSecretValue` nos ARNs dos dois segredos de cada certificado; gravação só pela titular, no console | política no doc 05 da 10F |
| Isolamento entre empresas | referência do cofre por certificado; uso conferido contra papel e empresa (`CERT_TENANT_MISMATCH`, `CERT_ROLE_MISMATCH`); RLS: equipe não lê `vault_reference` | `wjb-ai-fase10c.test.ts`, banco 0037 |
| Rotação | certificado novo pendente → troca atômica → anterior bloqueado para sempre (impressão digital e chave) | `wjb-ai-fase10c.test.ts`, banco 0036/0037 |
| Trilha de auditoria | uso em `fiscal_certificate_usage` (imutável); conferência e bloqueio no `audit_log`; no lado da AWS, CloudTrail registra cada `GetSecretValue` | 0028 |
| Alertas operacionais | vencimento 90/60/30/15/7/0 dias (aplicação); proposta de alarme na AWS (seção 3) | Fase 10C |

## 2. Guia de configuração (para o responsável autorizado, quando aprovado)
1. **Conta AWS** em nome da WJB, região `sa-east-1` (São Paulo). Usuário raiz com MFA, só para administração; **alerta de orçamento** em US$ 10/mês (Billing → Budgets).
2. **Usuário humano** para a titular gravar os segredos (console com MFA), com permissão `secretsmanager:CreateSecret`/`PutSecretValue` só em `wjb-cert-*`.
3. **Usuário da aplicação** `wjb-app-cofre`, sem console, com a política de leitura do doc 05 da 10F (só `GetSecretValue` nos ARNs dos certificados). Gerar a chave de acesso **direto no painel do servidor** (nunca pelo chat, nunca `NEXT_PUBLIC_*`).
4. **Gravar o certificado** (titular, no computador dela, depois da conversão do doc 04 da 10F): segredo `wjb-cert-<nome>` com o JSON `wjb-cert-v1` e segredo `wjb-cert-<nome>-senha` com a senha da chave cifrada. Depois, apagar as cópias locais.
5. **CloudTrail** ligado (padrão da conta) para registrar as leituras.
6. Avisar a equipe: o cadastro na plataforma é feito pela referência `vault://aws/wjb-cert-<nome>`, e a política roda de novo sobre o que veio do cofre.

## 3. Alertas operacionais propostos na AWS
| Alerta | Como |
| --- | --- |
| Leitura fora do esperado | CloudTrail + CloudWatch: `GetSecretValue` em `wjb-cert-*` por identidade diferente de `wjb-app-cofre` |
| Acesso negado repetido | métrica de erros `AccessDenied` do usuário da aplicação |
| Mudança de política | alteração da política do usuário da aplicação ou do segredo |
| Custo | orçamento de US$ 10/mês |

Custo dos alertas: CloudTrail de gerenciamento é gratuito (uma trilha); alarmes do CloudWatch têm cota gratuita para poucas métricas. Conferir na calculadora oficial no dia.

## 4. Custos estimados completos (referência pública; conferir no dia da contratação)
| Item | Estimativa mensal |
| --- | --- |
| 2 segredos do certificado da WJB (modelo A) | ≈ US$ 0,80 |
| Chamadas (centenas a poucos milhares por mês) | < US$ 0,10 |
| Chave KMS própria (opcional; a padrão é gratuita) | ≈ US$ 1 |
| CloudTrail (trilha de gerenciamento) e alarmes básicos | ≈ US$ 0 a 1 |
| **Total, modelo A** | **≈ US$ 1 a 3/mês**, mais IOF do cartão internacional |
| Modelo B (cada cliente com certificado próprio, 2 segredos cada) | + ≈ US$ 0,80 por cliente |

Fora do cofre: certificado A1 novo (≈ R$ 150 a 300 por ano) e horas de configuração.

## 5. O que falta para ativar
- [ ] Aprovação da contratação e do custo.
- [ ] Certificado novo, com novo par de chaves (doc 06).
- [ ] Implementar `createCertificateVault()` lendo a configuração em tempo de execução (adaptador pronto; a fábrica hoje recusa de propósito).
- [ ] Teste de leitura real com o certificado novo, sem nenhuma chamada ao governo.
