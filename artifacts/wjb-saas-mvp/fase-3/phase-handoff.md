# Handoff - Fase 3 para a próxima fase

## O que está pronto

- Download auditado de ponta a ponta (`document.downloaded`), com URL assinada gerada sob demanda.
- Upload endurecido: allowlist de MIME, nome sanitizado, ponto de extensão de antimalware, permissões finas checadas de verdade.
- Busca por nome de arquivo em `/portal/documentos` e `/portal/guias`.
- `loading.tsx`/`error.tsx` para as duas rotas - primeira vez que o Portal ganha esses estados.
- Lint, typecheck, 99 testes e build - todos limpos.

## O que ficou deliberadamente fora desta fase

- Busca no Admin (`/admin/empresas/[id]`) - ver `decisions.md` D2.
- Filtro por data/uploader - ver `decisions.md` D3.
- `document.category_changed` - funcionalidade de trocar categoria não existe. Ver `decisions.md` D4.
- Provider real de antimalware - ninguém foi confirmado. Ver `decisions.md` D5.

## Pendências herdadas de fases anteriores (ainda não resolvidas)

- Credenciais do projeto Supabase real continuam ausentes - nada desta fase foi testado contra Storage/banco reais, só via mocks.
- `.env.example`/`.github/workflows/` continuam ausentes (Fase 0).

## Riscos

- A allowlist de MIME confia no `file.type` reportado pelo navegador (não inspeciona os bytes do arquivo pra confirmar o tipo real) - um arquivo malicioso renomeado/com MIME forjado passaria pela allowlist. Mitigação real viria de um provider de antimalware de verdade (ponto de extensão já existe) ou de uma inspeção de magic bytes, nenhuma das duas no escopo desta fase.
- `sanitizeFileName` reduz caracteres não-ASCII (acentos, por exemplo) pra underscore - o nome exibido na UI fica menos legível pra arquivos com nome em português com acento (ex.: "relatório.pdf" vira "relat_rio.pdf"). Trade-off deliberado entre legibilidade e segurança de storage key; reconsiderar se isso incomodar o uso real.

## Próxima fase

Não definida - aguardando o próximo prompt numerado do usuário.
