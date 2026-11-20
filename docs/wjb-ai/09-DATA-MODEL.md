# 09 - Modelo de dados

Migration `supabase/migrations/0024_wjb_ai_fiscal_core.sql` (**escrita, não aplicada**). Reaproveita `tenants`, `profiles`, `tenant_members` e `audit_log`; não duplica nenhuma tabela.

| Tabela | Papel | Quem escreve |
| --- | --- | --- |
| `fiscal_profiles` | parametrização versionada aprovada pelo contador | equipe cria/edita só rascunho; aprovação só pela função; um aprovado por empresa; aprovado é imutável |
| `fiscal_profile_approver_grants` | quem tem a permissão `fiscal_profile.approve`, para todas as empresas ou uma só; concessão e revogação com motivo | só funções (super_admin) |
| `fiscal_profile_approvals` | histórico imutável: quem aprovou, quando, empresa, versão, justificativa | só função `approve_fiscal_profile` |
| `fiscal_authorization_grants` | procuração/certificado/consentimento: escopo, validade, referência à evidência e ao cofre (nunca o arquivo nem a senha) | equipe |
| `fiscal_requests` | pedido, estado, snapshot, hash, chave de idempotência (única por empresa), decisão de política | cliente cria (só `RECEBIDA`, na própria empresa); equipe avança até `AUTORIZADA_PARA_ENVIO` |
| `fiscal_request_events` | histórico de transições (append-only) | só servidor |
| `fiscal_issuance_attempts` | cada tentativa de envio, ambiente, resultado, `simulated`; um único `AUTORIZADA` por pedido (índice parcial) | só servidor |
