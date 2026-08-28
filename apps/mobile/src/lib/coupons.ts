import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./api";

/** Mirrors `GET /evaluator/coupons` in apps/api/src/routes/evaluator.ts. */
export type EvaluatorCoupon = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  pointsCost: number;
  displayOrder: number;
};

export function useCoupons() {
  return useQuery({
    queryKey: ["coupons"],
    queryFn: () => apiFetch<EvaluatorCoupon[]>("/evaluator/coupons"),
  });
}
