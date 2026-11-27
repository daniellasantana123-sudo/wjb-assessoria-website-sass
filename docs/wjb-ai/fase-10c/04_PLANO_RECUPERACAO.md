# Fase 10C - Plano de recuperação do banco de produção

**Projeto:** `wjb-website-app`. **Nada deste plano foi executado.**

Toda ação abaixo, mesmo um restore num projeto **separado**, exige:
- autorização específica da WJB;
- o diagnóstico do doc 03 preenchido.

Este plano complementa o `FASE-10B-PLANO-RECUPERACAO-PRODUCAO.md` e o substitui como referência.

## 1. Regra de ouro
- Nunca restaurar, recriar, apagar ou migrar **por cima** da produção.
- Toda recuperação acontece **primeiro num projeto separado**, com conferência, e só depois se decide a troca.
- Não presumir que os dados voltaram porque as tabelas respondem. Não presumir que foram perdidos sem confirmação do suporte.

## 2. Árvore de decisão (a partir do doc 03)
| O diagnóstico mostra | Caminho | Quem decide |
| --- | --- | --- |
| **A.** Usuários e contagens batem com a referência (1 conta, 2 empresas, 6 obrigações), RLS ligada, migrations até 0023 | sem recuperação; conferir o login da CEO com MFA e seguir com o Portão 0 | WJB |
| **B.** Tabelas vazias ou contagens abaixo da referência, **e há backup ou PITR** anterior a 19/11 | restaurar **num projeto novo** (seção 3) | WJB, com o suporte |
| **C.** Tabelas vazias e **sem backup** | reconstrução controlada (seção 4) | WJB |
| **D.** RLS desligada em alguma tabela, papéis sem senha ou usuário desconhecido | **incidente de segurança primeiro**: trocar senhas e chaves do projeto, revisar o Auth, falar com o suporte, e só então recuperar | WJB |

## 3. Restauração num projeto separado (caminho B)
1. O suporte ou o painel restaura o backup ou PITR **num projeto novo**, por exemplo `wjb-website-app-restore`. Nunca no atual.
2. No projeto restaurado:
   - rodar as consultas do doc 03;
   - comparar com a referência e com os e-mails do Resend (leads);
   - conferir que a RLS está ligada;
   - fazer login da CEO;
   - testar o isolamento entre empresas (o mesmo roteiro do `run.sh`, adaptado só para leitura).
3. Decisão documentada: trocar a aplicação para o projeto restaurado (mudar `SUPABASE_URL` e as chaves no painel da Hostinger) **ou** copiar dados específicos.
4. **Rollback:** voltar as variáveis da Hostinger para o projeto antigo. Ele não é apagado por, no mínimo, 30 dias.

## 4. Reconstrução sem backup (caminho C)
1. Projeto novo, plano pago com backup diário. O plano gratuito pausa e não guarda backup acessível.
2. Migrations **0001 a 0023**, em ordem, com backup testado antes de cada lote (o mesmo roteiro da homologação). As 0024 a 0037 ficam fora até a aprovação da WJB AI.
3. Conta da CEO e MFA.
4. Empresas: reimportar do G-Click pelo CNPJ (a tela de importação existe desde 01/10).
5. Obrigações sincronizadas: botão "Sincronizar obrigações" por empresa.
6. Convites de novo para clientes e equipe.
7. Leads: reconstruir a partir dos e-mails do Resend, se a WJB quiser.

**O que não volta sem backup:**
- obrigações lançadas à mão;
- documentos do Storage (a menos que a equipe tenha cópias);
- trilha de auditoria;
- histórico de chamados.

## 5. Perguntas ao suporte (continuam valendo)
1. Causa do incidente de 19 e 20/11 (papéis internos sem senha).
2. O banco atual é o mesmo de antes ou foi recriado ou restaurado? De quando são os dados?
3. Existe snapshot ou PITR anterior a 19/11? Pode ser restaurado num **projeto novo**?
4. Os usuários do `auth` foram preservados?
5. Houve restore, reset ou migration depois de 20/11? Quem executou?
6. O Storage foi afetado?

## 6. Depois da recuperação (qualquer caminho)
- [ ] Backup diário ou PITR ativo e **testado** por restauração num projeto separado.
- [ ] Senha do banco, chave de serviço e JWT secret trocados, se houver qualquer suspeita de exposição.
- [ ] MFA em todas as contas do painel do Supabase.
- [ ] Alerta de pausa ou de falha (o plano gratuito pausa por inatividade).
- [ ] Registro da decisão e das contagens finais.
