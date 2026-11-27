# Fase 10G - Homologação integrada

## 1. Ambientes
| Ambiente | Para quê | Credenciais |
| --- | --- | --- |
| Local, build de produção (`next start`) | regressão do site, Portal e Admin sem login | nenhuma |
| CI no GitHub (Linux) | Chromium, Firefox, WebKit e iPhone emulado; banco descartável | nenhuma |
| Homologação (`staging.sh`, Supabase `uisoyodnzdyaaxisujmk`) | login real com MFA, usuários e empresas fictícios, NFS-e simulada, pagamentos simulados | `.env.homolog*.local` (fora do Git) |
| Sandbox da Stripe (`sandbox.sh`) | pagamentos reais em modo de teste | **aguarda as chaves de teste** |
| Produção | só leitura (`monitorar.sh`, validação GTM) | nenhuma; chave de serviço nunca usada |

## 2. Cobertura por módulo
| Módulo | Testes existentes | Onde roda | Lacuna |
| --- | --- | --- | --- |
| Site comercial | `navigation`, `mega-menu`, `nav-dropdown`, `content-pages`, `testimonials`, `responsive-audit`, **`images` (novo)** | local, CI | Safari real |
| Formulários e privacidade | `contact-form`, `forms-hydration`, `exit-intent-popup`; unitário `pii-query-scrub`; integração `leads-api` | local, CI | - |
| Assistente virtual | `assistant`, `assistant-buttons` | local, CI | - |
| Autenticação e MFA | `portal-auth`, `staging-fase10a`; integração `mfa-actions` | homologação | - |
| Portal do Cliente e Admin | `client-area`, `tickets`, `staging-nfse*` | local (sem login), homologação | - |
| Usuários, empresas e contexto | integração `account-status-actions`, `admin-console-actions`, `tenant-context`, `invite-notifications`, `me-*` | unitário/integração | - |
| Documentos | integração `documents-upload-action`, `documents-download-api` | unitário/integração | E2E de upload real em homologação |
| G-Click (Omie.G-Click) | integração `omie-gclick-actions`, `gclick-import-action`, `gclick-task-action` (provedor simulado) | unitário/integração | chamada real só em produção, com o interruptor `GCLICK_REAL_INTEGRATION_ENABLED` (preservada, não testada nesta fase) |
| Omie financeiro | não existe integração (por desenho) | - | - |
| Stripe | `staging-payments` (11), `staging-payments-webhook` (2), unitários de pagamento; Sandbox com 13 cenários | homologação; Sandbox aguarda chaves | Sandbox real |
| Certificados digitais | `staging-fase10c`, `staging-fase10f`, unitários 10B/10C/10F, banco 0036/0037 | homologação, CI | certificado real (bloqueado) |
| NFS-e simulada | `staging-nfse*` (fases 7 a 9), XSD oficiais, `wjb-fase10f-nfse` | homologação, CI | governo (bloqueado) |
| Notificações | integração `notifications-read-api`, `cron-reminders-route`; staging NFS-e (avisos) | unitário, homologação | e-mail real (Resend) não é chamado em homologação |
| WhatsApp | Click-to-Chat (link), sem API; botões do assistente | CI | - |
| Logs de auditoria | asserções de `audit_log` nos stagings (sem dado pessoal), `audit-labels` | homologação, unitário | - |
| Controle de acesso e isolamento entre empresas | banco: RLS, isolamento e MFA no banco (`run.sh`, job `banco`); staging: empresa B não abre o da A | CI, homologação | - |

## 3. Resultados desta fase
| Bateria | Resultado |
| --- | --- |
| Regressão local do hotfix publicado (build de produção) | lint, tipos, 381 unitários, E2E 106/106 |
| CI do hotfix nos 4 navegadores | 219 aprovados, 0 instáveis (antes da correção das imagens); depois da correção: ver doc 00 |
| Validação da produção depois do deploy | doc 01 |

## 4. Safari real
O WebKit do Playwright usa o mesmo motor do Safari, mas não é o Safari da Apple, e o Playwright 1.62 não instala WebKit no macOS 13 desta máquina. **Roteiro manual para um iPhone ou Mac com Safari** (5 minutos, sem login):
1. Abrir `https://wjbassessoriacontabil.com.br/contato` com rede lenta (ou logo depois de abrir) e tentar tocar em **Enviar** antes de a página terminar: o botão deve estar desativado.
2. Digitar o nome assim que a página aparecer: o texto não pode sumir.
3. Abrir `https://wjbassessoriacontabil.com.br/contato?name=Teste&email=a%40b.c`: a barra de endereço deve ficar só com `/contato`.
4. Conferir que logo e fotos da Home aparecem.
5. Abrir a assistente virtual e o menu.
