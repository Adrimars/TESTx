import type { BadgeVariant } from "@testx/ui";

/** Test status → badge tone, so a status reads the same on every screen. */
export function statusVariant(status: string): BadgeVariant {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "PAUSED":
      return "warning";
    case "CLOSED":
      return "danger";
    case "DRAFT":
    default:
      return "neutral";
  }
}

/** Shared date formatting for list and detail screens. */
export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
