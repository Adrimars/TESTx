import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Joins class names and lets later Tailwind utilities win over earlier ones. */
export function cn(...classes: ClassValue[]) {
  return twMerge(clsx(classes));
}
