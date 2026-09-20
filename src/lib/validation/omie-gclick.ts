import { z } from "zod";

export const omieMappingSchema = z.object({
  externalClientId: z.string().trim().optional().or(z.literal("")),
  externalPortalUrl: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((value) => !value || /^https:\/\//.test(value), {
      message: "O link do Portal Contábil precisa começar com https://.",
    }),
});

export type OmieMappingValues = z.infer<typeof omieMappingSchema>;
