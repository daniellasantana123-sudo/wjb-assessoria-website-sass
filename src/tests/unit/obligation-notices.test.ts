import { describe, expect, it } from "vitest";

import { buildObligationNotice } from "@/lib/obligations/notices";
import { groupReminders, reminderDates } from "@/lib/obligations/reminders";

const das = { id: "o1", title: "DAS Simples Nacional", dueDate: "2026-10-20" };
const fgts = { id: "o2", title: "FGTS", dueDate: "2026-10-20" };
const inss = { id: "o3", title: "INSS", dueDate: "2026-10-20" };
const irrf = { id: "o4", title: "IRRF", dueDate: "2026-10-20" };

describe("buildObligationNotice", () => {
  it("uma obrigação: texto próprio e link para o detalhe", () => {
    expect(buildObligationNotice("created", [das])).toEqual({
      body: 'Nova obrigação: "DAS Simples Nacional", com vencimento em 20/10/2026.',
      link: "/portal/obrigacoes/o1",
    });
    expect(buildObligationNotice("completed", [das]).body).toBe(
      'A WJB concluiu a obrigação "DAS Simples Nacional".',
    );
    expect(buildObligationNotice("due_today", [das]).body).toBe('"DAS Simples Nacional" vence hoje.');
  });

  it("várias obrigações viram um aviso só, com link para a lista", () => {
    const notice = buildObligationNotice("completed", [das, fgts]);
    expect(notice.body).toBe('A WJB concluiu 2 obrigações: "DAS Simples Nacional" e "FGTS".');
    expect(notice.link).toBe("/portal/obrigacoes");
  });

  it("mais de 3 títulos resume o resto", () => {
    expect(buildObligationNotice("due_soon", [das, fgts, inss, irrf]).body).toBe(
      '4 obrigações vencem em 3 dias: "DAS Simples Nacional", "FGTS", "INSS" e mais 1.',
    );
  });
});

describe("lembretes de vencimento", () => {
  it("calcula hoje e daqui a 3 dias na data local, atravessando o mês", () => {
    expect(reminderDates(new Date(2026, 8, 29))).toEqual({ today: "2026-09-29", soon: "2026-10-02" });
  });

  it("agrupa por empresa e por tipo, ignorando outras datas", () => {
    const dates = { today: "2026-09-30", soon: "2026-10-03" };
    const groups = groupReminders(
      [
        { id: "a", tenant_id: "t1", title: "DAS", due_date: "2026-10-03" },
        { id: "b", tenant_id: "t1", title: "FGTS", due_date: "2026-10-03" },
        { id: "c", tenant_id: "t1", title: "INSS", due_date: "2026-09-30" },
        { id: "d", tenant_id: "t2", title: "DAS", due_date: "2026-10-03" },
        { id: "e", tenant_id: "t2", title: "Fora da janela", due_date: "2026-10-10" },
      ],
      dates,
    );
    expect(groups).toHaveLength(3);
    expect(groups.find((g) => g.tenantId === "t1" && g.kind === "due_soon")?.obligations).toHaveLength(2);
    expect(groups.find((g) => g.tenantId === "t1" && g.kind === "due_today")?.obligations).toHaveLength(1);
    expect(groups.some((g) => g.obligations.some((o) => o.title === "Fora da janela"))).toBe(false);
  });
});
