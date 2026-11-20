# 12 - Pendências e decisões

## Decisões da WJB (20/11/2026)
- Fase 1 publicada (módulo desligado). Feito em 20/11, commit `a7d15d22`.
- 0024 aprovada só para homologação. Feito (ver 17); produção aguarda apresentação do resultado e aprovação.
- Aprovação de perfil fiscal: papel `contador` + permissão granular `fiscal_profile.approve`, concedida e revogada por super_admin, nunca automática. Feito no banco.
- Desenvolvimento com dados fictícios; nenhum certificado real; nenhum envio a provedor de IA.

## Produção (20/11/2026) - ver 19 e 20
- **Incidente:** banco de produção não sobe; papéis internos do Supabase sem senha e esquema do Realtime incompleto. Não vem do código da WJB. **Ação do proprietário: chamado ao suporte do Supabase** (texto pronto no 19). Nenhuma ação feita na produção.
- **Sem backup** da produção até agora.
- Nano -> Micro: análise pronta (20), **não autorizado**; só depois do incidente e do primeiro backup.

## Fase 3 concluída e Fase 4 iniciada (20/11/2026) - ver 23 e 24
- Chave exposta revogada (401), nova em uso, Git/docs/logs sem credenciais.
- Menu NFS-e no Admin (desktop e celular, só com módulo ligado e permissão), avisos ao cliente, correção do mesmo pedido com versões (0026).
- Fase 4: documentação oficial analisada; conector SEFIN Nacional em modo simulado com 14 testes de contrato; estrutura de execução dos 6 agentes sem IA.
- **Decisões para a homologação oficial:** ver doc 24, seção 6 (certificado de teste e cofre, quem emite, parametrização do contador, série da DPS, autorização).
- Técnico: sequência persistente do número da DPS (migration), armazenamento protegido do XML da NFS-e, ligar o conector nacional na fila só após homologação; desligar chaves Legacy da homologação (proprietário).

## Homologação e Fase 3 (20/11/2026) - ver 21 e 22
- Homologação real concluída: 0001-0025 aplicadas, backup verificável, 35/35 testes pela API, 13/13 E2E com login real.
- Fase 3 implementada e testada só na homologação/staging.
- **Pendente do proprietário:** apagar a chave secreta `default` (`…myoIzfFl`) do projeto de homologação, que foi exposta no chat.
- **Próximas aprovações:** publicar a branch (módulo desligado), aplicar 0024+0025 em produção (depois do incidente resolvido e com backup), agendar a fila (GitHub Actions) quando houver ativação.
- Técnico: link NFS-e no menu do celular do Admin; notificação ao cliente quando a revisão terminar; tela para o cliente corrigir pedido em DADOS_PENDENTES (hoje cria um novo).

## Homologação (20/11/2026) - plano
- Custo aprovado (≈ US$ 10/mês). Scripts prontos e testados localmente.
- **Aguardando do proprietário:** criar `wjb-ai-homologacao` e o arquivo `.env.homolog.local`.

## Fase A (20/11/2026) - ver 18
- Supabase Pro confirmado; o projeto de produção já está na organização Pro.
- **Aguardando:** aprovação do custo do projeto `wjb-ai-homologacao` (≈ US$ 10/mês, fora do Spend Cap) e sua criação no painel.
- **Atenção:** banco de produção em "coming up" durante a auditoria; não foi tocado.

## Pendentes - dependem da WJB
1. Aprovar a aplicação da 0024 em produção.
2. Aprovar a publicação do código da F2 (telas do Portal, desligadas).
3. ~~Contratar o plano pago do Supabase~~ (feito em 20/11). Criar o projeto `wjb-ai-homologacao` (ver 18).
4. Escolher a opção de cofre de certificados (ver 15).
5. Provedor de LLM: contrato, retenção, RIPD (ver 14).
6. Contador: matriz de enquadramento e limite por nota de cada cliente.
7. Credenciamento/procuração da WJB no Emissor Nacional para a homologação oficial.

## Pendentes - técnicas
1. Telas no Admin: concessão/revogação de `fiscal_profile.approve`, cadastro e aprovação de perfil fiscal, fila de revisão.
2. Fila de envio com `MockFiscalProvider` e conciliação (F3).
3. Teste do caminho aplicação -> PostgREST -> banco num projeto Supabase de homologação.
4. Link "NFS-e" no menu do Portal: entra junto com a ativação, para não mudar a navegação existente antes da hora.
5. Rate limit persistente.
6. Conferência da documentação fiscal oficial (06).

## Decisões técnicas
- Módulo isolado; arquivos existentes alterados só de forma aditiva: `src/types/database.ts` (tipos das tabelas novas) e `src/lib/audit-labels.ts` (rótulos das ações novas).
- Aprovação de perfil só por função no banco: nem editando a tabela direto nem sendo super_admin dá para aprovar.
- Homologação local em Postgres 17 com camada mínima do Supabase, enquanto não houver projeto Supabase de homologação.
- Os 14 papéis seguem executados em sequência por um agente; sem parecer humano independente.
