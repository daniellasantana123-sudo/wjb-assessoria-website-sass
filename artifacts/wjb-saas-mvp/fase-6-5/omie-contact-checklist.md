# Checklist de contato com a Omie/G-Click

O que a WJB precisa confirmar diretamente com a Omie (suporte técnico ou comercial) antes de reativar a integração real. Nada abaixo foi respondido nesta sessão - são perguntas, não suposições.

## Acesso à documentação técnica

- [ ] Como obter acesso de leitura à documentação técnica completa (Postman: `documenter.getpostman.com/view/12417251/UV5TFeha`) - é pública, ou exige login/convite?
- [ ] Existe uma versão exportável (PDF, OpenAPI/Swagger, JSON da collection) que não dependa de JavaScript para ser lida?

## Criação da aplicação/API

- [ ] Como a WJB cria uma aplicação/registro de API para a própria conta G-Click?
- [ ] Existe um portal de desenvolvedor separado (como o `developer.omie.com.br` do Omie ERP)?
- [ ] Existe ambiente de homologação/sandbox para testar sem afetar dados reais de clientes?

## Modelo de credenciais

- [ ] Quais são os parâmetros exatos exigidos pelo endpoint "Gerar credenciais"?
- [ ] O que ele devolve exatamente (nome do campo do token, formato)?
- [ ] Qual a validade do token e como renovar?
- [ ] Qual o header/formato exato usado nas chamadas subsequentes?
- [ ] Existe rate limit documentado? Qual o comportamento em caso de excedê-lo?

## Endpoint de clientes

- [ ] Host/base URL real da API.
- [ ] Método HTTP e path exatos de cada operação (criar/alterar/listar/buscar cliente, buscar clienteId, grupo, visibilidade).
- [ ] Schema de request/response de cada uma.
- [ ] Existe um campo de correlação com sistema externo (equivalente ao `codigo_cliente_integracao` do Omie ERP), pra evitar precisar já saber o ID interno do G-Click de antemão?
- [ ] Comportamento em cliente inexistente/duplicado.

## Tarefas e pré-tarefas

- [ ] Schema técnico de "Listar tarefas" e "Criar pré-tarefa" (ambos citados como existentes, mas sem schema confirmado nesta sessão).
- [ ] O que exatamente qualifica um endpoint como `partner_only` ("Responder atividade", "Criar pré-tarefa com tag") - existe um programa de parceiros que a WJB pode solicitar entrada?
- [ ] Caso a WJB entre no programa de parceiros, isso muda o modelo de autenticação ou só libera esses 2 endpoints extras?

## Portal Visão do Cliente

- [ ] Existe alguma forma oficial (API ou não) de a contabilidade pré-cadastrar/importar o "usuário externo" de um cliente em lote, além da importação manual já documentada?
- [ ] A personalização visual do portal (branding) pode incluir um domínio próprio da WJB, ou é sempre `visao.gclick.com.br`?

## Suporte técnico

- [ ] Qual o canal oficial de suporte técnico para dúvidas de integração (diferente do suporte comercial/uso do produto)?
- [ ] Tempo de resposta esperado para dúvidas técnicas de API.

## Programa de parceiros

- [ ] Existe processo formal de homologação de integração pra ISVs/parceiros de tecnologia?
- [ ] Quais os requisitos (técnicos, comerciais, volume mínimo) para participar?

Nenhuma resposta da Omie foi presumida ou inventada neste documento - é uma lista de perguntas a fazer, não um registro de respostas.
