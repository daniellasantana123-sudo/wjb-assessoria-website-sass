"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import {
  enrollTotpFactor,
  unenrollTotpFactor,
  verifyTotpEnrollment,
  type MfaEnrollState,
  type MfaFactorSummary,
} from "@/actions/mfa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Ativação de MFA (TOTP) por conta própria — não obrigatório pra ninguém
 * (Fase 2 do wjb-saas-mvp, "preparar a estrutura"). Compartilhado entre
 * `/portal/seguranca` e `/admin/seguranca`, cada um só passando os fatores
 * já buscados no servidor (`listTotpFactors()`).
 */
export function MfaSettings({ factors }: { factors: MfaFactorSummary[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [enrollment, setEnrollment] = useState<MfaEnrollState>(undefined);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const verified = factors.filter((f) => f.status === "verified");
  const pending = factors.filter((f) => f.status === "unverified");

  function handleEnroll() {
    startTransition(async () => {
      setVerifyError(null);
      const result = await enrollTotpFactor();
      setEnrollment(result);
    });
  }

  function handleUnenroll(factorId: string) {
    startTransition(async () => {
      await unenrollTotpFactor(factorId);
      setEnrollment(undefined);
      router.refresh();
    });
  }

  /*
   * `onSubmit` em vez de `useActionState` de propósito — o resultado
   * (sucesso/erro) precisa disparar `router.refresh()` e limpar o estado
   * local de enrollment, e fazer isso a partir de um `useEffect` observando
   * o retorno do `useActionState` disparava o lint `set-state-in-effect`
   * (setState síncrono dentro de efeito). Chamando a Server Action direto
   * dentro do handler (mesmo padrão de `handleEnroll`/`handleUnenroll`
   * acima), o setState fica dentro do próprio evento, sem efeito nenhum.
   */
  function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enrollment?.status !== "enrolled") return;
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await verifyTotpEnrollment(enrollment.factorId, undefined, formData);
      if (result && "error" in result) {
        setVerifyError(result.error);
        return;
      }
      setVerifyError(null);
      setEnrollment(undefined);
      router.refresh();
    });
  }

  return (
    <div className="border-border bg-background rounded-md border p-6">
      <div className="flex items-center gap-3">
        <span className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-md">
          <ShieldCheck aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-foreground font-medium">Verificação em duas etapas</h2>
          <p className="text-muted-foreground text-sm">
            Adiciona uma camada extra de segurança usando um aplicativo autenticador
            (Google Authenticator, Authy, 1Password etc.).
          </p>
        </div>
      </div>

      {verified.length > 0 ? (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-md border border-success bg-success-bg/40 p-4">
          <p className="text-success text-sm font-medium">Verificação em duas etapas ativada.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => handleUnenroll(verified[0].id)}
          >
            Desativar
          </Button>
        </div>
      ) : enrollment?.status === "enrolled" ? (
        <div className="mt-5 flex flex-col gap-4">
          <p className="text-foreground text-sm">
            Escaneie o QR code com o aplicativo autenticador e digite o código gerado.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG data URI do próprio Supabase, não passa por otimização de imagem */}
          <img
            src={enrollment.qrCode}
            alt="QR code para configurar a verificação em duas etapas"
            className="h-40 w-40 rounded-md border border-border"
          />
          <p className="text-muted-foreground text-xs">
            Não consegue escanear? Digite manualmente:{" "}
            <code className="bg-muted rounded px-1 py-0.5">{enrollment.secret}</code>
          </p>

          <form onSubmit={handleVerify} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="code">Código de 6 dígitos</Label>
              <Input
                id="code"
                name="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
              />
            </div>
            {verifyError && (
              <p role="alert" className="text-danger text-sm">
                {verifyError}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="submit" disabled={isPending} size="sm">
                {isPending ? "Confirmando..." : "Confirmar"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleUnenroll(enrollment.factorId)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </div>
      ) : (
        <div className="mt-5">
          {enrollment?.status === "error" && (
            <p role="alert" className="text-danger mb-3 text-sm">
              {enrollment.error}
            </p>
          )}
          <Button type="button" size="sm" disabled={isPending} onClick={handleEnroll}>
            {isPending ? "Preparando..." : "Ativar verificação em duas etapas"}
          </Button>
        </div>
      )}

      {pending.length > 0 && !enrollment && (
        <p className="text-muted-foreground mt-4 text-xs">
          Há {pending.length} configuração{pending.length === 1 ? "" : "ões"} não concluída
          {pending.length === 1 ? "" : "s"}. Ative de novo acima para tentar outra vez.
        </p>
      )}
    </div>
  );
}
