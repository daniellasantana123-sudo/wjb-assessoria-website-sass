# Plano de implementação - Fase 6.5

1. Ler `Claude.md`, `docs/product/roadmap.md`, `artifacts/wjb-saas-mvp/STATUS.md` e todos os artifacts de Omie das Fases 4/5 antes de tocar em código.
2. Inventariar todos os arquivos relacionados à integração (Parte 1 do prompt).
3. Buscar as 6 fontes oficiais listadas no prompt via `WebFetch` - registrar o que foi confirmado e o que ficou inacessível (Postman técnico), sem inventar o que não pôde ser lido.
4. Comparar a implementação existente com o confirmado - identificar que o adapter chamava a API do Omie ERP, não a G-Click (gap crítico).
5. Produzir `audit-report.md` com o diagnóstico completo ANTES de qualquer correção.
6. Corrigir só o comprovadamente incorreto, de forma incremental:
   - Remover `omie.adapter.ts`.
   - Reescrever `provider.ts` para sempre devolver o adapter no-op.
   - Remover leitura de `OMIE_APP_KEY`/`OMIE_APP_SECRET`.
   - Adicionar `GCLICK_CLIENT_PORTAL_URL` e usá-la como fallback do CTA.
   - Corrigir copy da UI que afirmava nomes de campo/credencial incorretos.
7. Atualizar testes (remover os que testavam a implementação errada, adicionar os que confirmam o estado seguro atual).
8. Atualizar `docs/api/integrations.md` e adicionar adendos aos artifacts das Fases 4/5 (sem reescrever histórico).
9. Lint, typecheck, test, build.
10. Escrever os 11 artifacts exigidos + atualizar `STATUS.md`.

Nenhum item deste plano exigiu credenciais reais - o próprio diagnóstico já era possível (e necessário) sem elas.
