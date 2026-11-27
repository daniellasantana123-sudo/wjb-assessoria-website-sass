# Fase 10H - Pendências externas

| Pendência | Por que está pendente | Responsável | Ação necessária | Depende dela | O que continua sem ela |
| --- | --- | --- | --- | --- | --- |
| **Desligar as prévias automáticas** | exige login no hPanel | administrador da Hostinger (WJB) | doc 02, seção 2 | proteção da `main`, PR do candidato, isolamento completo | bloqueio por domínio já protege; desenvolvimento segue sem PR |
| Logs de acesso da Hostinger | só o suporte fornece | WJB | mensagem pronta no doc 02, seção 3 | fechar a investigação da prévia e da privacidade; decidir a rotação | nada bloqueado no código |
| **Auditoria do banco** | só a WJB tem acesso ao painel; não usamos a chave de produção | WJB | doc 04 | merge integral, migrations, recuperação | homologação, CI e documentação |
| Chamado ao Supabase e preservação de backups | só a conta dona do projeto abre | WJB | texto no doc 02 da 10G | recuperação de dados anteriores a 12/10 | idem |
| Avaliação do incidente de privacidade | decisão do encarregado | encarregado/DPO da WJB | doc 03 (GA4, logs, decisão sobre comunicação) | encerramento do incidente | nenhuma funcionalidade |
| **Chaves de teste da Stripe** | não foram configuradas | responsável pela conta Stripe | doc 06 | Sandbox real (13 cenários), aprovação de pagamentos | simulado, webhook, regras |
| Métodos Pix, boleto, Apple/Google Pay e Pix Automático | configuração e elegibilidade da conta | responsável Stripe | doc 06, passo 5 | validar esses métodos | cartão |
| Preços dos novos serviços | decisão comercial | WJB | aprovar valores | catálogo e pagamento avulso | estrutura pronta |
| Origens de cobrança dos clientes atuais | operação | equipe da WJB | registrar no Admin depois do merge | contratação segura pela Stripe | - |
| Conta AWS e custo do cofre | contratação não autorizada | WJB | aprovar (≈ US$ 1 a 3/mês) | certificado real | adaptadores e testes |
| Certificado novo | revogação e reemissão pela titular | titular do certificado | novo par de chaves | NFS-e oficial | infraestrutura e simulação |
| Questionário fiscal | regras não podem ser presumidas | contador | responder o doc 07 da 10G | emissão oficial | simulação |
| Proteção da `main` | condição do PO: prévias desligadas | administrador do GitHub | aplicar depois da primeira linha desta tabela | governança do merge | hotfix pelo procedimento emergencial |
| Receber os alertas | notificação por conta | responsável no GitHub | *Watch* no repositório com e-mail | aviso de falhas | os issues são abertos mesmo assim |
| Horário dos lembretes | o GitHub atrasa 6 a 11 h | WJB | decidir antecipar o agendamento ou usar agendador externo | lembrete de manhã | lembretes continuam chegando no mesmo dia |
| Safari real | sem aparelho nesta máquina | quem tiver iPhone ou Mac | roteiro de 5 minutos (doc 09 da 10G) | evidência em Safari | WebKit emulado na CI |

## Branch a não usar
`hotfix/alertas-rotinas` (antiga) parte da `main` de antes dos hotfixes: publicá-la **desfaria** as correções de segurança. Use a `hotfix/alertas-rotinas-v2`, já publicada. A antiga foi mantida (nada foi apagado) e pode ser removida pelo administrador.
