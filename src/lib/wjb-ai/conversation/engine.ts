import { ruleBasedExtract } from "@/lib/wjb-ai/agents/runtime";
import {
  detectDocument,
  normalizeDocument,
} from "@/lib/wjb-ai/fiscal/documents";
import { parseNfseDraft } from "@/lib/wjb-ai/fiscal/draft";
import { maskDocument } from "@/lib/wjb-ai/fiscal/mask";

/**
 * Motor de conversa por REGRAS (Fase 7), preparação do agente de Atendimento.
 * Sem modelo de IA. Coleta os dados aos poucos, pergunta um de cada vez,
 * confirma e só então devolve `ready` para o canal criar o pedido pelo MESMO
 * caminho validado do formulário (que confere sessão, empresa e regras).
 *
 * Nunca escolhe ou sugere código de serviço, CNAE, alíquota, tributação ou
 * regime: esses pedidos vão para o contador.
 */
export type Field =
  | "serviceDescription"
  | "grossAmount"
  | "competence"
  | "takerDocument"
  | "takerName";
export type Stage =
  "inicio" | "coletando" | "confirmando" | "pronto" | "encaminhado";

export interface ConversationState {
  stage: Stage;
  asking: Field | null;
  values: Record<Field, string> & { takerEmail: string };
  turns: number;
}

export interface Turn {
  state: ConversationState;
  reply: string;
  quickReplies: string[];
  /** Pronto para criar o pedido (só depois de confirmação explícita). */
  ready: boolean;
  /** Encaminhar ao contador (pedido fora do que o assistente faz). */
  handoff: boolean;
}

export const MAX_TURNS = 40;

export function initialState(): ConversationState {
  return {
    stage: "inicio",
    asking: null,
    values: {
      serviceDescription: "",
      grossAmount: "",
      competence: "",
      takerDocument: "",
      takerName: "",
      takerEmail: "",
    },
    turns: 0,
  };
}

const ORDER: Field[] = [
  "serviceDescription",
  "grossAmount",
  "competence",
  "takerDocument",
  "takerName",
];
const QUESTIONS: Record<Field, string> = {
  serviceDescription:
    "Qual serviço você prestou? (ex.: corte e escova, consultoria de marketing)",
  grossAmount: "Qual o valor do serviço em reais? (ex.: 250,00)",
  competence: "Em que mês o serviço foi prestado? (ex.: 11/2026)",
  takerDocument: "Qual o CPF ou CNPJ de quem contratou o serviço?",
  takerName: "Qual o nome ou a razão social de quem contratou?",
};

const OUT_OF_SCOPE =
  /\b(cancel\w*|substitu\w*|nfc-?e|nf-?e(?!s)\b|mercadoria|produto|al[ií]quota|c[oó]digo\s+(de\s+)?(servi[cç]o|tributa)|cnae|regime|iss\s+(retido|de\s+quanto)|quanto\s+(de\s+)?imposto)/i;
const INTENT = /\b(nota|nfs-?e|emitir|solicitar|pedir)\b/i;
const YES = /^\s*(sim|s|confirmo|confirmar|pode|ok|isso)\b/i;
const NO = /^\s*(n[aã]o|corrigir|alterar|mudar|errado)\b/i;

function parseAmount(text: string): string {
  const m = text.match(/(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?/);
  if (!m) return "";
  const intPart = m[1].replace(/\./g, "");
  const cents = (m[2] ?? "").padEnd(2, "0");
  return `${intPart}.${cents || "00"}`;
}
function parseCompetence(text: string): string {
  const a = text.match(/\b(0?[1-9]|1[0-2])\s*[/\-]\s*(20\d{2})\b/);
  if (a) return `${a[2]}-${a[1].padStart(2, "0")}`;
  const b = text.match(/\b(20\d{2})-(0[1-9]|1[0-2])\b/);
  return b ? `${b[1]}-${b[2]}` : "";
}

function fill(values: ConversationState["values"], field: Field, text: string) {
  const t = text.trim();
  if (field === "grossAmount") values.grossAmount = parseAmount(t);
  else if (field === "competence") values.competence = parseCompetence(t);
  else if (field === "takerDocument") {
    // Dígito verificador conferido já na resposta (o validador do formulário
    // só olha depois que todos os campos obrigatórios existem).
    const d = normalizeDocument(t);
    values.takerDocument = detectDocument(d) !== null ? d : "";
  } else if (field === "takerName")
    values.takerName = t.replace(/\s+(CPF|CNPJ)\b.*$/iu, "").slice(0, 150);
  else values.serviceDescription = t.slice(0, 500);
}

function toDraftInput(v: ConversationState["values"]) {
  return {
    serviceDescription: v.serviceDescription,
    grossAmount: v.grossAmount,
    competence: v.competence,
    taker: {
      document: v.takerDocument,
      name: v.takerName,
      email: v.takerEmail || undefined,
    },
  };
}

/** Campos ainda inválidos segundo o MESMO validador do formulário. */
export function invalidFields(v: ConversationState["values"]): Field[] {
  const parsed = parseNfseDraft(toDraftInput(v));
  if (parsed.ok) return [];
  const map: Record<string, Field> = {
    serviceDescription: "serviceDescription",
    grossAmount: "grossAmount",
    competence: "competence",
    "taker.document": "takerDocument",
    "taker.name": "takerName",
  };
  const bad = new Set(
    parsed.missingOrInvalid.map((m) => map[m.field]).filter(Boolean),
  );
  return ORDER.filter((f) => bad.has(f));
}

export function summary(v: ConversationState["values"]): string {
  const amount = Number(v.grossAmount).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  return `Serviço: ${v.serviceDescription}\nValor: ${amount}\nCompetência: ${v.competence}\nTomador: ${v.takerName} (${maskDocument(v.takerDocument)})`;
}

export function nextTurn(prev: ConversationState, message: string): Turn {
  const state: ConversationState = {
    ...prev,
    values: { ...prev.values },
    turns: prev.turns + 1,
  };
  const text = message.slice(0, 1000);
  const out = (reply: string, extra: Partial<Turn> = {}): Turn => ({
    state,
    reply,
    quickReplies: [],
    ready: false,
    handoff: false,
    ...extra,
  });

  if (state.turns > MAX_TURNS) {
    state.stage = "encaminhado";
    return out(
      "A conversa ficou longa. Vou deixar com a equipe da WJB, que retoma com você.",
      { handoff: true },
    );
  }
  if (OUT_OF_SCOPE.test(text)) {
    state.stage = "encaminhado";
    return out(
      "Isso eu não decido: códigos, alíquotas, regime, cancelamentos e notas de produto são com o contador da WJB. Vou encaminhar o seu pedido para a equipe.",
      { handoff: true },
    );
  }

  if (state.stage === "confirmando") {
    if (YES.test(text)) {
      state.stage = "pronto";
      return out(
        "Perfeito. Vou registrar a solicitação agora. Nenhuma nota é emitida nesta fase: é uma simulação revisada pela WJB.",
        { ready: true },
      );
    }
    if (NO.test(text)) {
      const which = ORDER.find((f) =>
        ({
          serviceDescription: /servi/i,
          grossAmount: /valor/i,
          competence: /m[eê]s|compet/i,
          takerDocument: /cpf|cnpj|document/i,
          takerName: /nome|raz[aã]o|tomador/i,
        })[f].test(text),
      );
      const f = which ?? "serviceDescription";
      state.values[f] = "";
      state.stage = "coletando";
      state.asking = f;
      return out(`Certo, vamos corrigir. ${QUESTIONS[f]}`);
    }
    return out(
      "Está tudo certo? Responda sim para registrar ou diga o que quer corrigir (serviço, valor, mês, CPF/CNPJ ou nome).",
      {
        quickReplies: [
          "Sim, pode registrar",
          "Corrigir o valor",
          "Corrigir o tomador",
        ],
      },
    );
  }

  if (state.stage === "inicio") {
    const extracted = ruleBasedExtract(text).draft;
    const anyField =
      extracted.serviceDescription ||
      extracted.grossAmount ||
      extracted.taker.document;
    if (!INTENT.test(text) && !anyField) {
      return out(
        "Posso ajudar você a pedir uma NFS-e de serviço. Quer começar?",
        { quickReplies: ["Quero pedir uma nota"] },
      );
    }
    state.stage = "coletando";
    if (extracted.serviceDescription)
      state.values.serviceDescription = extracted.serviceDescription;
    if (extracted.grossAmount) state.values.grossAmount = extracted.grossAmount;
    if (extracted.competence) state.values.competence = extracted.competence;
    if (extracted.taker.document)
      state.values.takerDocument = extracted.taker.document;
    if (extracted.taker.name) state.values.takerName = extracted.taker.name;
  } else if (state.asking) {
    fill(state.values, state.asking, text);
  }

  const missing = invalidFields(state.values);
  if (missing.length) {
    const f = missing[0];
    const repeated = prev.asking === f && prev.stage === "coletando";
    state.asking = f;
    return out(
      repeated ? `Não consegui entender. ${QUESTIONS[f]}` : QUESTIONS[f],
    );
  }
  state.stage = "confirmando";
  state.asking = null;
  return out(
    `Confira os dados:\n${summary(state.values)}\n\nPosso registrar a solicitação?`,
    {
      quickReplies: [
        "Sim, pode registrar",
        "Corrigir o valor",
        "Corrigir o tomador",
      ],
    },
  );
}

/** Valida um estado vindo do navegador (nunca confiar no cliente). */
export function sanitizeState(raw: unknown): ConversationState {
  const base = initialState();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<ConversationState>;
  const stages: Stage[] = [
    "inicio",
    "coletando",
    "confirmando",
    "pronto",
    "encaminhado",
  ];
  const v = (r.values ?? {}) as Partial<ConversationState["values"]>;
  const str = (x: unknown, max: number) =>
    typeof x === "string" ? x.slice(0, max) : "";
  return {
    stage: stages.includes(r.stage as Stage) ? (r.stage as Stage) : "inicio",
    asking: ORDER.includes(r.asking as Field) ? (r.asking as Field) : null,
    turns:
      typeof r.turns === "number" && r.turns >= 0
        ? Math.min(r.turns, MAX_TURNS + 1)
        : 0,
    values: {
      serviceDescription: str(v.serviceDescription, 500),
      grossAmount: str(v.grossAmount, 20),
      competence: str(v.competence, 7),
      takerDocument: str(v.takerDocument, 14).replace(/\D/g, ""),
      takerName: str(v.takerName, 150),
      takerEmail: str(v.takerEmail, 254),
    },
  };
}
