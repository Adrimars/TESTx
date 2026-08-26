import type { FastifyPluginAsync } from "fastify";
import { createCouponSchema, updateCouponSchema } from "@testx/shared";
import { authenticateUser } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/requireRole";
import { parsePageParams } from "../../lib/pagination";

const adminAuth = { preHandler: [authenticateUser, requireRole("ADMIN")] };

function serializeCoupon(coupon: {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  pointsCost: number;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: coupon.id,
    title: coupon.title,
    description: coupon.description,
    imageUrl: coupon.imageUrl,
    pointsCost: coupon.pointsCost,
    isActive: coupon.isActive,
    displayOrder: coupon.displayOrder,
    createdAt: coupon.createdAt.toISOString(),
    updatedAt: coupon.updatedAt.toISOString(),
  };
}

export const adminCouponsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/coupons", adminAuth, async (request) => {
    const { page, limit, skip, take } = parsePageParams(
      request.query as { page?: string; limit?: string },
      50
    );

    const [items, total] = await Promise.all([
      app.prisma.coupon.findMany({
        orderBy: { displayOrder: "asc" },
        skip,
        take,
      }),
      app.prisma.coupon.count(),
    ]);

    return { items: items.map(serializeCoupon), total, page, limit };
  });

  app.post("/coupons", adminAuth, async (request, reply) => {
    const body = createCouponSchema.parse(request.body);

    let displayOrder = body.displayOrder;
    if (displayOrder === undefined) {
      const last = await app.prisma.coupon.findFirst({
        orderBy: { displayOrder: "desc" },
        select: { displayOrder: true },
      });
      displayOrder = (last?.displayOrder ?? 0) + 1;
    }

    const coupon = await app.prisma.coupon.create({
      data: {
        title: body.title,
        description: body.description ?? null,
        imageUrl: body.imageUrl ?? null,
        pointsCost: body.pointsCost,
        isActive: body.isActive ?? true,
        displayOrder,
      },
    });
    return reply.status(201).send(serializeCoupon(coupon));
  });

  app.put<{ Params: { id: string } }>("/coupons/:id", adminAuth, async (request, reply) => {
    const existing = await app.prisma.coupon.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.status(404).send({ error: "NOT_FOUND", message: "Coupon not found" });

    const body = updateCouponSchema.parse(request.body);
    const coupon = await app.prisma.coupon.update({
      where: { id: request.params.id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...("description" in body && { description: body.description ?? null }),
        ...("imageUrl" in body && { imageUrl: body.imageUrl ?? null }),
        ...(body.pointsCost !== undefined && { pointsCost: body.pointsCost }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.displayOrder !== undefined && { displayOrder: body.displayOrder }),
      },
    });
    return reply.send(serializeCoupon(coupon));
  });

  // Deactivation is the only removal path (plan.md 14.1) - no DELETE, since a coupon that
  // already went out to evaluators as active shouldn't disappear from admin history.
  app.put<{ Params: { id: string } }>("/coupons/:id/deactivate", adminAuth, async (request, reply) => {
    const existing = await app.prisma.coupon.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.status(404).send({ error: "NOT_FOUND", message: "Coupon not found" });

    const coupon = await app.prisma.coupon.update({
      where: { id: request.params.id },
      data: { isActive: false },
    });
    return reply.send(serializeCoupon(coupon));
  });
};
