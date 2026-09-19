import { z } from "zod";

export const createTenantSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da empresa."),
  cnpj: z.string().trim().optional().or(z.literal("")),
});

export type CreateTenantValues = z.infer<typeof createTenantSchema>;

export const inviteMemberSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido."),
  fullName: z.string().trim().min(2, "Informe o nome da pessoa."),
  role: z.enum(["owner", "member"]),
});

export type InviteMemberValues = z.infer<typeof inviteMemberSchema>;
