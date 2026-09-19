import { z } from "zod";

export const inviteStaffSchema = z.object({
  fullName: z.string().trim().min(2, "Informe o nome da pessoa."),
  email: z.string().trim().email("Informe um e-mail válido."),
  staffRole: z.enum(["super_admin", "contador", "atendimento"]),
});

export type InviteStaffValues = z.infer<typeof inviteStaffSchema>;
