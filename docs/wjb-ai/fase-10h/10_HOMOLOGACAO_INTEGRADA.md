# Fase 10H - Homologação integrada (resultados)

Candidato testado: `feature/wjb-fase-10h` (`22165ce8`), isto é, as Fases 10C a 10H mais a `main` atual.

## 1. Resultados
| Bateria | Ambiente | Módulos | Resultado |
| --- | --- | --- | --- |
| CI: lint, tipos, segredos, `npm audit` | GitHub Linux | - | verde |
| CI: unitários Node 22 e 24 | GitHub Linux | - | verde |
| CI: banco (0001 a 0038 do zero, RLS, isolamento, MFA no banco, concorrência, backup e restauração, rollback 0038 → 0024) | Postgres 17 descartável | - | **sem falhas** |
| CI: E2E Chromium, Firefox, WebKit e iPhone emulado | GitHub Linux | desligados (como a produção) | **228 aprovados, 0 instáveis** |
| Unitários | local | - | **767/767** |
| Staging: NFS-e, Admin, MFA, certificados, Fases 7 a 10F | homologação, login real com MFA | ligados | **49/49** |
| Staging: pagamentos simulados (contratação, combo, renovação, reembolso, origem de cobrança, cancelamento, empresa B isolada) | homologação | pagamentos simulados | **11/11** |
| Staging: webhook com assinatura | homologação | Stripe com chaves de formato | **2/2** |
| Regressão no modo da Hostinger (`next start -H 0.0.0.0`) | local | desligados | **110/110** E2E (146 de staging pulam fora da homologação) |
| Imagem otimizada com Host da prévia e oficial | local, modo Hostinger | - | 200 e 200; `/login` da prévia 421 |
| GTM (contêiner real, coleta bloqueada) | local e produção | - | `dl`, `dr` e `dataLayer` sem dado pessoal |

## 2. Cobertura por módulo pedido
| Módulo | Coberto por | Lacuna |
| --- | --- | --- |
| Site comercial | E2E local + 4 navegadores | Safari real |
| Portal, Admin, autenticação e MFA, usuários, empresas | staging + integração | - |
| Documentos | integração (upload, download) | E2E de upload real em homologação |
| Omie | não existe integração financeira (por desenho) | - |
| G-Click | integração com provedor simulado | chamada real só em produção (interruptor), preservada e não exercitada |
| Stripe | simulado + webhook | **Sandbox real (sem chaves)** |
| Certificados | staging + unitários + banco | certificado real (bloqueado) |
| NFS-e | doc 09 | governo (bloqueado) |
| Assistente virtual, WhatsApp (Click-to-Chat) | E2E | - |
| Notificações | integração, staging | e-mail real não é chamado na homologação |
| Logs de auditoria, permissões, isolamento | staging + banco | - |

## 3. Condições da Hostinger reproduzidas
| Condição | Como |
| --- | --- |
| Servidor em `0.0.0.0` e otimizador de imagens com pedido interno sem Host | regressão com `-H 0.0.0.0` + `images.spec.ts` |
| Bloqueio por domínio | `curl` com `Host` da prévia |
| Desafio anti-robô do CDN (403 seguido de recarga) | não dá para reproduzir localmente; validado **em produção** com `validar-gtm.mjs` (coleta bloqueada), que passou pelo desafio |
| Node.js 22 | job de unitários Node 22 |

## 4. Safari real
Não executado (sem aparelho disponível nesta máquina). Roteiro manual de 5 minutos: doc 09 da Fase 10G, seção 4.
