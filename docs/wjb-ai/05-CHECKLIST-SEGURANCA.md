# 05 - Checklist de segurança

| Controle | F1 |
| --- | --- |
| Módulo desligado por padrão, rota 404 | Sim (testado) |
| Empresa derivada da sessão, nunca do corpo | Sim (testado) |
| Permissões no servidor, deny-by-default | Sim (`hasWjbAiPermission`) |
| Ninguém com `fiscal.submit` | Sim (testado, inclusive super_admin) |
| Produção bloqueada mesmo com a flag ligada | Sim (testado) |
| Documento do tomador mascarado na resposta | Sim (testado) |
| Sem dado pessoal em logs | Sim (rota não loga corpo) |
| Rate limit | Sim, em memória (limitação conhecida) |
| RLS em todas as tabelas novas | Sim, na 0024 (não aplicada) |
| Estados de transmissão só pelo servidor | Sim, na 0024 |
| Certificado só como referência a cofre | Sim, na 0024 |
| Cofre/KMS | **Não existe** |
| MFA obrigatório para gestão fiscal | Pendente (F3) |
| Teste de prompt injection | Pendente (F2) |
