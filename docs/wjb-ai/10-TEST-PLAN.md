# 10 - Plano de testes

| Camada | Cobertura atual (F1) | Arquivo |
| --- | --- | --- |
| Interruptores | desligado por padrão; produção bloqueada mesmo com flag; homologação recusa | `src/tests/unit/wjb-ai-fiscal.test.ts` |
| Documentos | CPF, CNPJ numérico e alfanumérico | idem |
| Rascunho | centavos sem ponto flutuante; recusa `tenant_id` e campos fiscais; lista o que falta | idem |
| Máquina de estados | timeout não vira rejeição; não pula confirmação; "emitida" só com retorno oficial | idem |
| Política | revisão sem perfil/autorização; autorização vencida; valor alto; mercadoria; duplicidade; nunca autoaprova | idem |
| Idempotência e mock | mesma chave não emite duas vezes; resultado indeterminado conciliado pela consulta | idem |
| Isolamento | empresa A não lê B; consultas usam só a empresa da sessão | idem |
| Rota | 404 desligada (sem consultar sessão); empresa resolvida pela sessão; documento mascarado | `src/tests/integration/wjb-ai-preview-api.test.ts` |

Pendentes: RLS real da 0024 com dois usuários sintéticos (depois de aplicada em banco de teste), concorrência no banco, prompt injection, carga com dados sintéticos.
