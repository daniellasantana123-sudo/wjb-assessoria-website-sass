import { describe, expect, it } from "vitest";

import { analyze, parseCsv } from "../../../scripts/wjb-ai/producao/analisar-auditoria.mjs";

/**
 * Fase 10E: critérios objetivos da auditoria do banco de produção. Os
 * resultados são SINTÉTICOS (só contagens); nenhum dado real.
 */
const saudavel: Record<string, string> = {
  "identificacao.sessao_somente_leitura": "on",
  "auth.usuarios": "3",
  "auth.usuarios_com_mfa_verificado": "1",
  "linhas.profiles": "3",
  "linhas.tenants": "2",
  "linhas.obligations": "6",
  "equipe.perfis_equipe": "1",
  "equipe.super_admin": "1",
  "equipe.super_admin_sem_mfa": "0",
  "equipe.equipe_com_email_de_teste": "0",
  "schema.tabelas": "13",
  "schema.security_definer_sem_search_path": "nenhuma",
  "schema.indices_invalidos": "0",
  "rls.tabelas_sem_rls": "nenhuma",
  "rls.politicas_using_true_para_anon_ou_public": "nenhuma",
  "rls.guarda_de_colunas_privilegiadas_0022": "true",
  "rls.funcoes_de_acesso": "is_staff, is_super_admin, is_tenant_owner, my_tenant_ids",
  "migrations.m0016_status_da_conta": "true",
  "migrations.m0017_vinculo_gclick": "true",
  "migrations.m0020_obrigacoes_externas": "true",
  "migrations.m0022_guarda_de_perfil": "true",
  "migrations.m0023_funil_de_leads": "true",
  "migrations.tabelas_wjb_ai_ou_comercial_NAO_deveriam_existir": "0",
  "storage.buckets": "documents(privado)",
};
for (const k of ["perfis_sem_usuario_auth", "usuarios_auth_sem_perfil", "emails_duplicados_em_perfis", "cnpj_duplicado", "vinculos_sem_empresa", "vinculos_sem_pessoa", "obrigacoes_sem_empresa", "documentos_sem_empresa", "documentos_sem_arquivo_no_storage", "chamados_sem_empresa", "notificacoes_sem_destinatario", "vinculos_gclick_sem_empresa"])
  saudavel[`integridade.${k}`] = "0";
const rows = (over: Record<string, string> = {}, omit: string[] = []) =>
  Object.entries({ ...saudavel, ...over })
    .filter(([k]) => !omit.includes(k))
    .map(([k, valor]) => ({ secao: k.split(".")[0], item: k.split(".").slice(1).join("."), valor }));

describe("análise objetiva da auditoria do banco de produção", () => {
  it("banco saudável: caminho A, sem críticos", () => {
    const r = analyze(rows());
    expect(r.caminho).toMatch(/^A /);
    expect(r.resultados.filter((x) => x.nivel !== "OK")).toEqual([]);
  });
  it("dados ausentes: caminho B ou C, que depende do backup", () => {
    const r = analyze(rows({ "auth.usuarios": "0", "linhas.profiles": "0", "linhas.tenants": "0", "linhas.obligations": "0" }));
    expect(r.caminho).toMatch(/^B ou C/);
    expect(r.resultados.filter((x) => x.nivel === "CRITICO").map((x) => x.criterio)).toEqual(expect.arrayContaining(["existem usuários no Auth", "dados presentes"]));
  });
  it("problema de segurança vence: tabela sem RLS, bucket público, conta de teste ou super admin sem MFA levam ao caminho D", () => {
    const casos: Record<string, string>[] = [{ "rls.tabelas_sem_rls": "leads" }, { "storage.buckets": "documents(PUBLICO)" }, { "equipe.equipe_com_email_de_teste": "2" }, { "equipe.super_admin_sem_mfa": "1" }];
    for (const over of casos)
      expect(analyze(rows({ ...over, "auth.usuarios": "0" })).caminho).toMatch(/^D /);
  });
  it("menos dados que a referência de 24/09 é atenção, não aprovação silenciosa", () => {
    const r = analyze(rows({ "linhas.obligations": "2" }));
    expect(r.resultados).toContainEqual(expect.objectContaining({ nivel: "ATENCAO", criterio: "obligations abaixo da referência" }));
  });
  it("item faltando no resultado aparece como AUSENTE e o caminho fica INCOMPLETO", () => {
    const r = analyze(rows({}, ["rls.tabelas_sem_rls"]));
    expect(r.resultados).toContainEqual(expect.objectContaining({ nivel: "AUSENTE" }));
    expect(r.caminho).toMatch(/^INCOMPLETO/);
  });
  it("sem a sessão somente leitura o resultado é inválido", () => {
    expect(analyze(rows({ "identificacao.sessao_somente_leitura": "off" })).caminho).toBe("INVALIDO");
  });
  it("lê o CSV do SQL Editor, inclusive valores com vírgula entre aspas", () => {
    const csv = 'secao,item,valor\nschema,extensoes,"pgcrypto, plpgsql"\nauth,usuarios,3\n';
    expect(parseCsv(csv)).toEqual([
      { secao: "schema", item: "extensoes", valor: "pgcrypto, plpgsql" },
      { secao: "auth", item: "usuarios", valor: "3" },
    ]);
  });
});
