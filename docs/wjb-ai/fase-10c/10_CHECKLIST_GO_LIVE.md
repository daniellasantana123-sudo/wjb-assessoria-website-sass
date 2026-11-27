# Fase 10C - Checklist de go-live

Cada bloco é um portão. Só se avança com **todos** os itens marcados **e** autorização específica da WJB para aquele portão. Publicar código não liga nada: tudo da WJB AI depende de variáveis de ambiente lidas em runtime, hoje desligadas. Este checklist substitui o `FASE-10B-CHECKLIST-ATIVACAO.md`.

## Portão 0 - Banco de produção saudável (pré-requisito de tudo que toca o banco)
- [ ] Diagnóstico do doc 03 preenchido e anotado.
- [ ] Caminho de recuperação decidido (doc 04) e executado num projeto separado, se necessário.
- [ ] Backup diário ou PITR ativo **e testado** por restauração.
- [ ] Conta da CEO com login e MFA funcionando.
- [ ] Contas de teste com `super_admin` removidas.

## Portão 1 - Hotfix de segurança do Next.js (independe do banco)
- [x] `hotfix/next-16.4.6-security` (`70d08787`): só `package.json` e o lock; Next 16.4.6 e zod 4.6.7.
- [x] Refeito do zero nesta fase: lint, TypeScript, 373/373 testes e build aprovados (doc 02).
- [x] 16.4.6 é a última estável e não tem advisory publicado contra ela; corrige advisories **críticos** da 16.3.7.
- [x] Compatível com Node 20, 22 e 24 da Hostinger.
- [ ] **Autorização específica** do merge na `main` (que é o deploy).
- [ ] Depois do deploy: "Compiled successfully", site 200, formulário de contato, login do Portal e `stderr.log` limpo. Rollback: doc 12.

## Portão 2 - Certificado novo
- [ ] Certificado exposto **revogado** na AC (protocolo guardado).
- [ ] Novo **e-CNPJ** emitido depois de 26/11/2026; senha por canal separado; cópias antigas apagadas.
- [ ] (Recomendado) impressão digital do certificado revogado bloqueada em `/admin/nfse/certificados` (doc 05, seção 5).

## Portão 3 - Cofre e verificação real
- [ ] Provedor do cofre escolhido e **contratado com aprovação** (doc 06).
- [ ] `createCertificateVault()` implementado (`kind: "gerenciador-de-segredos"`).
- [ ] Raízes ICP-Brasil do ITI conferidas por SHA-256 e versionadas (`createIcpBrasilTrustStore`).
- [ ] LCR/OCSP (`createRevocationChecker`).
- [ ] Novo e-CNPJ importado **direto no cofre**, cadastrado como pendente e girado para ativo por um super admin com MFA.

## Portão 4 - Leitura oficial autenticada (somente leitura)
- [ ] Portões 2 e 3 concluídos.
- [ ] Autorização expressa de leitura e `WJB_AI_SEFIN_READ_AUTHORIZED=true` só onde autorizado.
- [ ] Swagger lido; `SEFIN_API_CONTRACT` sem campos inferidos ou pendentes (incluindo `eventPath` e `requestEventField`).
- [ ] Algoritmo de assinatura confirmado em fonte vigente.

## Portão 5 - Homologação oficial (produção restrita, sem valor fiscal)
- [ ] Portões 0 a 4 concluídos.
- [ ] `indDest` validado pelo contador (doc 07, seção 2).
- [ ] Procuração eletrônica real na RFB (modelo A) ou certificado do cliente (modelo B).
- [ ] Perfil fiscal aprovado por contador com `fiscal_profile.approve` e MFA.
- [ ] Migrations 0024 a 0037 aplicadas na produção em lotes, com backup testado antes de cada lote.
- [ ] Agendamento da rota `/api/wjb-ai/cron/alertas` (avisos de vencimento), aprovado.
- [ ] `WJB_AI_OFFICIAL_TRANSMISSION_ENABLED=true` só depois de tudo acima; o portão confere cada condição de novo.
- [ ] Primeiro envio acompanhado por pessoa da WJB.

## Portão 6 - Produção fiscal
- [ ] Homologação oficial aprovada pela WJB.
- [ ] `isFiscalProductionAllowed()` deixa de ser sempre falso, por mudança de código revisada.
- [ ] Jurídico: termos, privacidade, responsabilidade e representação fiscal.
- [ ] Operação: quem revisa, prazos, plantão da fila de erros, contingência, fluxo de cancelamento e substituição com revisão.

## Portão 7 - Pagamentos (Stripe)
- [ ] Chaves **de teste** gravadas por `configurar-chaves.mjs`; `sandbox.sh` aprovado nos 11 cenários.
- [ ] URL pública de homologação para o webhook.
- [ ] Contrato, tributação da cobrança e conta ativa antes de qualquer live (migration própria; hoje o banco recusa live).
- [ ] Link: fora do escopo enquanto a Stripe não o suportar no Brasil (doc 08).

## Portão 8 - IA externa e WhatsApp
- [ ] IA externa: revisão LGPD, contrato e avaliação de risco. Até lá, só regras determinísticas.
- [ ] WhatsApp: só Click-to-Chat no número oficial.
