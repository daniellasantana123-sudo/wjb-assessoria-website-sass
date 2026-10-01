# Histórico de versões — Plataforma WJB

Site institucional, Portal do Cliente e Admin WJB.
Desenvolvido por [Armel-x Tecnologia](https://armelx.com/).

As versões seguem o formato `maior.menor.correção`:

- **maior** muda quando algo deixa de funcionar como antes para quem usa;
- **menor** muda quando entra uma funcionalidade nova;
- **correção** muda quando só há correções.

A versão em uso aparece no rodapé da barra lateral do Portal e do Admin, junto com o código e a data do build.

Para lançar uma versão:

1. atualize `version` no `package.json`;
2. registre as mudanças aqui;
3. crie a etiqueta no Git (`git tag v1.2.0` e `git push origin v1.2.0`).

## 1.2.0 — 01/10/2026

### Novidades

- **Atalho para o guia no primeiro acesso:** abaixo do formulário de boas-vindas (o que a pessoa preenche ao aceitar o convite) aparece um link para o guia, abrindo em nova aba. Clientes veem o Guia do Portal (`/ajuda`); a equipe da WJB vê o manual da plataforma.

## 1.1.0 — 01/10/2026

### Novidades

- **Importar do G-Click** (`/admin/empresas/importar`): lista todos os clientes do G-Click e traz para a plataforma em lote, já vinculados. Se já existe uma empresa com o mesmo CNPJ, ela só é vinculada.
- **Busca pelo nome fantasia:** a busca de clientes no G-Click e a busca de Empresas acham por razão social, nome fantasia ou CNPJ, sem diferenciar maiúscula nem acento.
- **Avisos de obrigação ao cliente**, no Portal e por e-mail:
  - nova obrigação lançada;
  - obrigação concluída;
  - lembrete diário para obrigações que vencem hoje ou em 3 dias.
- **Admin com barra lateral**, igual à do Portal.
- **Manual da plataforma:**
  - `/admin/manual`, para a equipe;
  - `/ajuda`, guia do Portal para clientes, com capa de pré-visualização no WhatsApp.
- **Primeiro acesso por convite em uma tela só**, com nome e senha, a partir de um único e-mail.
- **Botão de mostrar e ocultar senha.**
- **Versão e assinatura** no rodapé do Portal e do Admin.

### Mudanças

- **Papel Atendimento:** não apaga documentos e não mexe em obrigações nem no G-Click. Essas ações ficam com Contador e Super admin.
- **"Sincronizar cadastro da empresa":** numa empresa já vinculada, só confere o vínculo. Não sobrescreve mais o cadastro no G-Click.
- **Confirmação antes de ações sensíveis:**
  - suspender e revogar;
  - apagar;
  - trocar papel;
  - desativar a integração;
  - desativar a verificação em duas etapas.

### Correções

- Convites e recuperação de senha que levavam ao login sem sessão.
- Upload de arquivos acima de 1 MB recusado.
- Horários e status "Atrasada" calculados no fuso UTC em vez do de Brasília.
- Notificações marcadas como lidas sem clique.
- Item ativo do menu do Portal desatualizado ao navegar.
- Ajustes de layout no celular.
- Registros de auditoria sem rótulo em português.
- Segurança: um usuário logado podia alterar o próprio papel direto no banco (migration 0022).
- Atualização de dependências com falhas de segurança.

## 1.0.0 — 23/09/2026

- **Portal do Cliente e Admin WJB abertos ao público.**
- **Integração com o Omie.G-Click:** vínculo de clientes, sincronização de obrigações e andamento das tarefas.
- **Documentos, guias, chamados, mensagens, relatórios e notificações por e-mail.**

## 0.1.0 — 18/09/2026

- **Site institucional da WJB Assessoria Contábil.**
