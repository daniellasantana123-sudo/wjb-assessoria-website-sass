# 32 - Fase 7: diagnóstico e escopo

**Data:** 21/11/2026 · Branch `wjb-ai/f2-solicitar-nfse` · HEAD de partida `ddc54506` · árvore limpa.

## 1. Estado real verificado
| Item | Situação |
| --- | --- |
| Homologação | `wjb-ai-homologacao` (ref `uisoyodnzdyaaxisujmk`), migrations 0024-0028 aplicadas; scripts recusam credenciais da produção |
| Produção (`wjb-website-app`) | não tocada nesta fase; nenhuma afirmação sobre o estado atual sem evidência nova |
| Módulo | `WJB_AI_ENABLED` desligado por padrão; rotas respondem 404 |
| Linha de base | 531 unitários, lint, tipos e build ok (HEAD `467caf70`); 92 E2E de regressão (Fase 6) |
| Certificado | e-CPF pessoal comprometido: **não usado, não aberto, não pedido** |

## 2. Arquitetura real (resumo)
- Portal `/portal/nfse` (lista, nova, detalhe, corrigir) e Admin `/admin/nfse` (filas, detalhe, perfis, permissões), ambos atrás do módulo.
- Núcleo em `src/lib/wjb-ai/`: máquina de estados (`fiscal/status.ts`), política (`policy.ts`), idempotência sha256, fila (`queue.ts` + `queue.repo.ts`, recuo 1-16 min, 5 tentativas, fila de erros, consulta antes de reenviar), numeração da DPS (0027), conector nacional simulado com assinatura de teste, alertas.
- Banco: RLS em todas as tabelas `fiscal_*`; transmissão e resultados só pelo servidor (service role).
- Agentes: contratos e execução por regras (`agents/`), sem modelo externo.

## 3. Lacunas reais encontradas (e o que foi decidido)
| Lacuna | Decisão |
| --- | --- |
| Lista do cliente sem busca, filtro e paginação | implementar |
| **Lista mostrava "Autorizada" sem marca de simulação** (só o detalhe marcava) | corrigir: toda lista e todo badge marcam simulação quando não há tentativa oficial |
| Sem rascunho recuperável | implementar só com campos não pessoais, na sessão da aba |
| Sem prévia imprimível marcada "SIMULAÇÃO / SEM VALOR FISCAL" | implementar (impressão do navegador, sem gerar arquivo no servidor) |
| Fila de revisão sem atribuição, prioridade e prazo | migration 0029 (aditiva) + telas |
| Sem diferença entre versões corrigidas | implementar no detalhe do Admin (documento sempre mascarado) |
| Sem chat interno | motor por regras + canal interno; WhatsApp só como contrato desligado |
| Carga 10/30/100 nunca medida | script contra a homologação, com limpeza |

## 4. O que exigiria serviço pago ou produção (não feito)
- Fila dedicada (Redis, Upstash, pgmq em outro projeto): **não necessária**. A fila em tabela com trava e idempotência aguentou 100 pedidos simultâneos (doc 33).
- WhatsApp Business: exige número, Meta e avaliação de LGPD. Só o contrato do canal existe.
- Antimalware de anexos: a Fase 7 não abriu anexos (não são necessários para a NFS-e de serviço); fica para quando houver anexo.

## 5. Riscos
| Risco | Mitigação |
| --- | --- |
| Confundir simulação com nota real | badge, lista, prévia e chat sempre dizem "simulação"; teste E2E confere |
| Chat criar pedido sem autorização | só sessão de cliente com empresa ativa; criação pelo `submitNfseAction` (mesmas regras do formulário) |
| Estado do chat forjado no navegador | servidor saneia o estado e revalida tudo na criação |
| Dados pessoais no navegador | rascunho guarda só serviço, valor, competência e referência |
| Atribuir revisão a quem não é equipe | trigger da 0029 recusa |
