"use client";

import { type InputHTMLAttributes, forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

/**
 * Campo de senha com botão de olho para mostrar/ocultar o que foi digitado.
 * Cada campo controla a própria visibilidade (em "Definir senha", mostrar a
 * nova senha não revela a confirmação). O botão é `type="button"` para não
 * enviar o formulário, e o `aria-label` muda junto com o estado para leitor
 * de tela anunciar a ação certa.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    const Icon = visible ? EyeOff : Eye;

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn("pr-11", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visible}
          aria-controls={props.id}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-primary absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <Icon aria-hidden="true" className="size-5" />
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
