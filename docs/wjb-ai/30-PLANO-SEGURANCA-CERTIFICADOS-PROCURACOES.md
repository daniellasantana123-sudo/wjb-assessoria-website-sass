# 30 - Plano de segurança para certificados e procurações

**Status:** plano para aprovação da WJB. Complementa os docs 15 e 26 com o que a Fase 6 confirmou. Nenhum certificado real foi instalado e nenhum serviço foi contratado.

## 1. Requisitos definitivos do certificado

Para a **WJB** (modelos A e B da própria WJB):
- e-CNPJ **A1** emitido por AC credenciada na ICP-Brasil, em nome do CNPJ da WJB;
- versão 3, não AC, com Key Usage "Assinatura Digital" + "Não Recusa" e EKU "Autenticação Cliente" (o mesmo certificado serve à conexão mTLS e à assinatura);
- RSA (os certificados ICP-Brasil atuais são RSA 2048), compatível com assinatura **RSA-SHA1** enquanto esse for o algoritmo oficial;
- validade de 1 ano (A1), com renovação programada;
- **A3 não é recomendado** para o servidor: exige token ou cartão físico e não roda num processo sem pessoa presente.

Para o **cliente** no modelo B: os mesmos requisitos, em nome do próprio CNPJ/CPF (e-CPF usa o OtherName 2.16.76.1.3.1).

## 2. Custódia

| Regra | Como |
| --- | --- |
| Onde fica | só no cofre, exclusivo por ambiente (homologação e produção nunca compartilham chave nem conta) |
| O que o banco guarda | referência `vault://...`, titular, validade, impressão digital SHA-256 (0027); CHECK recusa PEM, chave e senha |
| Quem cadastra | super admin, com o titular presente, pelo console do cofre com MFA |
| Quem usa | só o processo de transmissão, por `useCertificate` |
| Em memória | a chave fica em memória só durante a assinatura ou o handshake; nunca vai para log, resposta, banco, fila, n8n ou IA |
| Em disco | nunca (nem temporário); o processo lê do cofre a cada uso |
| Algoritmo | RSA-SHA1 hoje: **exclui AWS KMS** (não assina SHA-1). Opções viáveis: gerenciador de segredos (A1 cifrado, carregado em memória) ou HSM com PKCS#11 |

**Recomendação para a homologação:** gerenciador de segredos (AWS Secrets Manager, Google Secret Manager ou Azure Key Vault), conta e projeto exclusivos, papel IAM que só lê aquele segredo, processo de transmissão separado do site da Hostinger. Custo de referência: poucos dólares por mês (doc 26). Reavaliar HSM para produção conforme volume e exigência da WJB.

## 3. Uso do certificado (implementado em `fiscal/certificate-vault.ts`)

A cada assinatura ou conexão:
1. **Ambiente:** produção recusada nesta fase.
2. **Autorização reavaliada agora:** modelo A (procuração ativa, não revogada, no prazo, escopo NFS-e, para o CNPJ do certificado) ou modelo B (titular = emitente). Sem autorização: negado.
3. **Cofre:** carrega pela referência registrada.
4. **Integridade:** impressão digital e titular do certificado que veio do cofre têm de ser os registrados; certificado trocado = negado.
5. **Trilha:** cada tentativa (ok, negado, erro) vai para `fiscal_certificate_usage`, imutável; se a trilha não grava, a operação não acontece.

## 4. Procurações

| Momento | Controle |
| --- | --- |
| Concessão | o cliente concede no Portal de Serviços da RFB, serviço da NFS-e, em favor do CNPJ da WJB; a WJB registra a evidência (onde está guardada) e a validade |
| Registro | contador ou super admin; escopo precisa citar NFS-e; CNPJ do procurador = CNPJ do certificado da WJB |
| Uso | reavaliada em cada uso do certificado |
| Vencimento | alerta a 30 dias e alerta crítico ao vencer; emissões bloqueadas |
| Revogação pelo cliente na RFB | a SEFIN rejeita com E0718; alerta crítico; a equipe revoga também no sistema |
| Revogação no sistema | com motivo, definitiva, sem apagar (0027) |
| Auditoria | `audit_log` (registro e revogação) + trilha de uso do certificado |

## 5. Resposta a incidentes

| Evento | Ação |
| --- | --- |
| Suspeita de vazamento da chave | desligar `WJB_AI_ENABLED` (para tudo); revogar o certificado na AC; trocar no cofre; revisar a trilha de uso |
| Certificado vencido ou revogado | alerta crítico; emissões bloqueadas até o novo certificado ser cadastrado e a impressão digital atualizada |
| Uso negado em sequência | alerta; investigar procuração revogada, certificado trocado ou erro de cadastro |
| E0718 recorrente | conferir a procuração na RFB com o cliente |

## 6. Decisões da WJB

1. Aprovar o tipo de cofre e a conta exclusiva de homologação.
2. Autorizar a compra ou o uso do e-CNPJ A1 da WJB e o cadastro no cofre.
3. Autorizar a primeira conexão (só leitura do swagger e consulta).
4. Definir quem, além do super admin, acompanha a trilha de uso e os alertas.
