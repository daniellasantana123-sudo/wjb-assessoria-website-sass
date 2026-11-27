# Fase 10D - Publicação isolada do hotfix de segurança do Next.js

**Data:** 26/11/2026. **Autorização:** Product Owner, mensagem de 26/11 ("Autorizo a publicação isolada do hotfix de segurança do Next.js"). **Publicado:** `main` de `a7d15d22` para **`70d08787`** (avanço rápido, sem merge). A Fase 10C **não** foi publicada.

## 1. Requisitos e evidências
| Requisito | Evidência |
| --- | --- |
| Vulnerabilidades e versão corrigida | a 16.3.7 (produção) tinha advisories **críticos** de execução remota (GHSA-2464-fhr4-w9xw, GHSA-673q-mjm6-r5xr) e outros altos e moderados, corrigidos entre a 16.4.1 e a 16.4.5 (doc 02 da Fase 10C). A **16.4.6** continua sendo a `latest` estável do npm, sem advisory publicado contra ela (reconferido no momento da publicação) |
| Diff revisado | 1 commit, 2 arquivos (`package.json`, `package-lock.json`). `next` e `eslint-config-next` 16.3.7 → 16.4.6, `zod` 4.5.4 → 4.6.7. No lock: binários do Next e dependências transitivas (`sharp` 0.35.5, `undici` 8.13.1, `postcss` 8.5.33) e ferramentas de desenvolvimento (ESLint, Vite) |
| Sem código da Fase 10C | `git diff --stat main..hotfix` = só os 2 arquivos; base do hotfix = `a7d15d22` (a própria `main`) |
| Sem migrations | nenhum arquivo em `supabase/` no diff; o banco não foi tocado |
| Regressão | no **mesmo commit** `70d08787`, num worktree limpo: `npm ci`, lint, TypeScript, **373/373** testes, build "Compiled successfully" e **96/96** na regressão de telas com o build dele |
| Rollback preparado | seção 3 |
| Publicação | `git push origin 70d08787:refs/heads/main` às 21:45; a Hostinger compilou a versão `01a21a76` (log: "Compiled successfully in 45s"; o aviso de `GLIBC_2.29` é o esperado, o build usa o compilador WebAssembly) e a ativou às 21:48 |
| Validação | seção 2 |

## 2. Validação depois da publicação
**Servidor:**
- versão ativa `versions/01a21a76…`, com `node_modules/next` = **16.4.6**;
- `stderr.log` vazio;
- `console.log`: "Ready".

**Site, Portal e Admin** (de fora, como um visitante):

| Verificação | Resultado |
| --- | --- |
| `/`, `/contato`, `/planos`, `/planos/mei`, `/servicos`, `/servicos/abrir-empresa`, `/blog`, um post, `/sobre`, `/duvidas`, `/area-do-cliente`, `/ajuda`, `/login`, `/recuperar-senha`, `/sitemap.xml`, `/robots.txt` | todos **200** |
| `/portal`, `/portal/nfse`, `/admin`, `/admin/nfse`, `/admin/manual` sem login | **307** para `/login?next=...` (protegidos, como antes) |
| Redirecionamentos: `www.` → domínio, `/home` → `/`, `/dani` → assistente | 308 / 308 / 307, como antes |
| Endereço antigo do WordPress (`/wp-admin/`) | **410** |
| Página inexistente | 404 |
| Otimizador de imagens (`/_next/image`) | 200, imagem servida |
| API de contato com dados **inválidos** (nada gravado) | 400 com a validação esperada |
| Cabeçalhos de segurança (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) | **presentes**, em 4 edges diferentes do CDN, inclusive no `/login` (não cacheado) |

**Observação sobre os cabeçalhos:**
- **na primeira leitura, logo depois da troca de versão (21:50):** CSP, HSTS, X-Frame-Options e X-Content-Type-Options não apareceram;
- **reprodução local:** o mesmo código, rodando do jeito da Hostinger (*standalone*), envia os 6;
- **poucos minutos depois:** os 6 estavam presentes em todas as leituras.

O intervalo não teve causa determinada; a hipótese provável é propagação no CDN (`hcdn`) durante a troca. **Ação:** conferir de novo nos próximos dias e, em todo deploy, ler os cabeçalhos mais de uma vez antes de concluir.

**Login real no Portal e no Admin:** não testado por mim. Não há credencial de produção comigo, e o banco de produção está em diagnóstico (doc 02). O caminho de login (`/login` 200, rotas protegidas redirecionando) está igual a antes.

## 3. Rollback
- **Como:** `git revert 70d08787` + `git push origin main`. A Hostinger compila a versão anterior (16.3.7). A versão antiga (`01a1fa38…`) continua no servidor.
- **Quando:** só em falha funcional comprovada. Reverter traz de volta os advisories críticos.
- **Banco:** nada a desfazer; o hotfix não toca no banco.

## 4. Resultado
**Publicado e validado.** A produção está no Next.js 16.4.6 desde 26/11/2026, 21:48 (horário de Brasília), sem regressão observada. Antes, era a 16.3.7, com advisories críticos.
