/**
 * Defeito conhecido no XSD OFICIAL de produção v1.01 (09/02/2026): o padrão
 * de TSSerieDPS é `^0{0,4}\d{1,5}$`, e em XSD `^`/`$` são literais, então o
 * libxml2 recusa qualquer série. SÓ este erro é tolerado, e só no pacote de
 * produção. O texto da mensagem muda com a versão do libxml2 (macOS: "element
 * serie: Schemas validity error ..."; Ubuntu: "Element '{ns}serie': [facet
 * ..."), por isso o padrão aceita os dois formatos (achado na CI, Fase 10D).
 */
const SERIE_BUG =
  /(element serie: Schemas validity error|Element '\{http:\/\/www\.sped\.fazenda\.gov\.br\/nfse\}serie':) .*\[facet 'pattern'\] The value '\d+' is not accepted by the pattern '\^0\{0,4\}\\d\{1,5\}\$'/;

export function isKnownOfficialXsdIssue(layoutId: string, line: string): boolean {
  return layoutId === "producao-v1.01-20260209" && SERIE_BUG.test(line);
}
