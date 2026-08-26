import { z } from "zod";

export const createCouponSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  pointsCost: z.number().int().positive(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
});

export const updateCouponSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  pointsCost: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
});

export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;
