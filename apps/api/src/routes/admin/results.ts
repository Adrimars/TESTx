import type { FastifyPluginAsync } from "fastify";
import { authenticateUser } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/requireRole";
import {
  getTestResults,
  getTestResultsByDemographic,
  type SegmentBy,
} from "../../services/results.service";

const adminAuth = { preHandler: [authenticateUser, requireRole("ADMIN")] };

const SEGMENTS: SegmentBy[] = ["gender", "ageGroup", "country"];

export const adminResultsRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { id: string } }>("/tests/:id/results", adminAuth, async (request, reply) => {
    const results = await getTestResults(app.prisma, request.params.id);
    if (!results) return reply.status(404).send({ error: "NOT_FOUND", message: "Test not found" });
    return results;
  });

  app.get<{ Params: { id: string }; Querystring: { segmentBy?: string } }>(
    "/tests/:id/results/demographics",
    adminAuth,
    async (request, reply) => {
      const segmentBy = request.query.segmentBy;
      if (!segmentBy || !SEGMENTS.includes(segmentBy as SegmentBy)) {
        return reply.status(400).send({
          error: "BAD_REQUEST",
          message: `segmentBy must be one of: ${SEGMENTS.join(", ")}`,
        });
      }
      const results = await getTestResultsByDemographic(app.prisma, request.params.id, segmentBy as SegmentBy);
      if (!results) return reply.status(404).send({ error: "NOT_FOUND", message: "Test not found" });
      return results;
    }
  );
};
