import { z } from "zod";

export const registerSchema = z.object({
  nombre_completo: z.string().min(3).max(120),
  correo: z.string().email().max(190),
  password: z.string().min(8).max(60),
});

export const loginSchema = z.object({
  correo: z.string().email().max(190),
  password: z.string().min(1),
});
