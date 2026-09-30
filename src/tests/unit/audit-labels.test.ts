import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { auditActionLabels } from "@/lib/audit-labels";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "tests" ? [] : sourceFiles(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

/** Toda string com cara de ação de auditoria ("entidade.acao") perto de `action:`. */
function recordedActions(): Set<string> {
  const found = new Set<string>();
  for (const file of sourceFiles(path.join(process.cwd(), "src"))) {
    const text = readFileSync(file, "utf8");
    if (!text.includes("audit_log")) continue;
    for (const match of text.matchAll(/action:\s*([^,}]+)/g)) {
      for (const literal of match[1].matchAll(/"([a-z_]+\.[a-z_]+)"/g)) found.add(literal[1]);
    }
  }
  return found;
}

describe("rótulos de auditoria", () => {
  it("toda ação gravada em audit_log tem rótulo em português", () => {
    const missing = [...recordedActions()].filter((action) => !(action in auditActionLabels));
    expect(missing).toEqual([]);
  });

  it("encontra as ações de chamados e mensagens (garante que a varredura funciona)", () => {
    const actions = recordedActions();
    expect(actions.has("ticket.created")).toBe(true);
    expect(actions.has("message.sent")).toBe(true);
    expect(actions.has("integration.omie_disabled")).toBe(true);
  });
});
