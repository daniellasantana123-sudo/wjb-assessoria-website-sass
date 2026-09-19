import { z } from "zod";

export const sendMessageSchema = z.object({
  body: z.string().trim().min(1, "Escreva uma mensagem."),
});

export type SendMessageValues = z.infer<typeof sendMessageSchema>;
