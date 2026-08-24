import { z } from "zod";
import { registerSchema, loginSchema, evaluatorProfileSchema } from "@testx/shared";

export { registerSchema, loginSchema, evaluatorProfileSchema };

/**
 * Flattens a ZodError into a field -> first message map, which is the shape the
 * native forms in Phase 9.3 render against.
 */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    result[key] ??= issue.message;
  }
  return result;
}

/** Validates one field without requiring the rest of the form to be filled in. */
export function checkField<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  field: keyof T & string,
  value: unknown
): string | null {
  const fieldSchema = schema.shape[field];
  if (!fieldSchema) return null;
  const result = fieldSchema.safeParse(value);
  return result.success ? null : (result.error.issues[0]?.message ?? "Invalid value");
}
