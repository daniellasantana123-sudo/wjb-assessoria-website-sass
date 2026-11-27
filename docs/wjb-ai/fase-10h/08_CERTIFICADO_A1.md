# Fase 10H - Certificado digital A1

**Situação:** infraestrutura pronta e validada com certificados **fictícios**; **nenhum certificado real** recebido ou usado; o certificado exposto continua bloqueado. Nenhuma proteção foi removida ou alterada nesta fase.

| Proteção | Onde | Validação nesta fase |
| --- | --- | --- |
| MFA (super admin com MFA recente; aal2 no banco) | ações do Admin; 0035 | staging (`staging-fase10a`, `staging-fase10c`, `staging-fase10f`) |
| Titularidade e CNPJ | `evaluateRotation`, conferência do certificado público | unitário 10F + staging |
| Cadeia ICP-Brasil e revogação | `certificate-policy.ts` (falha fechada sem âncoras e LCR/OCSP reais) | unitário; staging recusa o certificado fictício por isso |
| Validade e incidente de 26/11 | `certificate-policy.ts` | unitário |
| Bloqueio permanente por impressão digital e por chave pública | 0036/0037 | banco (job `banco` da CI e `run.sh`) |
| Alertas de vencimento 90/60/30/15/7/0 dias | 10C | unitário e banco |
| Logs de auditoria | `fiscal_certificate_usage`, `audit_log` | staging |
| Só a parte pública entra pelo Admin | `certificate-upload.ts` | unitário + staging (arquivo com chave recusado) |

Resultados do staging desta fase: doc 10.

**Para usar um certificado real** (sequência no doc 06 da 10G):
1. revogação do certificado exposto;
2. certificado novo com novo par de chaves;
3. cofre aprovado e configurado;
4. âncoras ICP-Brasil e LCR/OCSP reais configuradas;
5. autorização expressa.
