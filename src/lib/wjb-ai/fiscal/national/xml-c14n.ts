/**
 * Canonical XML 1.0 inclusivo, sem comentários
 * (http://www.w3.org/TR/2001/REC-xml-c14n-20010315), o algoritmo exigido
 * pelo Sistema Nacional NFS-e (Manual Integrado v1.00.02, item 6.1.4).
 *
 * Escopo deliberadamente restrito ao XML que o Sistema Nacional aceita:
 * - só namespace PADRÃO (prefixos são proibidos: E1228); prefixo = erro;
 * - sem DTD, sem CDATA, sem instruções de processamento além da declaração;
 * - só as 5 entidades predefinidas e referências numéricas.
 * Validado nos testes contra o `xmllint --c14n` (libxml2), byte a byte.
 */
export interface XmlElement {
  type: "element";
  name: string;
  attrs: [string, string][]; // ordem do documento; inclui xmlns
  children: XmlNode[];
  parent: XmlElement | null;
}
export interface XmlText {
  type: "text";
  value: string;
}
export type XmlNode = XmlElement | XmlText;

export class XmlSubsetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "XmlSubsetError";
  }
}

function decodeEntities(s: string): string {
  return s.replace(
    /&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g,
    (_, e: string) => {
      if (e === "amp") return "&";
      if (e === "lt") return "<";
      if (e === "gt") return ">";
      if (e === "quot") return '"';
      if (e === "apos") return "'";
      const code = e.startsWith("#x")
        ? parseInt(e.slice(2), 16)
        : parseInt(e.slice(1), 10);
      return String.fromCodePoint(code);
    },
  );
}

/** Parser mínimo do subconjunto acima. Devolve o elemento raiz. */
export function parseXml(xml: string): XmlElement {
  let i = 0;
  const src = xml.replace(/^﻿/, "");
  const root: { children: XmlNode[] } = { children: [] };
  const stack: XmlElement[] = [];
  const top = () => stack[stack.length - 1];
  let rootEl: XmlElement | null = null;

  while (i < src.length) {
    if (src.startsWith("<?", i)) {
      const end = src.indexOf("?>", i);
      const pi = src.slice(i, end + 2);
      if (!/^<\?xml\s/.test(pi) || i !== 0)
        throw new XmlSubsetError("Instrução de processamento não suportada.");
      i = end + 2;
      continue;
    }
    if (
      src.startsWith("<!--", i) ||
      src.startsWith("<![CDATA[", i) ||
      src.startsWith("<!", i)
    )
      throw new XmlSubsetError("Comentário, CDATA ou DTD não suportados.");
    if (src.startsWith("</", i)) {
      const end = src.indexOf(">", i);
      const name = src.slice(i + 2, end).trim();
      const el = stack.pop();
      if (!el || el.name !== name)
        throw new XmlSubsetError(`Fechamento inesperado </${name}>.`);
      i = end + 1;
      continue;
    }
    if (src[i] === "<") {
      const end = src.indexOf(">", i);
      if (end < 0) throw new XmlSubsetError("Tag sem fechamento.");
      let body = src.slice(i + 1, end);
      const selfClosing = body.endsWith("/");
      if (selfClosing) body = body.slice(0, -1);
      const m = body.match(/^([A-Za-z_][\w.:-]*)/);
      if (!m) throw new XmlSubsetError("Nome de elemento inválido.");
      const name = m[1];
      if (name.includes(":"))
        throw new XmlSubsetError("Prefixo de namespace não permitido.");
      const attrs: [string, string][] = [];
      const re = /\s+([A-Za-z_:][\w.:-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
      let rest = body.slice(name.length);
      let am: RegExpExecArray | null;
      let consumed = 0;
      while ((am = re.exec(rest))) {
        if (am.index !== consumed)
          throw new XmlSubsetError("Atributo malformado.");
        const an = am[1];
        if (an.includes(":") && an !== "xmlns")
          throw new XmlSubsetError("Prefixo de namespace não permitido.");
        attrs.push([an, decodeEntities(am[3] ?? am[4] ?? "")]);
        consumed = re.lastIndex;
      }
      rest = rest.slice(consumed);
      if (rest.trim()) throw new XmlSubsetError("Atributo malformado.");
      const el: XmlElement = {
        type: "element",
        name,
        attrs,
        children: [],
        parent: top() ?? null,
      };
      if (top()) top().children.push(el);
      else if (rootEl) throw new XmlSubsetError("Mais de um elemento raiz.");
      else {
        rootEl = el;
        root.children.push(el);
      }
      if (!selfClosing) stack.push(el);
      i = end + 1;
      continue;
    }
    const next = src.indexOf("<", i);
    const text = src.slice(i, next < 0 ? src.length : next);
    if (top())
      top().children.push({ type: "text", value: decodeEntities(text) });
    else if (text.trim())
      throw new XmlSubsetError("Texto fora do elemento raiz.");
    i = next < 0 ? src.length : next;
  }
  if (stack.length || !rootEl) throw new XmlSubsetError("XML incompleto.");
  return rootEl;
}

/** Namespace padrão em escopo no elemento (declarado nele ou herdado). */
export function defaultNamespace(el: XmlElement): string {
  for (let e: XmlElement | null = el; e; e = e.parent) {
    const ns = e.attrs.find(([k]) => k === "xmlns");
    if (ns) return ns[1];
  }
  return "";
}

const escText = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\r/g, "&#xD;");
const escAttr = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/\t/g, "&#x9;")
    .replace(/\n/g, "&#xA;")
    .replace(/\r/g, "&#xD;");

/**
 * Forma canônica do subárvore `el` (conjunto de nós do documento: o
 * elemento e seus descendentes). `exclude` permite a transformação
 * enveloped-signature (remove o `Signature` descendente).
 */
export function canonicalize(
  el: XmlElement,
  exclude: (e: XmlElement) => boolean = () => false,
): string {
  const out: string[] = [];
  const walk = (e: XmlElement, renderedNs: string | null) => {
    const ns = defaultNamespace(e);
    const attrs = e.attrs
      .filter(([k]) => k !== "xmlns")
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    let open = `<${e.name}`;
    // Declaração do namespace padrão só quando difere do que já foi emitido
    // pelo ancestral no conjunto de saída (regra de C14N para o eixo de namespace).
    if (ns !== (renderedNs ?? ""))
      open += ns ? ` xmlns="${escAttr(ns)}"` : ` xmlns=""`;
    for (const [k, v] of attrs) open += ` ${k}="${escAttr(v)}"`;
    out.push(open + ">");
    for (const c of e.children) {
      if (c.type === "text") out.push(escText(c.value));
      else if (!exclude(c)) walk(c, ns);
    }
    out.push(`</${e.name}>`);
  };
  walk(el, null);
  return out.join("");
}

export function findById(root: XmlElement, id: string): XmlElement | null {
  const stack: XmlElement[] = [root];
  while (stack.length) {
    const e = stack.pop()!;
    if (e.attrs.some(([k, v]) => k === "Id" && v === id)) return e;
    for (const c of e.children) if (c.type === "element") stack.push(c);
  }
  return null;
}

export function childElements(el: XmlElement, name?: string): XmlElement[] {
  return el.children.filter(
    (c): c is XmlElement => c.type === "element" && (!name || c.name === name),
  );
}

export function textOf(el: XmlElement): string {
  return el.children
    .map((c) => (c.type === "text" ? c.value : textOf(c)))
    .join("");
}
