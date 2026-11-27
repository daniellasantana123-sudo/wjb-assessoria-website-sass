# Fase 10C - Auditoria de segurança

**Data:** 26/11/2026. **Escopo:** branch `feature/wjb-fase-10c`, hotfix `hotfix/next-16.4.6-security` e a produção atual (`main`, `a7d15d22`), esta última só por leitura de código e advisories públicos.

## 1. Next.js: advisories oficiais e o hotfix

### 1.1 O que afeta a produção atual (Next 16.3.7)
Fonte: API pública de security advisories do repositório `vercel/next.js` e registro do npm, consultados em 26/11/2026.

| Corrigido em | Advisory | Gravidade | Faixa afetada |
| --- | --- | --- | --- |
| 16.4.1 | GHSA-2464-fhr4-w9xw: RCE na otimização de imagens com SVG | **crítica** | > 16.0.0 e ≤ 16.4.0 |
| 16.4.1 | GHSA-673q-mjm6-r5xr: RCE em `use cache` com typed arrays | **crítica** | (o projeto não usa `use cache`) |
| 16.4.1 | GHSA-p3m5-59mp-jv5r: DoS via Server Actions | alta | — |
| 16.4.5 | GHSA-pc58-hwjq-p385: injeção e vazamento de resposta em auto-hospedagem | moderada | ≥ 16.0.0 e ≤ 16.4.4 |
| 16.4.5 | GHSA-rhh4-g77r-r9qj, GHSA-7qx7-33qx-rqx2, GHSA-mfr8-8qww-v76h, GHSA-vc7v-qv4w-wrv8 | moderadas | até 16.4.4 |
| 16.4.5 | GHSA-f3mh-rxg3-f5g2: cookie HttpOnly no Edge runtime | moderada | (o projeto não usa Edge) |

Há também 7 advisories de 30/09 registrados como corrigidos em "16.3.?"; a 16.3.8 saiu no mesmo dia. **Provavelmente** afetam a 16.3.7, mas o registro não permite confirmar. Um deles é um SSRF na otimização de imagens (alta).

**Exposição real do site:**
- o otimizador de imagens **está ligado**, só com imagens locais, sem `remotePatterns`, e não há SVG em `public/`;
- o site roda com `next start` atrás de proxy (hcdn), exatamente o cenário de auto-hospedagem do GHSA-pc58;
- **a exposição aos advisories críticos não foi confirmada nem descartada**, e por isso a recomendação é publicar o hotfix assim que autorizado.

### 1.2 A versão do hotfix
- **16.4.6:** é a `latest` estável do npm, publicada em 09/11/2026. As 16.5 são só canary.
- **Nenhum advisory publicado** inclui a 16.4.6. Advisories não publicados não aparecem nessa consulta.
- **Node mínimo:** `engines.node >= 20.9.0`. A Hostinger tem Node 20, 22 e 24 (doc 53); o build lá usa o compilador WebAssembly, já testado.

### 1.3 Verificação do hotfix (refeita do zero nesta fase)
Num `git worktree` separado, com `npm ci` limpo:

| Verificação | Resultado |
| --- | --- |
| `next` / `zod` instalados | 16.4.6 / 4.6.7 |
| Lint | sem erros |
| TypeScript (`next typegen && tsc`) | sem erros |
| Testes (Vitest) | **373/373**, 49 arquivos |
| Build de produção | "Compiled successfully" |
| `npm audit` | 3 **moderadas**, todas no Vitest (`@vitest/mocker` < 4.1.12), **só ferramenta de teste**: não entra no site publicado. Na branch da WJB AI já estão corrigidas (Vitest 4.1.12) |

| Regressão de telas (site, Portal, Admin, assistente), no build de produção **do próprio hotfix** | **96/96** |

**Impacto no Website, Portal, SaaS e Admin:**
- a mudança é só `package.json` e o lock (Next e zod);
- a regressão completa passa no build do próprio hotfix (acima) e na branch da Fase 10C;
- nenhuma API do Next usada pelo projeto mudou de comportamento nos testes.

**Rollback:** doc 12, seção 1.

## 2. Dependências da branch da Fase 10C
`npm audit`: **0 vulnerabilidades**. Next 16.4.6, Node local 24.18.0. **Nenhuma dependência nova.**

## 3. Exposição de segredos (varredura desta fase)
Sem gitleaks ou trufflehog instalados, a varredura foi feita por padrões, em todos os arquivos versionados e no histórico de todas as branches.

| Verificação | Resultado |
| --- | --- |
| Arquivos `.pfx`, `.p12`, `.key`, `.pem`, `.crt`, `.cer` ou `.der` versionados | **nenhum** |
| Chaves `sk_live_`/`rk_live_`, `sb_secret_`, JWT de serviço do Supabase, chave do Resend, `whsec_` reais | **nenhuma** |
| `-----BEGIN ... PRIVATE KEY-----` | só em **fixtures de testes negativos** (textos truncados, por exemplo "MIIE", que provam que os campos recusam chave): `02-seed-e-testes-api.mjs`, `08_verifica_0027.sql`, `wjb-ai-fase5.test.ts` |
| Histórico | um commit (`5c422805`, Fase 5) contém a mesma fixture truncada; nenhum segredo real |
| `.gitignore` | ignora `.env.local`, `.env.homolog*.local`, `.env.stripe.local`, `*.pfx`, `*.p12`, `*.key` e `*.pem` (conferido com `git check-ignore`) |

**Limite:** uma varredura por padrões não acha segredos em formato desconhecido. Recomendação: rodar gitleaks no CI quando a WJB aprovar adicionar a ferramenta.

## 4. Revisão do código novo
Os controles novos estão no doc 05. Resultados da revisão independente: seção 5.

| Controle | Garantia | Teste |
| --- | --- | --- |
| Lista de bloqueio permanente | gatilhos recusam UPDATE, DELETE e TRUNCATE para todos | T214-T216 (local), C6 (homologação) |
| Retirado não volta | transições só pendente→ativo→substituído/bloqueado; recadastro recusado | T209, T210, C5, C7 |
| Um ativo por titular | índice único parcial + bloqueio de linha na rotação | T205, T217 |
| Rotação só pelo servidor | `rotate_fiscal_certificate` só para service role | T224, C11 |
| Bloqueio manual | super admin + aal2 no banco e MFA recente na ação | T225, T227, T228, C9, C13, C15 |
| Leitura | equipe com aal2; cliente e anônimo, nada | T222, T226, T229, T231, C8, C10, C16, C17 |
| Uso com falha fechada | registro ausente ou fora do ar = negado e auditado | testes "uso do certificado consulta o registro" |
| Sem segredo na entrada | a ação só aceita 64 hexadecimais e recusa texto com cara de chave ou senha | staging Fase 10C |
| XML sem injeção | todo texto escapado; testado com `<`, `>` e `&` | `wjb-ai-fase10c.test.ts` |
| `indDest` sem presunção | DPS não sai sem declaração | idem |

## 5. Revisão independente (agente de segurança, sem as conclusões do autor)
O agente leu só o código e não executou nada. Dos 7 objetivos, 6 se sustentaram desde o início:
- bloqueio permanente;
- escrita só pelo servidor;
- falha fechada no uso;
- nenhum segredo;
- nenhum envio real;
- XML escapado.

| # | Achado | Severidade | Tratamento |
| --- | --- | --- | --- |
| M1 | O registro era consultado só pela impressão digital, sem conferir papel nem empresa. Um certificado da WJB cadastrado como "cliente" contornaria a regra de um ativo por papel | média | **corrigido**: o uso exige o papel e a empresa do pedido; a rotação recusa certificado da WJB como cliente e e-CNPJ de outra empresa; o banco confere o titular do cliente e da rotação (0037) |
| M2 | Bloqueio por impressão digital e não pela chave: uma reemissão com o mesmo par de chaves escaparia | média | **corrigido**: SPKI registrada e lista permanente de chaves (0037) |
| M3 | Apagar o perfil de quem bloqueou ou cadastrou falhava (o `SET NULL` disparava a imutabilidade) | média | **corrigido**: só a mudança "autor → vazio" é aceita (T249-T251) |
| B1 | Erro de leitura virava "não há ativo" na rotação | baixa | **corrigido**: vira exceção; o banco também confere o titular na rotação |
| B2 | Documento do titular (CPF, em e-CPF) e referência do cofre legíveis pela equipe via API | baixa | **corrigido**: permissão por coluna (T253, T254, C10b) |
| B3 | Avisos de vencimento sem exigir MFA | baixa | **corrigido**: política restritiva aal2 (T255) |
| B4 | Aviso de vencimento poderia se perder se a gravação falhasse | baixa | **corrigido**: reserva antes, liberação se falhar; a rota informa registro fora do ar |
| B5 | `indDest` ausente só aparecia ao montar a DPS, depois de autorizado o envio | baixa | **corrigido** para o envio oficial (bloqueia antes de autorizar); a simulação não muda. A confirmação do contador segue pendente (doc 07) |
| B6 | Chave de idempotência sem o destinatário | baixa | **corrigido**, sem mudar a chave dos pedidos antigos |
| B7 | Caracteres proibidos no XML 1.0 gerariam XML inválido | baixa | **corrigido**: removidos no escape |
| I1-I7 | `search_path`, corrida na rotação, permanência, ação do Admin, falha fechada, ausência de envio, scripts | informativos | confirmados sem problema. Registrado: pelo PostgREST direto, um super admin com MFA bloqueia sem o "MFA recente" da aplicação (aceito: o banco já exige aal2) |

Durante a correção, apareceu um efeito colateral, achado ao ler os resultados e não por erro de teste: nas primeiras execuções, dois testes de permanência da lista de chaves "passavam" por um erro de coluna inexistente, e não pela regra. O PL/pgSQL não garante curto-circuito no `AND`. A função foi reescrita com condições aninhadas, e agora os três casos são recusados pela regra (`42501`).

## 6. Riscos que continuam abertos
| Risco | Situação |
| --- | --- |
| Produção em Next 16.3.7 com advisories críticos | **aguarda autorização do hotfix** |
| Banco de produção em estado desconhecido | doc 03 (checklist para a WJB) |
| MFA ainda não exigido no banco de **produção** (a 0035 só está na homologação) | depende do Portão 0 e da aplicação das migrations em produção |
| Limite de requisições de lead em memória na produção atual (a 0034 só está na homologação) | idem |
| CSP com `'unsafe-inline'` | aceito desde a FASE 7 (JSON-LD inline) |
