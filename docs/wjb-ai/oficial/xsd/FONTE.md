# Esquemas XSD oficiais da DPS (cópia de referência)

Cópia **sem nenhuma alteração** dos arquivos necessários para validar a DPS, obtidos da documentação pública do Portal Nacional da NFS-e em 20/11/2026. Os testes de contrato (`src/tests/unit/wjb-ai-dps-xsd.test.ts`) validam o XML gerado pelo conector contra estes arquivos com `xmllint`.

| Pasta | Pacote oficial | URL | SHA-256 do zip |
| --- | --- | --- | --- |
| `producao-v1.01-20260209/` | Esquemas de **produção** v1.01 (NT 004 v2.0 + NT 007), de 09/02/2026 | https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual/nfse-esquemas_xsd-v1-01-20260209.zip | `e7935cbd9470527c6cc32984c1b2263e614183bf0139ce2733eaaed2de9a8072` |
| `producao-restrita-nt009-r1-20261020/` | Esquemas de **produção restrita** (NT 009, release 1), de 20/10/2026 | https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/producao-restrita/esquemas_prod_restrita_20261020.zip | `25fdcecc651a67a216496ab10d7566631e6ed10f721e37d62c7845dadb0ea267` |

Os dois pacotes declaram o mesmo `versao="1.01"`, mas o conteúdo é diferente. Por isso o conector escolhe o pacote por **ambiente e data de vigência** (`src/lib/wjb-ai/fiscal/national/layouts.ts`), nunca pelo atributo `versao`.

Ao trocar de pacote: baixar o zip novo, conferir o SHA-256, criar uma pasta nova (não sobrescrever) e registrar o pacote no registro de leiautes com a data de vigência publicada pelo CGNFS-e.
