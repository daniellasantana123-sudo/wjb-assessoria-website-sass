# 48 - Auditoria geral da WJB AI (Fases 1 a 9.1)

**Data:** 21/11/2026 · Branch auditada: `wjb-ai/f2-solicitar-nfse` (commit base `aefd205f`) · Produção (`main`): `a7d15d22` (Fase 1, módulo fiscal desligado).

**Não foram feitos:** mudança na produção, publicação na `main`, cobrança real, emissão fiscal ou chamada a governo ou à Stripe.

**Método:**
- leitura do repositório e dos docs `00`-`47`;
- todas as baterias de teste executadas de novo nesta data;
- duas revisões independentes feitas por subagentes, cujos achados foram **conferidos no código** antes de entrar aqui:
  - autorização de todas as 17 rotas e 18 arquivos de Server Actions;
  - código morto e duplicado.

> **Conclusão em uma linha:** o **site institucional** e a **plataforma Portal/Admin com Omie/G-Click** são produto operacional. A **WJB AI** (emissão de NFS-e, planos comerciais e pagamentos) é **desenvolvimento concluído em homologação, não produto operacional**: a emissão fiscal é simulada, a cobrança nunca rodou na Stripe real e nada disso está na produção.

## 1. Inventário por módulo

Legenda:
- **Operacional:** em produção e usado.
- **Implementado e testado:** pronto e testado, só na homologação.
- **Simulado:** funciona, mas o efeito real é imitado.
- **Desligado:** existe, atrás de interruptor.
- **Incompleto:** parte feita.
- **Bloqueado:** depende de algo externo.
- **Ausente:** não desenvolvido.

### 1.1 Site público
| Funcionalidade | Status | Ativação / observação |
| --- | --- | --- |
| Páginas institucionais, 11 serviços, 16 posts, planos de contabilidade, FAQ, contato, páginas jurídicas | Operacional | em produção. Páginas jurídicas como **minuta**, sem revisão jurídica formal |
| Formulários de lead → Supabase + e-mail Resend | Operacional | em produção (credenciais na Hostinger) |
| Aviso interno de novo lead no Admin | Implementado e testado | só na branch (Fase 9.1) |
| Dani (assistente) | Operacional em produção (menu, qualificação, WhatsApp) | **determinística, sem IA**. Fluxo comercial de NFS-e só na branch, e só com a comercialização ligada |
| GTM / Consent Mode | Operacional | contêiner `GTM-TZKJ7CS8`. GA4 e Ads configurados no GTM, sem verificação nesta auditoria |
| `/emissao-de-notas` (planos aprovados, pré-cadastro) | Implementado e testado, Desligado | `WJB_COMMERCIAL_ENABLED` |
| Click-to-Chat WhatsApp | Operacional | número oficial. Na branch: só o oficial exibido e mensagens por intenção. **A produção ainda mostra o 2º número e tem o módulo Cloud API inativo** (removidos só na branch) |

### 1.2 Plataforma (Portal do Cliente e Admin)
| Funcionalidade | Status | Ativação / observação |
| --- | --- | --- |
| Login, MFA (TOTP), convites, recuperação de senha, papéis (super admin, contador, atendimento; responsável e membro da empresa) | Operacional | MFA cobrado só nas páginas (ver P2) |
| Documentos (upload com antivírus por interface), guias, obrigações, calendário, relatórios e CSV, chamados, mensagens, notificações, auditoria | Operacional | em produção desde set/out 2026 |
| Omie/G-Click (vínculo por CNPJ, importação, sincronização de obrigações, tarefas e responsáveis) | Operacional | `GCLICK_REAL_INTEGRATION_ENABLED` (interruptor de emergência). **Nenhum arquivo do G-Click foi alterado nas Fases 2-9.1** |
| Lembretes de obrigação (cron diário) | Operacional | GitHub Actions + `CRON_SECRET` |

### 1.3 WJB AI: emissão de NFS-e
| Funcionalidade | Status | Ativação / observação |
| --- | --- | --- |
| Pedido de NFS-e (formulário, prévia, correção com versões, assistente por regras), revisão pelo contador, filas, prazos, perfis fiscais, permissões | Implementado e testado | `WJB_AI_ENABLED`. Migrations 0024-0029 só na homologação |
| Fila de processamento e "emissão" | **Simulado** | `MockFiscalProvider` (ids `SIMULADO-`). A fábrica recusa homologação e produção |
| Leiaute DPS (XSD oficiais), numeração concorrente, regras de alíquota, catálogo de rejeições | Implementado e testado | validado contra os XSD oficiais |
| Assinatura XMLDSig e transporte mTLS para a SEFIN Nacional | Implementado, **Bloqueado** | assinatura testada só com certificado gerado no teste. Recusa certificado real enquanto o algoritmo não for confirmado na documentação vigente. Transporte SEFIN simulado |
| Certificado digital e cofre | **Bloqueado** | não há e-CNPJ A1 adequado. O e-CPF exposto **nunca** será usado. Cofre só por interface |
| Conexão oficial (produção restrita, ADN) | **Bloqueado** | exige certificado, cofre e autorização escrita (Fase 10) |
| NF-e e NFC-e de mercadorias | **Ausente** | fora do MVP |

### 1.4 Agentes de IA
| Item | Status real |
| --- | --- |
| "Agentes" do fluxo fiscal (`agents/runtime.ts`: ferramentas auditadas, extração por regras) | **Lógica determinística.** `DisabledLlmProvider`: nenhum modelo generativo é chamado |
| Assistente de NFS-e no Portal, Dani no site, classificador comercial | **Lógica determinística** (regras e palavras-chave) |
| Modelo generativo real | **Ausente**. Depende de avaliação de fornecedor, contrato, custo e LGPD (doc 28) |

### 1.5 Comercial, planos e pagamentos
| Funcionalidade | Status | Ativação / observação |
| --- | --- | --- |
| Catálogo de 5 planos com preços **aprovados**, versões, vigência e histórico; desconto do combo de 20% | Implementado e testado | migrations 0030-0032 só na homologação. `WJB_COMMERCIAL_ENABLED` |
| Assinatura, franquia, excedente com limite, troca, cancelamento, suspensão | Implementado e testado (simulado) | consumo simulado nunca é faturável (CHECK no banco) |
| Stripe Checkout, Billing, Customer Portal, webhook (8 eventos), conciliação, troca de plano proporcional | Implementado; **testado só com provedor simulado e chamadas falsas** | `WJB_PAYMENTS_ENABLED`, `WJB_PAYMENTS_PROVIDER`. **O sandbox real nunca rodou** (sem chaves) |
| Cobrança real (live) | **Bloqueado no código e no banco** | três travas; exige nova migration e autorização |
| Link | não verificado | depende da conta Stripe |
| Cobrança por nota oficial (avulsa e excedente) | Incompleto (regra pronta, não ligada) | depende da Fase 10 |

### 1.6 Integrações
| Integração | Situação |
| --- | --- |
| Supabase | produção `wjb-website-app` (0001-0023, com incidente aberto em 20/11 no doc 19 e **sem evidência de recuperação** nesta auditoria); homologação `wjb-ai-homologacao` (0001-0033, 38 tabelas) |
| Resend | operacional (avisos e convites) |
| Omie/G-Click | operacional, preservado |
| Stripe | teste, não executado na API real |
| WhatsApp | só Click-to-Chat, sem Cloud API (removida na branch) |
| SEFIN / ADN | bloqueado |

## 2. Evidências de teste (executadas em 21/11/2026)
| Bateria | Resultado |
| --- | --- |
| Lint e TypeScript (`npm run lint`, `npm run typecheck`) | sem erros |
| Unitários e integração (Vitest) | **601 / 601**, 68 arquivos |
| Banco local, Postgres 17 (`run.sh`): 0001-0033, RLS, isolamento, concorrência da numeração, backup e restauração, rollback até antes da 0024 | **118 verificações OK**, 0 falhas |
| RLS no banco | **38 de 38 tabelas** com RLS. Única sem política: `payment_mock_objects` (de propósito: ninguém lê pelo navegador) |
| API da homologação: fiscal / comercial / pagamentos (IDOR, manipulação pelo navegador, live) | **56 / 14 / 12**, 0 falhas |
| E2E com login real na homologação: Fases 2-9 / pagamentos simulados / webhook | **40/40, 9/9, 2/2** |
| Responsividade e acessibilidade (emulação Chromium; 15 tamanhos de 320 a 1920 px, com zoom de 200% e 400% e celular deitado; site, Portal e Admin) | **482 medições: 0 estouro, 0 bloqueio de zoom, 0 falhas no axe** (94 amostras). Dani cabe em 320x568, 390x844 e 844x390 |
| Regressão com o build normal e tudo desligado | **96/96**. Webhook e fila fiscal dão 404 com os interruptores desligados |
| Sandbox real da Stripe | **não executado** (sem chaves; a suíte se pula sozinha) |

## 3. Problemas encontrados
### 3.1 Corrigidos nesta auditoria (baixo risco, sem mudar comportamento aprovado)
| # | Problema | Correção |
| --- | --- | --- |
| C1 | **E-mail para a equipe montava HTML com dado do formulário público sem escapar.** Um visitante podia injetar link ou HTML de phishing num e-mail com aparência legítima da WJB (também o assunto de chamado, já com login) | `escapeHtml` em título, corpo e botão. O botão só aceita `http(s)` ou caminho relativo. Teste unitário |
| C2 | `CRON_SECRET` comparado com `!==` nas 4 rotas agendadas (tempo não constante) | `isCronAuthorized` com `timingSafeEqual`, com as mesmas respostas 401 e 503. Teste unitário |
| C3 | Código morto: `components/shared/modal.tsx`, `config/features.ts` (interruptores estáticos substituídos pelos do banco) e `lib/storage/documents.ts` (duplicava `actions/documents.ts`) | removidos; nenhum importador; TypeScript e testes passam |
| C4 | Comentário obsoleto citando o simulador removido | corrigido |

### 3.2 Em aberto (exigem decisão ou mudança estrutural)
| # | Severidade | Problema | Proposta |
| --- | --- | --- | --- |
| P1 | **Alta** | Dependências com vulnerabilidade: `next` 16.3.7 (**crítica**, envenenamento de cache em SSG/ISR auto-hospedado; corrigida a partir de 16.4.5), `zod` < 4.6.6 (alta, memória), `sharp` (alta, transitiva do Next), `undici` e `vite` (altas, só ferramentas de teste) | subir `next` para ≥ 16.4.5 e `zod` para ≥ 4.6.6 numa branch própria, com build e regressão completos. **Afeta a produção atual**, que usa as mesmas versões |
| P2 | Média | **MFA cobrado só nas páginas** (`requireSession`). `getSession` (download de documento, `/api/me`, notificações, manual) e o PostgREST não exigem `aal2`. Com só a senha vazada de uma conta com MFA, dá para baixar documentos pela API | exigir `aal2` nas rotas de API para quem tem fator e avaliar políticas RLS restritivas com `auth.jwt()->>'aal'` |
| P3 | Média | Rate limit dos formulários públicos em memória e pelo 1º IP de `x-forwarded-for` (o cliente controla); campos de lead sem limite de tamanho | limite por IP confiável do proxy (Hostinger) ou armazenamento externo; `.max()` nos campos (muda a validação: aprovar) |
| P4 | Média | Migrations 0024-0033 e 15 commits (292 arquivos, ~49 mil linhas) só na branch | publicar em etapas, com backup e interruptores desligados (seção 6) |
| P5 | Média | Produção `wjb-website-app` com incidente aberto (20/11); não há evidência de recuperação | confirmar estabilidade e o plano de banco antes de qualquer migration |
| P6 | Baixa | Mensagens de erro brutas do Postgres e do G-Click aparecem para a equipe (`wjb-ai-admin.ts`, `omie-gclick.ts`) | traduzir para mensagens neutras e registrar o detalhe só no log |
| P7 | Baixa | URLs de retorno do checkout montadas a partir do cabeçalho `host` | usar `getSiteUrl()` quando houver URL de homologação fixa |
| P8 | Baixa | Algumas ações sem `hasPermission` fino (suspender membro, status de lead) e entradas sem validação Zod (o enum do banco segura) | padronizar |
| P9 | Baixa | Duplicações: 5 formatadores de moeda, 4 ou mais de data, o login dos E2E copiado em 7 specs | consolidar em `lib/format` e num helper de teste |
| P10 | Baixa | Código preparado e ainda não ligado (transporte SEFIN de leitura, canal WhatsApp do assistente, alocador de numeração no banco) | manter, porque é a base da Fase 10 |

## 4. Funcionalidades ainda ausentes
1. Emissão fiscal **real** (certificado, cofre, conexão SEFIN, armazenamento do XML oficial).
2. Cobrança real e cobrança por nota oficial (avulsa e excedente).
3. Modelo de IA generativo (por decisão: nada de IA externa sem avaliação).
4. NF-e e NFC-e (mercadorias).
5. Textos jurídicos finais (termos, privacidade da emissão, representação fiscal, reembolso).
6. Testes em aparelhos reais, Safari, Firefox e leitor de tela.
7. URL pública de homologação (webhook da Stripe) e agendamento das rotinas da fila e dos alertas fiscais.

## 5. Riscos para a produção
| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Vulnerabilidade crítica do Next na produção atual | alto | P1, independente da WJB AI |
| Publicar a branch inteira de uma vez | alto (292 arquivos, 10 migrations) | etapas com interruptores desligados e verificação por etapa |
| Banco de produção instável | alto | P5 antes de tudo |
| Ligar a comercialização sem jurídico, sem Stripe testada e sem emissão real | alto (cobrar por serviço que não emite) | manter `WJB_COMMERCIAL_ENABLED` e `WJB_PAYMENTS_ENABLED` desligados até o checklist da seção 8 |
| MFA contornável pela API | médio | P2 |
| Testes só em emulação | médio | testes em aparelhos reais antes do lançamento |

## 6. Plano de correções priorizado
1. **P1:** atualizar `next` e `zod` (branch própria, regressão completa). Vale publicar na produção atual mesmo sem a WJB AI, com aprovação.
2. **P5:** confirmar a saúde do banco de produção e escolher o plano (Pro, backups).
3. **P2:** MFA nas rotas de API e na RLS.
4. **P3:** limites dos formulários públicos.
5. **Publicação em etapas** (todas com backup e tudo desligado):
   1. código da branch na `main` com os interruptores desligados (regressão já comprovada: 96/96);
   2. migrations 0024-0033 na produção;
   3. ligar só o que for aprovado.
6. **Sandbox real da Stripe**: a WJB coloca as chaves e roda `sandbox.sh`.
7. P6 a P9 (qualidade).
8. Fase 10 fiscal (certificado, cofre, produção restrita).

## 7. Responsividade, acessibilidade e desempenho
### 7.1 Resultado desta execução
- 482 medições, 0 estouro horizontal, 0 bloqueio de zoom, 0 falhas sérias ou críticas no axe.
- Foco por teclado: 2 avisos (campo de mês em `/portal/nfse/nova` e campos de data em `/admin/logs`), **o mesmo falso positivo já conferido à mão na Fase 9**: o anel de foco existe e a borda muda de cor, mas o script mede antes de o Chrome aplicar o estilo nesses campos.
- **Não feito:** Safari, Firefox, aparelhos reais e leitor de tela.

### 7.2 Desempenho
 não foi medido de novo nesta auditoria (o Lighthouse não está instalado, e a API pública do PageSpeed estoura a cota). A última medição registrada (14/11) indicou LCP de 4 a 5,9 s no celular, em teste simulado, com a fonte do título como causa. É uma pendência a medir pelo pagespeed.web.dev.

## 8. Checklist de lançamento comercial da WJB AI
**Infraestrutura:**
- [ ] P1 (dependências) e P5 (banco de produção) resolvidos.
- [ ] Migrations 0024-0033 aplicadas na produção com backup.
- [ ] P2 (MFA na API).

**Pagamentos:**
- [ ] Conta Stripe empresarial ativa.
- [ ] Sandbox real executado com sucesso.
- [ ] Webhook de produção com segredo próprio.
- [ ] Migration e configuração do modo live, com autorização.

**Jurídico e fiscal:**
- [ ] Termos, privacidade, reembolso e representação fiscal revisados.
- [ ] Tributação do serviço da WJB definida.

**Emissão:**
- [ ] e-CNPJ A1 novo e cofre.
- [ ] Procurações.
- [ ] Teste em produção restrita.
- [ ] Emissão oficial liberada.
- [ ] Cobrança por nota oficial ligada.

**Experiência:**
- [ ] Testes em iPhone e Android, Safari, Firefox e leitor de tela.
- [ ] Medição de desempenho.

**Operação:**
- [ ] Agendamento das rotinas (fila, alertas, conciliação).
- [ ] Monitoramento.
- [ ] Processo de suporte e de contestação.

**Comercial:**
- [ ] Regra de inadimplência.
- [ ] Cobrança agrupada da Nota Avulsa.
- [ ] Destino do 2º WhatsApp.

## 9. Recomendação da próxima fase
**Não começar funcionalidade nova agora.** Recomendo uma **Fase 10A, de endurecimento e publicação controlada**:
1. P1 a P3.
2. Saúde do banco de produção.
3. Publicação em etapas com tudo desligado.
4. Sandbox real da Stripe assim que as chaves existirem.

A **Fase 10B fiscal** (certificado, cofre, produção restrita) começa quando o e-CNPJ e o cofre estiverem disponíveis. Ela é a condição para a WJB AI virar produto: sem emissão real, não há o que cobrar.
