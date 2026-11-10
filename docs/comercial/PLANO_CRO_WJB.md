# Plano de CRO - WJB Assessoria Contábil

**Fase 1 do plano comercial** · 09/11/2026

## Decisões da WJB (09/11/2026)
- Cantos de **6 px** (regra do projeto mantida).
- Título da Home: **"Contabilidade especializada para sua empresa crescer com segurança."**
- Depoimentos atuais **mantidos** como estão (com o aviso discreto de que são ilustrativos).
- Funil de leads em **7 etapas** (migration `0023_lead_pipeline.sql`, rodada no SQL Editor).
- **CRC não aparece** no site.
- Fotos da equipe e IDs de GTM/GA4 ficam para o final.
- **Todos os serviços do catálogo são oferecidos.**
- Horário: **segunda a sexta, das 9h às 18h**.

## Jornada
Busca ou anúncio -> página do serviço -> botão principal leva ao formulário da própria página (ou WhatsApp com mensagem do serviço) -> lead gravado com serviço e origem -> atendimento -> proposta -> contrato.

## CTAs
| Lugar | Principal | Secundário |
|---|---|---|
| Home (Hero) | Solicitar proposta (`/solicitar-proposta`) | Falar com um contador (WhatsApp) + link "Conhecer nossos serviços" |
| Cabeçalho | Solicitar proposta | Falar com contador |
| Página de serviço | Texto específico do serviço, leva ao formulário (`#formulario`) | Falar pelo WhatsApp (mensagem do serviço) |
| Área do Cliente | Link discreto "Já sou cliente", sem competir com os CTAs de aquisição | - |

## Formulário
- Obrigatórios: nome, e-mail, WhatsApp, serviço (preenchido e escondido nas páginas de serviço) e consentimento LGPD.
- Opcionais: empresa, CNPJ, mensagem. Cidade, estado e atividade só em `/contato`.
- Mensagem deixou de ser obrigatória.
- Proteções: campo-armadilha contra robôs, identificador de envio contra duplicidade, limite de 5 envios por minuto por IP.

## Conversões (definição)
| Conversão | Quando conta | Observação |
|---|---|---|
| Lead | Servidor confirma a gravação (`persisted: true`) | Única conversão de "lead" válida para campanhas |
| Clique no WhatsApp | Clique no botão | Interação, **não** é lead |
| Lead qualificado / contratado | Mudança de etapa no Admin | Depende de envio pelo servidor ou importação offline (Fase 6) |
