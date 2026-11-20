# 26 - Arquitetura de certificados digitais e procurações

**Atualização da Fase 6:** o algoritmo oficial documentado é RSA-SHA1 (Manual Integrado 6.1.4), o que exclui o AWS KMS para a DPS. Plano consolidado no doc 30.

**Status:** proposta para decisão da WJB. Nenhum certificado foi solicitado, comprado ou instalado; nenhum serviço foi contratado. Complementa o doc 15 com o que a documentação oficial confirmou na Fase 5.

## 1. Os dois modelos aprovados

| | Modelo A: certificado da WJB + procuração | Modelo B: certificado do cliente |
| --- | --- | --- |
| Quando | Cliente concede procuração eletrônica específica e válida | Necessário e autorizado pelo cliente |
| Certificado | e-CNPJ da WJB (um para todos os clientes com procuração) | um por cliente (e-CNPJ ou e-CPF) |
| Conexão mTLS e assinatura | certificado da WJB (FAQ 17.7) | certificado do cliente |
| `<emit>` da DPS | CNPJ/CPF do cliente | CNPJ/CPF do cliente |
| Onde está a autorização | Portal de Serviços da RFB, serviço da NFS-e, em favor do CNPJ da WJB | o próprio certificado (titular = emitente) |
| Sem autorização válida | SEFIN rejeita com **E0718** | SEFIN rejeita com **E0718** |
| Revogação | o cliente revoga na RFB, a qualquer momento | o cliente revoga ou não renova o certificado |
| Custo operacional | baixo: um certificado e um cofre | alto: um certificado por cliente, renovação e custódia de cada um |

**Recomendação:** modelo A como padrão (menos certificados sob custódia, menos risco e menos custo), modelo B só quando o cliente não puder conceder procuração. Os dois estão implementados em `src/lib/wjb-ai/fiscal/emitter-authorization.ts`; o sistema tenta A e depois B, e devolve todos os bloqueios quando nenhum serve.

### Regras que o sistema aplica antes de qualquer envio
- Procuração: ativa, não revogada, dentro da validade, escopo citando NFS-e e registrada para o **mesmo CNPJ** do certificado da WJB (senão a SEFIN daria E0718).
- Certificado: ICP-Brasil v3, Assinatura Digital + Não Recusa, Autenticação de Cliente, não é de AC, dentro da validade, não revogado e com referência ao cofre `vault://...`. Aviso a 30 dias do vencimento.
- Modelo B: titular do certificado igual ao emitente.
- O sistema **não consegue ver** a procuração na RFB. Por isso o registro guarda evidência e validade, e a conferência real acontece na SEFIN: um E0718 vira rejeição registrada e bloqueio da empresa até revisão.

### Acesso, revogação e auditoria
| Ação | Quem | Como fica registrado |
| --- | --- | --- |
| Registrar autorização (A ou B) | Contador ou super admin (`fiscal.profile.manage`) | `audit_log` com tipo, modelo e validade (nunca dado do certificado) |
| Revogar autorização | Contador ou super admin | motivo obrigatório (mín. 10 caracteres), `revoked_at`/`revoked_by`; **definitiva** (trigger no banco); `audit_log` |
| Apagar autorização | **ninguém** | bloqueado no banco (0027) |
| Configurar série da DPS | contador com `fiscal_profile.approve` para a empresa, ou super admin | função `configure_dps_series` grava `audit_log` |
| Usar o certificado para assinar | só o processo de transmissão, nunca usuário ou IA | registro por pedido (a implementar com o cofre) |
| Cadastrar o certificado no cofre | super admin + titular presente | fora do sistema, no console do cofre, com MFA |

## 2. Onde guardar a chave privada

Requisito fixo: certificado, senha e chave privada **nunca** no Supabase, no GitHub, em logs, no navegador, no n8n ou em modelo de IA. O banco guarda só a referência e metadados públicos (titular, validade, impressão digital SHA-256). A 0027 recusa no próprio banco uma referência fora do formato `vault://...` e evidências que contenham PEM, chave ou senha; o servidor recusa antes, com mensagem clara (`secret-guard.ts`).

### Comparação

| Opção | Chave sai do cofre? | Assinatura XML | mTLS | Algoritmos | Custo de referência* | Esforço |
| --- | --- | --- | --- | --- | --- | --- |
| **1. Gerenciador de segredos** (AWS Secrets Manager, Google Secret Manager, Azure Key Vault secret) guardando o PFX cifrado | sim, em memória do processo de transmissão | local (biblioteca XMLDSig) | nativo (Node `tls` com PFX) | qualquer um (SHA-1 ou SHA-256) | ≈ US$ 0,40 a 1/mês por segredo + centavos por mil leituras | baixo |
| **2. KMS de nuvem com chave importada** (AWS KMS, Google Cloud KMS, Azure Key Vault Premium) | não | via API de assinatura do KMS (assina o digest) | **difícil**: o handshake TLS precisa da chave; exige provider/engine que delegue ao KMS | **AWS KMS não assina SHA-1** (só SHA-256/384/512); conferir nos outros | ≈ US$ 1 a 5/mês por chave + centavos por mil assinaturas | alto |
| **3. HSM dedicado em nuvem** (AWS CloudHSM, Azure Managed HSM) | não | PKCS#11 | PKCS#11 (viável) | amplo | ≈ US$ 1.100 a 2.300/mês por HSM (alta disponibilidade exige 2) | alto |
| **4. Certificado em nuvem ICP-Brasil** (A3 remoto em PSC credenciado pelo ITI) | não (fica no HSM do PSC) | API do PSC (assina o hash) | **normalmente não suportado**: conferir com o PSC se permite autenticação TLS de cliente | definido pelo PSC | ≈ R$ 200 a 500/ano por certificado + possível cobrança por assinatura | médio, por PSC |

\* Preços de lista de referência para comparação, **não cotados**. Confirmar na contratação, que depende de aprovação da WJB.

**Ponto que decide:** a SEFIN exige **mTLS com o mesmo tipo de certificado** que assina, ou outro do procurador. Opções em que a chave nunca sai do cofre (2, 3 e 4) assinam bem, mas complicam ou impedem o mTLS. E, se a SEFIN exigir SHA-1, a opção 2 na AWS fica de fora. Por isso a escolha final depende de confirmar o algoritmo com o swagger/manual.

### Recomendação
1. **Homologação (produção restrita):** modelo A com e-CNPJ **A1** da WJB guardado na **opção 1**, num cofre exclusivo de homologação, lido só por um processo de transmissão isolado (fora do runtime web da Hostinger, conforme doc 16), com papel IAM que só lê aquele segredo, MFA no console e auditoria do provedor ligada. Custo do cofre na casa de poucos dólares por mês.
2. **Produção:** reavaliar depois do primeiro teste. Se a SEFIN aceitar SHA-256 e o volume justificar, migrar para a opção 2 (assinatura sem a chave sair do cofre) mantendo o mTLS com um certificado dedicado à conexão; ou para a opção 3 se a WJB quiser chave não exportável também no mTLS.
3. A opção 4 só serve se o PSC confirmar por escrito o suporte a autenticação TLS de cliente.

### Requisitos operacionais (qualquer opção)
- Cofres e chaves separados para homologação e produção.
- Alerta de vencimento a 30 e 7 dias (o sistema já mostra o aviso a 30 dias no checklist).
- Rotação: cadastrar o novo certificado antes de revogar o antigo.
- Revogação imediata: tirar o segredo do cofre e revogar a autorização no sistema (pedidos daquela empresa ficam bloqueados).
- Liberar no firewall do processo de transmissão o acesso às LCR das ACs (FAQ 17.3, erro E1206/E107).
- Nenhum log de corpo de requisição, XML assinado ou dados do certificado.

## 3. Custos previstos (referência, nada contratado)

| Item | Faixa de referência | Observação |
| --- | --- | --- |
| e-CNPJ A1 da WJB | ≈ R$ 150 a 300 por ano | um certificado para o modelo A; validação presencial ou por videoconferência na AC |
| e-CNPJ A3 (token/cartão) | ≈ R$ 300 a 600 por 1 a 3 anos | não recomendado para servidor (exige leitor físico) |
| Certificado por cliente (modelo B) | ≈ R$ 150 a 300 por cliente por ano | custo do cliente, em geral |
| Cofre opção 1 | ≈ US$ 1 a 5 por mês | por ambiente |
| Cofre opção 2 | ≈ US$ 5 a 20 por mês | com o volume atual |
| Cofre opção 3 | ≈ US$ 1.100 a 4.600 por mês | só se a WJB exigir HSM dedicado |
| Processo de transmissão 24h | ver doc 16 | separado do site |
| Supabase de homologação | ≈ US$ 10 por mês | já aprovado e em uso |

## 4. O que já está no código e o que falta

**Pronto (simulado):** modelos A e B, requisitos do certificado, procuração válida, vencida e revogada, metadados no banco, referência ao cofre com forma fixa, revogação definitiva, checklist na tela de Perfis fiscais, assinador simulado e contrato `DpsSigner`.

**Falta (bloqueado de propósito):** `createIcpBrasilSigner()` e `createMtlsSefinTransport()` lançam erro até existirem: cofre contratado, certificado legítimo, algoritmo confirmado e autorização expressa da WJB. Metadados do certificado da WJB entram por `WJB_AI_WJB_CERTIFICATE_METADATA` (JSON sem segredo); com o cofre, passam a ser lidos do próprio certificado.
