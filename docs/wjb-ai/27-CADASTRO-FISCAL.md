# 27 - Cadastro fiscal do cliente (proposta e implementação)

**Status:** implementado em homologação (Fase 5). Tela: `/admin/nfse/perfis` (só com o módulo WJB AI ligado).

## Princípios
- Quem define é o **contador**; quem aprova é o contador com a permissão `fiscal_profile.approve` para a empresa. A IA nunca preenche, sugere ou altera parâmetro fiscal.
- O cadastro fica em `fiscal_profiles.service_settings` (jsonb da 0024), **versionado e imutável depois de aprovado**: mudar = nova versão + nova aprovação.
- Schema estrito (`fiscalProfileSettingsSchema`): campo desconhecido ou fora do domínio oficial é recusado. Os domínios são os do XSD oficial v1.01.

## Campos

| Grupo | Campo | Domínio / regra | Fonte do domínio |
| --- | --- | --- | --- |
| Enquadramento | MEI, Simples (ME/EPP), Lucro Presumido, Lucro Real, Autônomo | lista fechada | decisão WJB |
| Emitente | tipo e CPF/CNPJ | igual ao documento da empresa | regra do sistema |
| | município emissor | IBGE 7 dígitos | `TSCodMunIBGE` |
| | habilitação confirmada em | data ou vazio (pendente) | conferência do contador |
| Serviço | `cTribNac` | 6 dígitos | `TSCodTribNac` |
| | `cNBS` | 9 dígitos, opcional | `TSCodNBS` |
| | local da prestação | IBGE 7 dígitos | `TCLocPrest` |
| Tributos | `tribISSQN` | 1 tributável, 2 imunidade, 3 exportação, 4 não incidência | `TSTribISSQN` |
| | `tpRetISSQN` | 1 não retido, 2 tomador, 3 intermediário | `TSTipoRetISSQN` |
| | `opSimpNac` | 1 não optante, 2 MEI, 3 ME/EPP | `TSOpSimpNac` |
| | `regEspTrib` | 0-6, 9 | `TSRegEspTrib` |
| | `indTotTrib` | fixo 0 | `TSTipoIndTotTrib` |
| IBS/CBS | decisão (não informar / informar) + justificativa | justificativa obrigatória | regra do sistema |
| Série | série da DPS | 1 a 49999 (canal API) | FAQ v1.4, 18.1 |

## Verificações (checklist de prontidão)

`evaluateFiscalReadiness()` devolve um item por verificação pedida pela WJB:

| Item | Bloqueia quando |
| --- | --- |
| Perfil aprovado | não há perfil aprovado vigente |
| Parâmetros completos | schema recusa (campo faltando, fora do domínio ou inventado) |
| Habilitação do emitente | data de confirmação vazia (pendente) ou emitente ≠ empresa |
| Autorização de emissão | nenhum modelo (A ou B) válido; lista os motivos |
| Certificado digital | inválido ou ausente; **atenção** se vence em até 30 dias |
| Código de serviço e local | (validados pelo schema) |
| ISSQN, retenção e regime | `opSimpNac` incoerente com o enquadramento (MEI = 2, Simples = 3, demais = 1); `tribISSQN` diferente de 1 (imunidade, exportação e não incidência exigem grupos da DPS ainda não implementados); autônomo sem CPF; **atenção** se o ISSQN é retido |
| IBS/CBS | decisão "informar" (grupo completo ainda não implementado) |
| Série da DPS | série não configurada no banco ou diferente da do perfil |

"Pronto" só significa cadastro completo. **Não autoriza transmissão:** cada pedido continua passando pela política, pela revisão do contador quando exigida e, para o governo, pela autorização específica da WJB.

## Fluxo na tela
1. Criar rascunho de perfil (limite por nota sem revisão).
2. "Preencher cadastro fiscal deste rascunho": formulário com os campos acima, com rótulos do XSD. Um erro mostra a mensagem em português e **não apaga** o que já foi preenchido.
3. Aprovar com justificativa (só quem tem `fiscal_profile.approve`).
4. Configurar a série da DPS (função `configure_dps_series`; produção bloqueada nesta fase).
5. Registrar a autorização (modelo A ou B) com metadados do certificado e referência ao cofre.
6. Acompanhar o checklist "Prontidão para emitir".

## Fora do escopo desta fase
Grupos de imunidade, exportação, não incidência, benefício municipal, deduções (`vDedRed`/`vAjusteBC`), intermediário, obra/evento e o grupo IBS/CBS completo. Todos dependem de decisão do contador e serão modelados um a um, com teste contra o XSD.
