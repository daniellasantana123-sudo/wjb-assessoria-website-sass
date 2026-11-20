# 03 - Matriz de riscos

| # | Risco | Prob. | Impacto | Mitigação | Estado |
| --- | --- | --- | --- | --- | --- |
| R1 | Nota emitida em duplicidade por timeout/retry | Média | Alto | chave de idempotência no servidor + unique no banco + conciliação antes de reenviar | Mitigado no mock |
| R2 | Empresa A vê pedido da empresa B | Baixa | Crítico | empresa só da sessão, schema `.strict()`, RLS em todas as tabelas | Mitigado (testado) |
| R3 | LLM inventa código de serviço/alíquota | Alta se permitido | Crítico | LLM não decide tributação; parametrização só no perfil aprovado | Por desenho |
| R4 | Prompt injection via anexo/mensagem | Alta | Alto | anexos como dados não confiáveis; ferramentas do LLM sem efeito fiscal | A projetar (F2) |
| R5 | Vazamento de certificado A1 | Média | Crítico | cofre/KMS; banco guarda só referência | **Bloqueante F4** |
| R6 | Funcionário forja "AUTORIZADA" pela API do banco | Baixa | Alto | RLS impede staff de mexer nos estados de transmissão | Mitigado na 0024 |
| R7 | Banco pausado (plano gratuito) | Alta | Alto | plano pago | Aberto |
| R8 | Dados pessoais enviados a provedor de LLM sem base legal | Média | Alto | minimização, contrato, RIPD | **Bloqueante F2 com LLM** |
| R9 | Documentação fiscal desatualizada (IBS/CBS, XSD, procuração nov/2026) | Alta | Alto | registro de versão e data em 06 | **Bloqueante F4** |
| R10 | Custo de LLM descontrolado | Média | Médio | limite por empresa, rate limit persistente | Aberto |
| R11 | Venda de mercadoria pedida como NFS-e | Média | Médio | política envia para revisão | Mitigado (heurística) |
| R12 | Promessa comercial ("emissão assistida") além do que existe | Média | Médio | só anunciar o que estiver ativo | Atenção |
