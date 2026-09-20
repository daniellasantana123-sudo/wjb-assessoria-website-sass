export interface ScanResult {
  clean: boolean;
  reason?: string;
}

/**
 * Ponto de extensão para verificação de malware em upload (Fase 3 do
 * wjb-saas-mvp, seção "Segurança" do prompt) — Adapter Pattern, mesmo
 * padrão de `src/integrations/email` e `whatsapp-business`. Nenhum
 * provider de antivírus foi confirmado ainda (nem ClamAV, nem VirusTotal,
 * nem outro) — `docs/api/integrations.md` só lista providers depois de
 * confirmados, então o adapter real fica pra quando um for escolhido.
 */
export interface AntivirusAdapter {
  scan(file: File): Promise<ScanResult>;
}
