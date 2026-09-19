import { z } from "zod";

export const createTicketSchema = z.object({
  subject: z.string().trim().min(3, "Informe um assunto para o chamado."),
  body: z.string().trim().min(5, "Escreva a mensagem do chamado."),
});

export type CreateTicketValues = z.infer<typeof createTicketSchema>;

export const replyTicketSchema = z.object({
  body: z.string().trim().min(1, "Escreva uma mensagem."),
});

export type ReplyTicketValues = z.infer<typeof replyTicketSchema>;
