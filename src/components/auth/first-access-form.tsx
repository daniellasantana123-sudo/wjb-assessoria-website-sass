"use client";

import { useActionState } from "react";

import { completeFirstAccess } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

/**
 * Primeiro acesso por convite: a pessoa confere o e-mail, confirma o nome e
 * cria a senha numa tela só, e já entra na plataforma. O e-mail é só
 * leitura - é a identidade da conta, trocá-lo aqui criaria um login que
 * ninguém da WJB convidou.
 */
export function FirstAccessForm({
  email,
  defaultFullName,
}: {
  email: string;
  defaultFullName: string;
}) {
  const [state, formAction, pending] = useActionState(completeFirstAccess, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">E-mail de acesso</Label>
        <Input
          id="email"
          type="email"
          value={email}
          readOnly
          aria-readonly="true"
          className="bg-muted/40 text-muted-foreground"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fullName">Nome completo</Label>
        <Input
          id="fullName"
          name="fullName"
          defaultValue={defaultFullName}
          autoComplete="name"
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Crie uma senha</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          aria-describedby="password-hint"
          required
        />
        <p id="password-hint" className="text-muted-foreground text-xs">
          Mínimo de 8 caracteres, com pelo menos uma letra e um número.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmPassword">Confirme a senha</Label>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          required
        />
      </div>

      {state?.error && (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Criando seu acesso..." : "Criar meu acesso e entrar"}
      </Button>
    </form>
  );
}
