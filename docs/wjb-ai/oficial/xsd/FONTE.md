# Esquemas XSD oficiais da DPS (cópia de referência)

Cópia **sem nenhuma alteração** dos arquivos necessários para validar a DPS, obtidos da documentação pública do Portal Nacional da NFS-e em 20/11/2026. Os testes de contrato (`src/tests/unit/wjb-ai-dps-xsd.test.ts`) validam o XML gerado pelo conector contra estes arquivos com `xmllint`.

| Pasta | Pacote oficial | URL | SHA-256 do zip |
| --- | --- | --- | --- |
| `producao-v1.01-20260209/` | Esquemas de **produção** v1.01 (NT 004 v2.0 + NT 007), de 09/02/2026 | https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual/nfse-esquemas_xsd-v1-01-20260209.zip | `e7935cbd9470527c6cc32984c1b2263e614183bf0139ce2733eaaed2de9a8072` |
| `producao-restrita-nt009-r1-20261020/` | Esquemas de **produção restrita** (NT 009, release 1), de 20/10/2026 | https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/producao-restrita/esquemas_prod_restrita_20261020.zip | `25fdcecc651a67a216496ab10d7566631e6ed10f721e37d62c7845dadb0ea267` |
| `producao-restrita-nt009-r2-20261124/` | Esquemas de **produção restrita** (NT 009, release 2), de 24/11/2026. Baixado em 26/11/2026 (Fase 10B). Só os 4 arquivos da DPS foram copiados, sem alteração | https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/producao-restrita/esquemas-xsd-producao-restrita-20261124.zip | `1ca83c1a7929f6d5684c9a17700fe3d3a375e4ea12b7ccb832bfc369768902c0` |

Os dois pacotes declaram o mesmo `versao="1.01"`, mas o conteúdo é diferente. Por isso o conector escolhe o pacote por **ambiente e data de vigência** (`src/lib/wjb-ai/fiscal/national/layouts.ts`), nunca pelo atributo `versao`.

Ao trocar de pacote: baixar o zip novo, conferir o SHA-256, criar uma pasta nova (não sobrescrever) e registrar o pacote no registro de leiautes com a data de vigência publicada pelo CGNFS-e.

**Release 2 (Fase 10B):** `DPS_v1.01.xsd` e `xmldsig-core-schema.xsd` são idênticos aos do release 1; `tiposComplexos` e `tiposSimples` mudaram. Mudança que afeta o conector: `indDest` saiu do grupo IBS/CBS e virou **obrigatório** em `infDPS`, logo depois de `toma`. O Anexo I de produção restrita também foi atualizado (`anexo_i-sefin_adn-dps_nfse-snnfse_prodrest-v1-01-20261124.xlsx`, SHA-256 `cf4d1d36daae5600060db2b36d9a84a703aa209cb099a0abbd7d3793c3e7e928`, não versionado aqui). Em produção, a notícia do CGNFS-e de 25/11/2026 fala em "prevista para 07/12/2026", sem cronograma formal: o leiaute fica sem data de produção no registro.
