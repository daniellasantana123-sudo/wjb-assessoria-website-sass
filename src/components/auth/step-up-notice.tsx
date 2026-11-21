import Link from "next/link";

import { checkRecentStepUp } from "@/lib/auth/dal";

/**
 * Aviso de confirmação recente do MFA (step-up, Fase 10A) nas páginas com
 * ações sensíveis (preço, desconto, autoridade fiscal). O servidor confere
 * de novo em cada ação: o aviso só orienta.
 */
export async function StepUpNotice({ next }: { next: string }) {
  const step = await checkRecentStepUp();
  if (step.ok)
    return (
      <p role="status" className="border-success/40 bg-success/10 rounded-md border px-4 py-2 text-sm">
        Identidade confirmada para ações sensíveis (vale 15 minutos).
      </p>
    );
  return (
    <div role="note" className="border-warning/40 bg-warning/10 flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm">
      <span>Ações sensíveis desta página (preços, aprovações e autorizações fiscais) exigem confirmação recente da verificação em duas etapas.</span>
      {step.reason === "sem_mfa" ? (
        <Link href="/admin/seguranca" className="text-primary font-medium underline">Ativar verificação em duas etapas</Link>
      ) : (
        <Link href={`/verificar-mfa?reconfirmar=1&next=${encodeURIComponent(next)}`} className="text-primary font-medium underline">Confirmar identidade</Link>
      )}
    </div>
  );
}
