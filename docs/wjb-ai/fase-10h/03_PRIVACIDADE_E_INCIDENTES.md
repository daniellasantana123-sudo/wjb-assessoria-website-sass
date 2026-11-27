# Privacidade e incidentes - registro para o encarregado (DPO)

> Documento para avaliação do encarregado de proteção de dados da WJB Assessoria Contábil.
> Apresenta fatos verificados e elementos de avaliação. **Não decide** se há obrigação de comunicar à ANPD ou aos titulares: isso é a confirmar pelo encarregado/jurídico.
> Horários em UTC (Brasília = UTC-3).

## 1. Resumo executivo

1. Até 27/11/2026, quem clicava em "Enviar" num formulário do site antes de a página terminar de carregar tinha os dados colocados no endereço (URL) da página.
2. Se essa pessoa tinha aceitado cookies, esse endereço pode ter sido enviado ao Google Analytics 4 (GA4).
3. A falha foi corrigida e publicada em 27/11/2026; não acontece mais.
4. Não temos acesso ao GA4 nem aos logs de acesso da Hostinger: não há prova de que nenhum dado real foi exposto.
5. A WJB precisa verificar o GA4, pedir os logs à Hostinger e, com isso, avaliar o caso.

## 2. Linha do tempo

| Data/hora (UTC) | Fato |
|---|---|
| Desde a criação do site (2026, data exata desconhecida) | Defeito provavelmente presente nos formulários |
| 26/11 21:56 | Prévia pública da Hostinger (calm-hotpink-okapi-85.hostingersite.com) passa a rodar código não aprovado com credenciais de produção |
| 27/11 15:28 | Prévia removida |
| 27/11 15:40 | Correção dos formulários publicada (main `195db04a`, versão Hostinger `01a21da6`) |
| 27/11 16:03 | Correção adicional da origem enviada ao GA4 (main `16138860`) |

## 3. Dados e titulares possivelmente afetados

- **Titulares:** visitantes do site que preencheram um formulário, clicaram em Enviar antes do carregamento completo **e** tinham aceitado cookies.
- **Formulários:** contato, proposta, formulários das páginas de serviço, assistente virtual (Dani), newsletter, popup de saída e tela de código MFA.
- **Dados:** nome, e-mail, telefone (WhatsApp), CNPJ, mensagem livre e demais campos do formulário. A mensagem livre pode conter qualquer informação que a pessoa tenha escrito.
- **Onde podem estar:** GA4 (campos `page_location` e, em alguns casos, `page_referrer`); logs de acesso HTTP/CDN da Hostinger; histórico/favoritos do navegador do visitante e links que ele próprio compartilhou (fora do controle da WJB).
- No teste, o GA4 mascarou o e-mail sozinho ("(redacted)"), mas **não** mascarou nome nem telefone.
- Volume: **desconhecido**.
- **Fora do GA4 por desenho:** a tela de código MFA fica no Portal/Admin e as telas de senha, onde o GTM **não é carregado**. Ali o risco se limita aos logs de acesso da Hostinger e ao histórico do navegador. As buscas do Admin (`/admin/empresas`, `/admin/logs`, documentos) usam GET de propósito, com o termo pesquisado na URL, só para a equipe logada e sem GTM.

## 4. O que foi feito e evidência

| Medida | Evidência |
|---|---|
| Campos bloqueados até a página carregar; envio só por POST (dados não vão mais para a URL) | Publicação de 27/11 15:40 (`195db04a` / `01a21da6`) |
| Antes de qualquer tag do Google, campos de formulário são retirados da URL (links antigos) e da origem enviada ao GA4 | Publicação de 27/11 16:03 (`16138860`) |
| Validação em produção, com a coleta do Google bloqueada no teste: parâmetros `dl`, `dr` e `dataLayer` sem dados | Registro técnico da Fase 10G (`docs/wjb-ai/fase-10g/01_HOTFIXES_SEGURANCA.md`) |
| GTM (GTM-TZKJ7CS8, GA4 G-74ZTS1SQYD) só carrega para quem aceitou cookies | Consent Mode básico no código do site |
| Logs da aplicação na Hostinger (10/11 a 27/11, 455 linhas): 0 ocorrências de `email=`, `phone=`, `name=` ou endereço de e-mail | Busca feita em 27/11; o Next.js não registra URL de pedidos |
| Prévia pública removida | 27/11 15:28; o processo foi iniciado só 4 vezes, todas por verificação nossa; sem indício de acesso de terceiros nem de vazamento de segredo |

Observação: em 27/11, duas execuções de validação enviaram ao GA4 dados **fictícios** ("Maria Ficticia", 11999998888, `utm_source=validacao10g`). Não são de titular real, mas aparecerão na busca.

## 5. O que NÃO se sabe

- Desde quando o defeito existia.
- Se algum titular real caiu nessa situação, e quantos.
- O que está hoje no GA4 (sem acesso).
- O que está nos logs de acesso HTTP/CDN da Hostinger (não disponíveis para nós).

## 6. Procedimento no GA4 (feito pela WJB)

O caminho dos menus muda com frequência: **conferir na interface atual do GA4**.

1. **Retenção:** em Admin > Coleta e modificação de dados > Retenção de dados, anotar o prazo configurado. Ele define até quando há dados para procurar.
2. **Busca:** em Explorar, criar uma Exploração livre cobrindo **todo o período disponível**. Dimensões: "Local da página" (`page_location`) e "Referenciador da página" (`page_referrer`). Filtro "contém": `name=`, `phone=`, `email=`, `cnpj=`, `message=` (um de cada vez). Métrica: contagem de eventos.
3. Alternativa: relatório Páginas e telas, com filtro equivalente.
4. **Separar** as linhas fictícias de 27/11 (`validacao10g`, "Maria Ficticia").
5. **Registrar só contagens** (quantas linhas, período, quais campos aparecem). Não copiar nem exportar nomes, telefones ou mensagens.
6. **Exclusão:** em Admin > Coleta e modificação de dados > Solicitações de exclusão de dados, pedir a exclusão dos parâmetros `page_location` e `page_referrer` no período afetado. Anotar data, período e número do pedido.
7. Avaliar se o prazo de retenção deve ser reduzido.

## 7. Texto para pedir os logs à Hostinger

> Olá. Somos responsáveis pelo site wjbassessoriacontabil.com.br. Precisamos, para uma avaliação de privacidade, dos logs de acesso HTTP e do CDN (hcdn) do site, pelo maior período disponível, e em especial do endereço de prévia calm-hotpink-okapi-85.hostingersite.com entre 26/11/2026 21:56 e 27/11/2026 15:28 UTC.
> Pedimos também: (1) o prazo de retenção desses logs; (2) se terceiros têm acesso a eles; (3) como solicitar a eliminação de registros específicos.
> Não precisamos de nenhuma credencial, senha ou chave.

## 8. Tratamento do que for encontrado nos logs

1. Procurar os mesmos termos (`name=`, `phone=`, `email=`, `cnpj=`, `message=`).
2. Registrar só contagens e datas. Não copiar, encaminhar nem guardar os dados.
3. Guardar o arquivo de log só pelo tempo da análise, em local restrito; depois apagar.
4. Pedir à Hostinger a eliminação dos registros, conforme a retenção informada.

## 9. Elementos para a avaliação do encarregado

- **Natureza:** dados de identificação e contato (nome, e-mail, telefone, CNPJ) e texto livre. Não há indício de dado sensível, mas a mensagem livre não pode ser descartada.
- **Volume:** desconhecido até a busca no GA4 e nos logs.
- **Destinatário:** Google (GA4), operador já usado pelo site com consentimento de cookies; e Hostinger (logs).
- **Risco:** depende do volume encontrado. Não há indício de acesso indevido por terceiros.
- **Medidas:** falha corrigida, defesa adicional publicada, prévia removida, exclusão no GA4 e eliminação nos logs a pedir.
- **Decisão sobre comunicação à ANPD e aos titulares, e prazos aplicáveis:** a confirmar pelo encarregado/jurídico, com base na LGPD (art. 48) e no Regulamento de Comunicação de Incidentes da ANPD.

## 10. Checklist de evidências

- [ ] Prazo de retenção do GA4 anotado
- [ ] Busca no GA4 feita (período, termos, contagens)
- [ ] Linhas fictícias de 27/11 identificadas e separadas
- [ ] Pedido de exclusão no GA4 feito (número e data)
- [ ] Pedido de logs enviado à Hostinger (data e protocolo)
- [ ] Resposta da Hostinger recebida (retenção, período entregue)
- [ ] Busca nos logs feita (só contagens)
- [ ] Eliminação dos logs pedida
- [ ] Decisão do encarregado registrada (comunicar ou não, e por quê)
