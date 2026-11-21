# 50 - Fase 10A: matriz de testes (executados em 21/11/2026)

Ambiente: branch `wjb-ai/10a-hardening`, `next` 16.4.6, Supabase de homologação (`uisoyodnzdyaaxisujmk`), usuários e empresas fictícios. A produção não foi tocada.

| Bateria | Comando | Resultado |
| --- | --- | --- |
| Dependências | `npm audit` | **0 vulnerabilidades** (antes: 1 crítica, 4 altas, 10 moderadas) |
| Lint | `npm run lint` | sem erros |
| Tipos | `npm run typecheck` | sem erros |
| Build de produção (interruptores desligados) | `npm run build` | OK. Páginas do Portal e do Admin todas dinâmicas (0 estáticas) |
| Unitários e integração | `npx vitest run` | **611 / 611** (69 arquivos; +10 da Fase 10A: regra do step-up, retorno seguro, limite compartilhado e sua reserva, IP, 413, 429 e limites de campo) |
| Banco local, Postgres 17, 0001-0034: RLS, isolamento, concorrência, backup e restauração, rollback até antes da 0024 | `bash scripts/wjb-ai/homologacao/run.sh` | todos OK (T120-T128 novos: limite compartilhado, sem acesso de usuário logado nem anônimo, índices) |
| API da homologação: fiscal / comercial / pagamentos | `02`, `06`, `07` | **56 / 14 / 12**, 0 falhas |
| E2E com login real e **MFA TOTP real** (Fases 2-10A) | `staging.sh` | **44 / 44** |
| E2E de pagamentos simulados / webhook | `staging.sh` | **9 / 9**, **2 / 2** |
| Regressão com o build normal e tudo desligado | `npx playwright test` contra `next start` | **96 / 96** |
| Responsividade e acessibilidade (15 tamanhos, zoom de 200% e 400%) | `scripts/wjb-ai/qa/responsivo.sh` | **482 medições: 0 estouro, 0 bloqueio de zoom, 0 falhas no axe**. Dani cabe em 320, 390 e celular deitado |

## Cenários de segurança (E2E e API)
| Cenário | Resultado |
| --- | --- |
| Usuário com MFA que só passou pela senha chama `/api/me`, `/api/me/organizations` e download de documento | **401** nas três. `/admin` manda para `/verificar-mfa`. Depois do código, `/api/me` dá 200 |
| Reconfirmação de MFA com retorno para `/admin/nfse/permissoes` | volta exatamente para a página |
| Reconfirmação com `next=https://golpe.test/admin` | destino externo ignorado, vai para `/admin` |
| Ação crítica por contador sem MFA (aprovar perfil fiscal) | barrada no servidor ("exige a verificação em duas etapas") |
| Ação crítica por super admin com MFA recente (desconto do combo) | permitida |
| Página sensível sem MFA ativado | mostra "Ativar verificação em duas etapas" |
| Conceder aprovador, aprovar perfil, registrar autorização e autorizar envio, com MFA recente | permitidos (suíte da Fase 3 com os usuários que agora têm MFA) |
| Campo de lead com 200 caracteres / corpo de 20 mil caracteres | 400 / 413 |
| 6ª requisição no mesmo minuto | **429** pelo contador no banco. Só o hash da chave é gravado (sem IP em claro) |
| Isolamento entre empresas (fatura, checkout, assinatura, direito de uso, catálogo) | sem regressão (API 14/14 e 12/12) |
| Live na Stripe | segue recusado no banco (T104, T110, P9, P10) |

## Avisos do script de foco conferidos à mão (não são defeito)
- Campos de mês e data (`/portal/nfse/nova`, `/admin/logs`): o anel de foco aparece; o script mede antes do estilo.
- `/portal/obrigacoes`, `/portal/suporte`, `/admin/whatsapp` em 390 px: a conferência à mão com a página carregada mostrou **todos** os elementos visíveis recebendo foco. O script conta elementos antes de a página assentar.

## Testes manuais pendentes
| Item | Situação |
| --- | --- |
| iPhone (Safari) e Android (Chrome), incluindo o teclado virtual | não feito (sem aparelho) |
| Firefox e Safari no computador | não feito (navegadores não instalados) |
| VoiceOver e TalkBack | não feito |
| Desempenho (PageSpeed) depois do Next 16.4.6 | não medido |
| Sandbox real da Stripe | sem chaves |
| Exclusão de empresa com trilha de certificado | não testado |
