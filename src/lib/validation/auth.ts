import { z } from "zod";

export const loginFormSchema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe sua senha."),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;

export const passwordResetRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
});

export type PasswordResetRequestValues = z.infer<typeof passwordResetRequestSchema>;

const passwordFields = {
  password: z
    .string()
    .min(8, "A senha precisa ter pelo menos 8 caracteres.")
    .regex(/[a-zA-Z]/, "A senha precisa ter pelo menos uma letra.")
    .regex(/[0-9]/, "A senha precisa ter pelo menos um número."),
  confirmPassword: z.string(),
};

export const setPasswordSchema = z
  .object(passwordFields)
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

export type SetPasswordValues = z.infer<typeof setPasswordSchema>;

/** Primeiro acesso por convite: mesma regra de senha + nome completo. */
export const firstAccessSchema = z
  .object({
    fullName: z.string().trim().min(2, "Informe seu nome completo."),
    ...passwordFields,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

export type FirstAccessValues = z.infer<typeof firstAccessSchema>;
