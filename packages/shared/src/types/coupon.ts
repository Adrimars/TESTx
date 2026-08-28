export type Coupon = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  pointsCost: number;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

/** What `GET /evaluator/coupons` returns - active items only, no admin-only fields to hide. */
export type EvaluatorCoupon = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  pointsCost: number;
  displayOrder: number;
};
