import { describe, expect, it } from "vitest";

import { parseCalendarParams } from "@/lib/calendar-params";

const now = new Date(2026, 8, 30); // 30/09/2026

describe("parseCalendarParams", () => {
  it("sem parâmetro, usa o mês atual", () => {
    expect(parseCalendarParams({}, now)).toEqual({ year: 2026, month: 9 });
  });

  it("aceita ano e mês válidos", () => {
    expect(parseCalendarParams({ year: "2027", month: "1" }, now)).toEqual({ year: 2027, month: 1 });
  });

  it("mês fora de 1..12 cai no mês atual", () => {
    expect(parseCalendarParams({ month: "13" }, now).month).toBe(9);
    expect(parseCalendarParams({ month: "0" }, now).month).toBe(9);
  });

  it("texto e ano absurdo caem no padrão", () => {
    expect(parseCalendarParams({ year: "abc", month: "x" }, now)).toEqual({ year: 2026, month: 9 });
    expect(parseCalendarParams({ year: "99999" }, now).year).toBe(2026);
  });
});
