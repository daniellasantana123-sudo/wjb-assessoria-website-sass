import { z } from "zod";

export const createObligationSchema = z.object({
  title: z.string().trim().min(2, "Informe o título da obrigação."),
  description: z.string().trim().optional().or(z.literal("")),
  dueDate: z.string().trim().min(1, "Informe a data de vencimento."),
});

export type CreateObligationValues = z.infer<typeof createObligationSchema>;
