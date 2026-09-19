import { type ButtonHTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/utils";

const variantClasses = {
  primary:
    "bg-primary text-primary-foreground hover:bg-brand-blue-700 focus-visible:ring-primary",
  secondary:
    "bg-secondary text-secondary-foreground hover:bg-brand-lilac-700 focus-visible:ring-secondary",
  /**
   * O laranja da marca foi removido do site em 2026-09-14 (terceira
   * mudança de paleta no mesmo dia — usuário decidiu usar só o azul
   * oficial como destaque). `bg-cta`/`text-cta-foreground` agora
   * resolvem pro azul (ver globals.css) — esta variante fica
   * visualmente idêntica a `primary`, mantida só como nome semântico
   * ("este é o CTA principal desta seção") pros ~16 arquivos que já
   * chamam `variant="cta"`, sem precisar editar cada um deles.
   */
  cta: "bg-cta text-cta-foreground hover:bg-brand-blue-700 focus-visible:ring-cta",
  outline:
    "border border-border bg-transparent text-foreground hover:bg-muted focus-visible:ring-primary",
  ghost: "bg-transparent text-foreground hover:bg-muted focus-visible:ring-primary",
} as const;

const sizeClasses = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
} as const;

export type ButtonVariant = keyof typeof variantClasses;
export type ButtonSize = keyof typeof sizeClasses;

export function buttonVariants({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap transition-all duration-200 ease-out",
    /**
     * Feedback tátil (2026-09-17, a pedido do usuário — "animações... nos
     * botões", pensando como especialista de UX/UI). Leve elevação no
     * hover, "afunda" de volta e encolhe sutilmente no clique — mesmo
     * padrão de produtos como Linear/Stripe/Vercel. `active:` sempre
     * vence `hover:` na cascata (aparece depois no arquivo), então o
     * estado de clique nunca fica "preso" no de hover.
     */
    "hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.97] active:shadow-none",
    "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
    "disabled:pointer-events-none disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={buttonVariants({ variant, size, className })}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
