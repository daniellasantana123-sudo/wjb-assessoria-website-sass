# 15 - Proposta: cofre de certificados digitais

**Status:** proposta para decisão. Nenhum certificado real foi solicitado nem cadastrado.

## Requisitos
- PFX/P12, senha e chave privada **nunca** no banco, logs, repositório, navegador, n8n ou LLM.
- Banco guarda só a referência (`fiscal_authorization_grants.certificate_vault_reference`, já na 0024).
- Uso do certificado só pelo worker de transmissão, com autorização registrada, escopo e validade conferidos no momento do uso.
- Auditoria de cada uso; rotação, revogação e alerta de vencimento.

## Opções

| Opção | Como funciona | Prós | Contras |
| --- | --- | --- | --- |
| **A. Certificado A1 cifrado com KMS de nuvem** (AWS KMS, Google Cloud KMS ou Azure Key Vault) | PFX cifrado com chave mestra do KMS (envelope encryption); descifrado só em memória no worker | custo baixo, auditoria nativa, rotação de chave | a chave privada do certificado passa pela memória do worker |
| **B. Key Vault/HSM gerenciado com importação da chave** (Azure Key Vault Premium, AWS CloudHSM) | chave privada importada para HSM não exportável; a assinatura é feita dentro do HSM | chave nunca sai do HSM | custo maior; exige que a assinatura XML seja feita via API do HSM |
| **C. Certificado em nuvem ICP-Brasil (A3 remoto)** de uma AC credenciada | a AC guarda a chave em HSM próprio e assina por API | modelo do próprio ICP-Brasil; sem PFX circulando | dependência e custo por assinatura da AC; integração por AC |

**Recomendação preliminar:** começar a homologação com **A** (custo e esforço menores, controles suficientes com acesso mínimo) e avaliar **C** para produção, porque mantém a chave em HSM de AC credenciada. A decisão final depende do custo e do que a WJB já usa hoje.

## Ciclo de vida
1. **Cadastro**: presença humana do titular; validação de cadeia ICP-Brasil, titularidade (CNPJ/CPF do emitente) e validade.
2. **Uso**: worker pede a assinatura com `request_id`; o cofre registra quem, quando e para qual pedido.
3. **Rotação**: alerta 30 e 7 dias antes do vencimento; novo certificado cadastrado antes de revogar o antigo.
4. **Revogação**: imediata pelo super_admin; pedidos pendentes daquela empresa voltam para revisão.
5. **Segregação**: chaves e cofres separados para homologação e produção.
