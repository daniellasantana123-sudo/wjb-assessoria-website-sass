# 06 - Validação fiscal oficial

**Nada abaixo foi conferido nesta etapa.** Nenhum endpoint, XSD, leiaute, regra de assinatura ou grupo IBS/CBS foi codificado. Esta tabela é o gate da fase F4.

| Fonte | URL | Versão | Data da consulta | Ambiente | Status |
| --- | --- | --- | --- | --- | --- |
| Documentação atual NFS-e | https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual | - | - | - | NÃO VERIFICADO |
| APIs produção restrita e produção | https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/apis-prod-restrita-e-producao | - | - | - | NÃO VERIFICADO |
| Leiautes de homologação | https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/producao-restrita | - | - | - | NÃO VERIFICADO |
| SEFIN Nacional (homologação) | https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional/docs/index | - | - | produção restrita | NÃO VERIFICADO |
| SEFIN Nacional (produção) | https://sefin.nfse.gov.br/SefinNacional/docs/index | - | - | produção | NÃO VERIFICADO |
| ADN Contribuintes | https://adn.nfse.gov.br/contribuintes/docs/index.html | - | - | - | NÃO VERIFICADO |
| Representação por procuração (nov/2026) | https://www.gov.br/nfse/pt-br/noticias/nova-funcionalidade-possibilita-representacao-e-alternancia-de-perfis-na-nfs-e | - | - | - | NÃO VERIFICADO |
| Alterações e implantações | https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/atualizacoes-e-implantacoes | - | - | - | NÃO VERIFICADO |

## O que o código faz hoje (sem fato fiscal)
- Valida dígitos de CPF e CNPJ, inclusive o CNPJ alfanumérico (o cálculo confere com o exemplo `12.ABC.345/01DE-35` divulgado pela Receita; ainda assim, conferir com o ato oficial).
- Recusa qualquer campo tributário vindo do cliente (alíquota, código de serviço etc.).
- Envia para revisão humana quando a descrição sugere mercadoria (heurística simples, não classificação fiscal).

## Decisões que exigem o contador
Matriz de enquadramento por cliente (código de serviço, município, retenções, regime), limite por nota sem revisão, quem pode autorizar emissão, elegibilidade de autônomo PF por município.
