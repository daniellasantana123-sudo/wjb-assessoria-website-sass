import { afterEach, describe, expect, it } from "vitest";

import { getSupabaseEnv } from "@/lib/db/supabase/env";

/**
 * Bug real de produção (2026-09-23): as credenciais estavam corretas no
 * painel da Hostinger e mesmo assim o app respondia "sem banco". Causa: o
 * Next substitui `process.env.NEXT_PUBLIC_*` pelo valor durante o BUILD, e
 * esta hospedagem só injeta as variáveis no processo em execução - então o
 * código compilado carregava `undefined`. A leitura tem que acontecer em
 * tempo de execução, e aceitar também os nomes sem o prefixo (a forma
 * idiomática pra algo usado só no servidor).
 */
const KEYS = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

const original = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of KEYS) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
});

describe("getSupabaseEnv", () => {
  it("devolve undefined quando nada está configurado", () => {
    for (const key of KEYS) delete process.env[key];
    expect(getSupabaseEnv()).toEqual({ url: undefined, anonKey: undefined });
  });

  it("lê os nomes com prefixo NEXT_PUBLIC_ (config atual da produção)", () => {
    for (const key of KEYS) delete process.env[key];
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://exemplo.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "chave-publica";

    expect(getSupabaseEnv()).toEqual({
      url: "https://exemplo.supabase.co",
      anonKey: "chave-publica",
    });
  });

  it("prefere os nomes sem prefixo quando ambos existem", () => {
    process.env.SUPABASE_URL = "https://runtime.supabase.co";
    process.env.SUPABASE_ANON_KEY = "chave-runtime";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://build.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "chave-build";

    expect(getSupabaseEnv()).toEqual({
      url: "https://runtime.supabase.co",
      anonKey: "chave-runtime",
    });
  });

  /**
   * Valor vazio conta como ausente: um painel de hospedagem onde a variável
   * foi criada mas ficou em branco não pode fazer o app achar que tem banco.
   */
  it("ignora valor vazio e cai no próximo nome", () => {
    for (const key of KEYS) delete process.env[key];
    process.env.SUPABASE_URL = "";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://exemplo.supabase.co";

    expect(getSupabaseEnv().url).toBe("https://exemplo.supabase.co");
  });
});
