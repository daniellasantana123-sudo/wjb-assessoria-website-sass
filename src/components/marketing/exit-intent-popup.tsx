"use client";

import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckCircle2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { headerCtas } from "@/config/navigation";
import { getTrackingParams } from "@/lib/analytics/tracking";
import {
  canShowPopup,
  EXIT_POPUP_SESSION_KEY,
  EXIT_POPUP_STORAGE_KEY,
  MIN_DWELL_DESKTOP_MS,
  MIN_DWELL_MOBILE_MS,
  MOBILE_SCROLL_RATIO,
  parseStoredState,
} from "@/lib/marketing/exit-intent";
import { exitIntentLeadSchema } from "@/lib/validation/lead";
import { cn } from "@/lib/utils";

const SUBJECTS = [
  "Abrir uma empresa",
  "Trocar de contador",
  "Contabilidade da minha empresa",
  "Imposto de renda e planejamento tributário",
  "Departamento pessoal",
  "Outro assunto",
];

const HIGHLIGHTS = [
  "Um contador da WJB entra em contato com você",
  "Proposta de acordo com o porte e o regime da sua empresa",
  "Seus dados protegidos, conforme a LGPD",
];

type Errors = Partial<Record<"name" | "phone" | "email" | "serviceInterest" | "consent", string>>;

function readStorage(storage: "local" | "session", key: string): string | null {
  try {
    return (storage === "local" ? window.localStorage : window.sessionStorage).getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(storage: "local" | "session", key: string, value: string) {
  try {
    (storage === "local" ? window.localStorage : window.sessionStorage).setItem(key, value);
  } catch {
    // navegação privada / storage bloqueado: o popup só não "lembra" a escolha
  }
}

/**
 * Popup de captação "Antes de sair" (2026-10-01, pedido do usuário, a
 * partir de um modelo do site da Armel-x, sem a oferta de "diagnóstico
 * gratuito", que a WJB não faz).
 *
 * Gatilho: no computador, quando o mouse sai pelo topo da página (gesto de
 * fechar a aba) depois de 8s; no celular, que não tem esse gesto, depois de
 * ler metade da página e passar 25s nela. Uma vez por visita; fechou, volta
 * só depois de 7 dias; enviou, nunca mais. Não aparece em páginas que já têm
 * formulário (`isExcludedPath`).
 *
 * O lead vai para o mesmo `/api/leads` dos outros formulários, com
 * `formContext: "Popup de saída"`.
 */
export function ExitIntentPopup() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errors, setErrors] = useState<Errors>({});
  const panelRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const ids = { name: useId(), phone: useId(), email: useId(), company: useId(), subject: useId(), consent: useId() };

  const show = useCallback(() => {
    const allowed = canShowPopup({
      pathname,
      stored: parseStoredState(readStorage("local", EXIT_POPUP_STORAGE_KEY)),
      shownThisSession: readStorage("session", EXIT_POPUP_SESSION_KEY) === "1",
      now: Date.now(),
    });
    if (!allowed) return;
    writeStorage("session", EXIT_POPUP_SESSION_KEY, "1");
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    setOpen(true);
  }, [pathname]);

  // Gatilhos
  useEffect(() => {
    if (open) return;
    const startedAt = Date.now();
    const coarse = window.matchMedia("(pointer: coarse)").matches;

    if (!coarse) {
      function onMouseOut(event: MouseEvent) {
        if (event.relatedTarget || event.clientY > 0) return;
        if (Date.now() - startedAt < MIN_DWELL_DESKTOP_MS) return;
        show();
      }
      document.addEventListener("mouseout", onMouseOut);
      return () => document.removeEventListener("mouseout", onMouseOut);
    }

    function onScroll() {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const ratio = window.scrollY / scrollable;
      if (ratio >= MOBILE_SCROLL_RATIO && Date.now() - startedAt >= MIN_DWELL_MOBILE_MS) show();
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [open, show]);

  const close = useCallback(() => {
    setOpen(false);
    if (status !== "sent") {
      writeStorage("local", EXIT_POPUP_STORAGE_KEY, JSON.stringify({ status: "dismissed", at: Date.now() }));
    }
    restoreFocusRef.current?.focus?.();
  }, [status]);

  // Foco, Esc e rolagem travada enquanto aberto
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstFieldRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled])",
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const parsed = exitIntentLeadSchema.safeParse({
      name: String(data.get("name") ?? ""),
      phone: String(data.get("phone") ?? ""),
      email: String(data.get("email") ?? ""),
      company: String(data.get("company") ?? ""),
      serviceInterest: String(data.get("serviceInterest") ?? ""),
      consent: data.get("consent") === "on",
    });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof Errors;
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }

    setErrors({});
    setStatus("sending");
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...parsed.data,
          company: parsed.data.company ?? "",
          message: `Contato pelo popup "Antes de sair". Assunto: ${parsed.data.serviceInterest}.`,
          formContext: "Popup de saída",
          tracking: getTrackingParams(pathname),
        }),
      });
      const result = (await response.json().catch(() => null)) as { ok?: boolean } | null;
      if (!response.ok || !result?.ok) throw new Error("falha no envio");
      setStatus("sent");
      writeStorage("local", EXIT_POPUP_STORAGE_KEY, JSON.stringify({ status: "submitted", at: Date.now() }));
    } catch {
      setStatus("error");
    }
  }

  if (!open) return null;

  const fieldError = (key: keyof Errors) =>
    errors[key] ? (
      <p id={`${ids[key === "serviceInterest" ? "subject" : key]}-erro`} role="alert" className="text-danger text-xs">
        {errors[key]}
      </p>
    ) : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Fechar"
        tabIndex={-1}
        onClick={close}
        className="animate-enter fixed inset-0 bg-neutral-950/60 backdrop-blur-[2px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="animate-slide-up bg-background relative z-10 grid max-h-[92dvh] w-full overflow-y-auto rounded-t-md shadow-2xl sm:max-w-3xl sm:rounded-md md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Fechar"
          className="focus-visible:ring-primary absolute top-2 right-2 z-10 flex h-10 w-10 items-center justify-center rounded-md text-white/80 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:outline-none md:text-neutral-500 md:hover:bg-neutral-100 md:hover:text-neutral-900"
        >
          <X aria-hidden="true" className="h-5 w-5" />
        </button>

        <div className="bg-brand-blue-800 flex flex-col gap-4 px-6 pt-8 pb-6 text-white md:p-8">
          <p className="text-xs font-semibold tracking-[0.14em] text-[#ffb27a] uppercase">Antes de sair</p>
          <h2 id={titleId} className="pr-8 text-2xl leading-tight font-semibold text-balance md:pr-0 md:text-[1.7rem]">
            Precisa de um contador para a <span className="text-[#ffb27a]">sua empresa</span>?
          </h2>
          <p className="text-sm leading-relaxed text-white/80">
            Deixe seu contato e a equipe da WJB fala com você para entender o momento da sua empresa e
            enviar uma proposta.
          </p>
          <ul className="hidden flex-col gap-2.5 sm:flex">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-white/90">
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#ffb27a]" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="p-6 md:p-8">
          {status === "sent" ? (
            <div className="flex h-full flex-col items-start justify-center gap-4 py-6" role="status">
              <span className="bg-success-bg text-success-text flex h-12 w-12 items-center justify-center rounded-full">
                <CheckCircle2 aria-hidden="true" className="h-6 w-6" />
              </span>
              <p className="text-foreground text-xl font-semibold">Recebemos seu contato!</p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Um contador da WJB vai falar com você pelo WhatsApp ou e-mail informado. Se preferir,
                pode chamar a gente agora.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href={headerCtas.talkToAccountant.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary inline-flex min-h-11 items-center rounded-md px-5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  Falar pelo WhatsApp
                </a>
                <Button type="button" variant="outline" onClick={close}>
                  Fechar
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={ids.name}>Nome</Label>
                <Input ref={firstFieldRef} id={ids.name} name="name" autoComplete="name" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? `${ids.name}-erro` : undefined} />
                {fieldError("name")}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <Label htmlFor={ids.phone}>WhatsApp</Label>
                  <Input id={ids.phone} name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 9 0000-0000" aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? `${ids.phone}-erro` : undefined} />
                  {fieldError("phone")}
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <Label htmlFor={ids.email}>E-mail</Label>
                  <Input id={ids.email} name="email" type="email" inputMode="email" autoComplete="email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? `${ids.email}-erro` : undefined} />
                  {fieldError("email")}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={ids.company}>Empresa (opcional)</Label>
                <Input id={ids.company} name="company" autoComplete="organization" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={ids.subject}>Assunto</Label>
                <Select id={ids.subject} name="serviceInterest" defaultValue="" aria-invalid={Boolean(errors.serviceInterest)} aria-describedby={errors.serviceInterest ? `${ids.subject}-erro` : undefined}>
                  <option value="" disabled>
                    Escolha um assunto
                  </option>
                  {SUBJECTS.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </Select>
                {fieldError("serviceInterest")}
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={ids.consent} className="text-muted-foreground flex items-start gap-2.5 text-xs leading-relaxed">
                  <input id={ids.consent} name="consent" type="checkbox" className="accent-primary mt-0.5 h-5 w-5 shrink-0" aria-invalid={Boolean(errors.consent)} />
                  <span>
                    Concordo com o uso dos meus dados para a WJB entrar em contato, conforme a{" "}
                    <Link href="/politica-de-privacidade" className="text-foreground underline underline-offset-2" target="_blank">
                      Política de Privacidade
                    </Link>
                    .
                  </span>
                </label>
                {fieldError("consent")}
              </div>

              {status === "error" && (
                <p role="alert" className="text-danger text-sm">
                  Não foi possível enviar agora. Fale com a gente pelo{" "}
                  <a href={headerCtas.talkToAccountant.href} target="_blank" rel="noopener noreferrer" className="underline">
                    WhatsApp
                  </a>
                  .
                </p>
              )}

              <Button type="submit" variant="cta" disabled={status === "sending"} className={cn("w-full")}>
                {status === "sending" ? "Enviando..." : "Quero falar com um contador"}
              </Button>
              <p className="text-muted-foreground text-center text-xs">Sem spam: usamos seus dados só para entrar em contato.</p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
