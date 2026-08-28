import { z } from "zod";

/**
 * A coupon image is either an absolute http(s) URL or a root-relative path served by our
 * own API - the admin panel stores uploads as `/media/{id}/file`, which both the admin
 * list and the mobile shop resolve against the API origin at render time.
 *
 * The field used to be an unconstrained string, which also accepted `javascript:` and
 * `data:` URIs. Those land in an `<img src>` in the admin list and in the mobile shop's
 * resolveMediaUrl, so the set of acceptable schemes is spelled out here rather than left
 * to whatever the renderer happens to tolerate. A plain `.url()` cannot be used: it
 * would reject every relative path already stored.
 */
function isAllowedImageUrl(value: string): boolean {
  // `//host/path` is protocol-relative - it points off-origin despite the leading
  // slash, so only a single leading slash counts as local.
  if (value.startsWith("/")) return !value.startsWith("//");

  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

const imageUrlSchema = z
  .string()
  .trim()
  .refine(isAllowedImageUrl, {
    message: "imageUrl must be an http(s) URL or a path starting with /",
  });

export const createCouponSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  imageUrl: imageUrlSchema.nullable().optional(),
  pointsCost: z.number().int().positive(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
});

export const updateCouponSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  imageUrl: imageUrlSchema.nullable().optional(),
  pointsCost: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
});

export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;
