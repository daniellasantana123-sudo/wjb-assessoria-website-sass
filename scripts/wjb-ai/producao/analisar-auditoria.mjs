// Análise OBJETIVA do resultado da auditoria do banco de produção (Fase 10E).
// Entrada: o CSV exportado do SQL Editor depois de rodar
// auditoria-somente-leitura.sql (colunas secao,item,valor). Só contagens:
// nenhum dado pessoal entra ou sai daqui.
// Uso: node scripts/wjb-ai/producao/analisar-auditoria.mjs resultado.csv
import { readFileSync } from "node:fs";

/** Referência conhecida da produção (24/09/2026): 1 conta, 2 empresas, 6 obrigações. */
export const REFERENCIA = { profiles: 1, tenants: 2, obligations: 6 };
const TABELAS_ESPERADAS = 13; // migrations 0001 a 0023

export function parseCsv(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue;
    const m = /^"?([^",]*)"?,"?([^",]*)"?,(.*)$/.exec(line);
    if (m) rows.push({ secao: m[1], item: m[2], valor: m[3].replace(/^"|"$/g, "").replace(/""/g, '"') });
  }
  return rows;
}

/** @returns {{ resultados: {nivel:"OK"|"ATENCAO"|"CRITICO"|"AUSENTE", criterio:string, detalhe:string}[], caminho: string }} */
export function analyze(rows) {
  const v = new Map(rows.map((r) => [`${r.secao}.${r.item}`, r.valor]));
  const out = [];
  const num = (k) => (v.has(k) ? Number(v.get(k)) : NaN);
  const add = (nivel, criterio, detalhe = "") => out.push({ nivel, criterio, detalhe });
  const need = (k, test, nivelFalha, criterio, detalhe) => {
    if (!v.has(k)) return add("AUSENTE", criterio, `item ${k} não veio no resultado`);
    if (test(v.get(k))) add("OK", criterio);
    else add(nivelFalha, criterio, detalhe ?? `${k} = ${v.get(k)}`);
  };

  if (v.get("identificacao.sessao_somente_leitura") !== "on")
    return { resultados: [{ nivel: "CRITICO", criterio: "sessão somente leitura", detalhe: "resultado inválido: rode o script inteiro, sem alterar a primeira linha" }], caminho: "INVALIDO" };

  // Dados
  const linhas = (t) => num(`linhas.${t}`);
  need("auth.usuarios", (x) => Number(x) > 0, "CRITICO", "existem usuários no Auth", "0 usuários: o Auth foi perdido ou recriado");
  const vazio = linhas("profiles") === 0 && linhas("tenants") === 0;
  if (Number.isNaN(linhas("tenants"))) add("AUSENTE", "contagem de empresas");
  else if (vazio) add("CRITICO", "dados presentes", "profiles e tenants vazios: os dados não voltaram");
  else
    for (const [t, ref] of Object.entries(REFERENCIA)) {
      if (linhas(t) >= ref) add("OK", `${t} >= referência (${ref})`);
      else add("ATENCAO", `${t} abaixo da referência`, `${linhas(t)} < ${ref} (24/09)`);
    }

  // Equipe e acesso administrativo
  need("equipe.super_admin", (x) => Number(x) >= 1, "CRITICO", "existe super admin", "nenhum super admin");
  need("equipe.super_admin", (x) => Number(x) <= 1, "ATENCAO", "um super admin só (revisar se houver mais)");
  need("equipe.super_admin_sem_mfa", (x) => Number(x) === 0, "CRITICO", "todo super admin com MFA");
  need("equipe.equipe_com_email_de_teste", (x) => Number(x) === 0, "CRITICO", "nenhuma conta de teste na equipe");
  if (!Number.isNaN(num("auth.usuarios_com_mfa_verificado")) && !Number.isNaN(num("equipe.perfis_equipe")) && num("auth.usuarios_com_mfa_verificado") < num("equipe.perfis_equipe"))
    add("ATENCAO", "equipe com MFA", `${num("auth.usuarios_com_mfa_verificado")} usuários com MFA para ${num("equipe.perfis_equipe")} perfis de equipe`);

  // Integridade
  for (const k of ["perfis_sem_usuario_auth", "usuarios_auth_sem_perfil", "emails_duplicados_em_perfis", "cnpj_duplicado", "vinculos_sem_empresa", "vinculos_sem_pessoa", "obrigacoes_sem_empresa", "documentos_sem_empresa", "documentos_sem_arquivo_no_storage", "chamados_sem_empresa", "notificacoes_sem_destinatario", "vinculos_gclick_sem_empresa"])
    need(`integridade.${k}`, (x) => Number(x) === 0, "ATENCAO", `integridade: ${k} = 0`);

  // Esquema
  need("schema.tabelas", (x) => Number(x) === TABELAS_ESPERADAS, "ATENCAO", `${TABELAS_ESPERADAS} tabelas (migrations até a 0023)`);
  need("schema.security_definer_sem_search_path", (x) => x === "nenhuma", "ATENCAO", "funções SECURITY DEFINER com search_path");
  need("schema.indices_invalidos", (x) => Number(x) === 0, "ATENCAO", "nenhum índice inválido");

  // RLS
  need("rls.tabelas_sem_rls", (x) => x === "nenhuma", "CRITICO", "RLS ligada em todas as tabelas");
  need("rls.politicas_using_true_para_anon_ou_public", (x) => x === "nenhuma", "CRITICO", "nenhuma política aberta para anônimo");
  need("rls.guarda_de_colunas_privilegiadas_0022", (x) => x === "true", "CRITICO", "guarda de colunas privilegiadas (0022)");
  need("rls.funcoes_de_acesso", (x) => ["is_staff", "is_super_admin", "my_tenant_ids", "is_tenant_owner"].every((f) => x.includes(f)), "CRITICO", "funções de acesso presentes");

  // Migrations
  for (const k of ["m0016_status_da_conta", "m0017_vinculo_gclick", "m0020_obrigacoes_externas", "m0022_guarda_de_perfil", "m0023_funil_de_leads"])
    need(`migrations.${k}`, (x) => x === "true", "ATENCAO", `migration ${k.slice(1, 5)} presente`);
  need("migrations.tabelas_wjb_ai_ou_comercial_NAO_deveriam_existir", (x) => Number(x) === 0, "ATENCAO", "nenhuma tabela da WJB AI na produção");

  // Storage
  need("storage.buckets", (x) => x.includes("documents(privado)") && !x.includes("PUBLICO"), "CRITICO", "bucket documents existe e é privado");

  const crit = out.filter((r) => r.nivel === "CRITICO");
  const seguranca = crit.some((r) => /RLS|anônimo|super admin|teste|guarda|funções de acesso|privado/.test(r.criterio));
  const semDados = crit.some((r) => /usuários no Auth|dados presentes/.test(r.criterio));
  const caminho = seguranca
    ? "D - tratar como incidente de segurança antes de qualquer recuperação"
    : semDados
      ? "B ou C - dados ausentes: depende de existir backup/PITR anterior a 13/10/2026 (ver checklist de backups)"
      : out.some((r) => r.nivel === "AUSENTE")
        ? "INCOMPLETO - itens faltando no resultado"
        : "A - sem recuperação; conferir login da CEO com MFA e seguir";
  return { resultados: out, caminho };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  if (!file) {
    console.error("Uso: node analisar-auditoria.mjs resultado.csv");
    process.exit(2);
  }
  const { resultados, caminho } = analyze(parseCsv(readFileSync(file, "utf8")));
  for (const r of resultados) console.log(`${r.nivel.padEnd(8)} ${r.criterio}${r.detalhe ? ` (${r.detalhe})` : ""}`);
  console.log(`\nCaminho sugerido: ${caminho}`);
  process.exit(resultados.some((r) => r.nivel === "CRITICO") ? 1 : 0);
}
