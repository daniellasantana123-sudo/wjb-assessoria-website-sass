# Fase 10G - Certificado digital A1

**Situação:** a infraestrutura está pronta e testada com certificados fictícios (Fases 10C e 10F). **Nenhum certificado real foi recebido ou usado.** O certificado exposto continua bloqueado.

## 1. Proteções preservadas (nenhuma foi enfraquecida)
| Proteção | Onde | Teste |
| --- | --- | --- |
| Bloqueio do certificado exposto: certificado da WJB emitido antes de 26/11/2026 00:00 de Brasília é recusado sem precisar conhecer o arquivo | `certificate-policy.ts` | 10B, 10F |
| Bloqueio permanente por impressão digital e por chave pública | 0036/0037 | banco e unitário |
| Titularidade e CNPJ (e-CNPJ do cliente = CNPJ da empresa; da WJB nunca como cliente) | `evaluateRotation` | 10C, 10F |
| Validade, cadeia ICP-Brasil e revogação (falha fechada enquanto não houver âncoras e LCR/OCSP reais) | `certificate-policy.ts` | 10B, 10F |
| MFA administrativo (super admin com MFA recente) | ações de conferir e bloquear; 0035 no banco | staging |
| Auditoria de uso | `fiscal_certificate_usage`, `audit_log` | 10C, 10F |
| A plataforma só recebe a parte pública; PFX e chave privada recusados sem leitura | `certificate-upload.ts` | 10/10 + staging |

## 2. Se o certificado disponível for o exposto
Ele é recusado em três camadas:
1. pela data de emissão (incidente de 26/11);
2. pela impressão digital, se for informada no bloqueio;
3. pela chave pública: reemissão com o mesmo par de chaves também é recusada.

Não há caminho no sistema para liberá-lo, por desenho.

## 3. Sequência para um certificado real (bloqueada até haver as condições)
1. Titular: revogar o certificado exposto na AC.
2. Titular: emitir o novo com **novo par de chaves**.
3. Titular, no computador dela, sem rede: `node scripts/wjb-ai/certificado/verificar-certificado.mjs`.
4. Super admin: **Admin → NFS-e → Certificados → Conferir certificado novo**, enviando só o `.cer`.
5. Titular: gravar a chave cifrada no cofre (doc 05).
6. Equipe: cadastrar pela referência do cofre. Depois, com autorização expressa, primeiro teste em produção restrita (doc 07).

## 4. Pendências
Certificado novo (titular); âncoras ICP-Brasil e LCR/OCSP reais (configuração técnica, depois do cofre); cofre aprovado (doc 05).
