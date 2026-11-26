# Fase 10B - Checklist de ativação

Cada bloco é um **portão**: só se avança com todos os itens marcados **e** autorização específica da WJB. Publicar código não liga nada (doc 51).

## Portão 0 - Produção saudável (pré-requisito de tudo que toca o banco)
- [ ] Estado do banco confirmado no painel ou pelo suporte (doc `FASE-10B-PLANO-RECUPERACAO-PRODUCAO`).
- [ ] Backup diário/PITR ativo **e testado** por restauração num projeto separado.
- [ ] Conta da CEO com login e MFA funcionando.
- [ ] Decisão documentada sobre recuperação ou reconstrução.

## Portão 1 - Hotfix de segurança do Next.js (etapa A)
- [x] Branch `hotfix/next-16.4.6-security` (`70d08787`): só `package.json`/lock, Next 16.4.6, testado (doc 53).
- [x] Compatibilidade com a Hostinger: Node 20/22/24; build com o compilador WebAssembly testado.
- [ ] **Autorização específica** do merge na `main` (que é o deploy).
- [ ] Após o deploy: log "Compiled successfully", site 200, formulário de contato enviando, `stderr.log` limpo. Rollback = reverter o commit.

## Portão 2 - Certificado novo
- [ ] Certificado exposto **revogado** na AC (protocolo guardado).
- [ ] Novo **e-CNPJ da WJB** emitido depois de 26/11/2026 (a política recusa os anteriores).
- [ ] Senha nova entregue por canal separado; cópias antigas apagadas.
- [ ] Impressão digital do certificado revogado na lista de comprometidos (opcional, recomendado).

## Portão 3 - Cofre de certificados
- [ ] Serviço escolhido e **contratado com aprovação** (custos no doc 26). Precisa assinar RSA-SHA1 se a documentação vigente confirmar esse algoritmo (o AWS KMS não assina).
- [ ] `createCertificateVault()` implementado devolvendo `kind: "gerenciador-de-segredos"`.
- [ ] Raízes ICP-Brasil do ITI conferidas por SHA-256 e versionadas (`createIcpBrasilTrustStore`, `kind: "icp-brasil"`).
- [ ] Verificação LCR/OCSP (`createRevocationChecker`, `kind: "lcr-ocsp"`).
- [ ] MFA e acesso mínimo no cofre, na Hostinger e no Supabase.

## Portão 4 - Leitura oficial autenticada (somente leitura)
- [ ] Portões 2 e 3 concluídos.
- [ ] Autorização expressa de leitura + `WJB_AI_SEFIN_READ_AUTHORIZED=true` só onde autorizado.
- [ ] Swagger lido; `SEFIN_API_CONTRACT` sem campos "inferido" ou "pendente"; testes de contrato reescritos.
- [ ] Algoritmo de assinatura confirmado em fonte vigente (`SIGNATURE_ALGORITHM_PENDING.confirmed = true`, com a fonte registrada).

## Portão 5 - Homologação oficial (produção restrita, sem valor fiscal)
- [ ] Portões 0 a 4 concluídos.
- [ ] Procuração eletrônica real na RFB (modelo A) ou certificado do cliente (B), registrada com evidência.
- [ ] Perfil fiscal aprovado por contador com a permissão `fiscal_profile.approve` (com MFA).
- [ ] `indDest=0` confirmado pelo contador (doc `FASE-10B-API-NFSE-PENDENCIAS`, seção 2).
- [ ] Migrations 0024-0029 (+0035) aplicadas em produção em lotes, com backup testado antes de cada lote (doc 51, etapa D).
- [ ] `WJB_AI_OFFICIAL_TRANSMISSION_ENABLED=true` só depois de tudo acima. O portão confere cada condição de novo e audita.
- [ ] Primeiro envio acompanhado por pessoa da WJB; conferência no portal nacional.

## Portão 6 - Produção fiscal
- [ ] Homologação oficial aprovada pela WJB.
- [ ] `isFiscalProductionAllowed()` deixa de ser sempre falso, por mudança de código revisada e aprovada.
- [ ] Jurídico: termos, privacidade da emissão, responsabilidade, representação fiscal.
- [ ] Operação: quem revisa, prazo de revisão, plantão para a fila de erros, plano de contingência.

## Portão 7 - Pagamentos (Stripe)
- [ ] Chaves **de teste** gravadas por `node scripts/wjb-ai/stripe/configurar-chaves.mjs` (área de transferência, arquivo 600). Live é recusado.
- [ ] `bash scripts/wjb-ai/stripe/sandbox.sh` executado com sucesso (Checkout, renovação por Test Clock, falha de cartão, cancelamento, webhook assinado).
- [ ] URL pública de homologação para o webhook.
- [ ] Contratos, tributação da cobrança e conta Stripe ativa antes de qualquer live (migration própria; hoje o banco recusa).

## Portão 8 - IA externa e WhatsApp
- [ ] IA externa: revisão LGPD, contrato com o fornecedor, avaliação de risco (doc 28). Até lá, só regras determinísticas.
- [ ] WhatsApp: só Click-to-Chat no número oficial. Cloud API exige decisão e contratação próprias.
