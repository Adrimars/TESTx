import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { adminDashboardRoutes } from "./routes/admin/dashboard";
import { adminMediaRoutes } from "./routes/admin/media";
import { adminTemplatesRoutes } from "./routes/admin/templates";
import { adminTestsRoutes } from "./routes/admin/tests";
import { adminUsersRoutes } from "./routes/admin/users";
import { authRoutes } from "./routes/auth";
import { evaluatorRoutes } from "./routes/evaluator";
import { publicMediaRoutes } from "./routes/media";
import { errorHandlerPlugin } from "./plugins/error-handler";
import { prismaPlugin } from "./plugins/prisma";
import { rateLimitPlugin } from "./plugins/rate-limit";

const app = Fastify({
  logger: true,
});

await app.register(cors, {
  credentials: true,
  origin: [
    process.env.EVALUATOR_APP_URL ?? "http://localhost:3000",
    process.env.ADMIN_APP_URL ?? "http://localhost:3001",
  ],
});
await app.register(cookie);
await app.register(multipart, {
  limits: {
    fileSize: 500 * 1024 * 1024,
  },
});
await app.register(rateLimitPlugin);
await app.register(errorHandlerPlugin);
await app.register(prismaPlugin);

app.get("/health", async () => ({ status: "ok" }));
await app.register(authRoutes, { prefix: "/auth" });
await app.register(evaluatorRoutes, { prefix: "/evaluator" });
await app.register(publicMediaRoutes, { prefix: "/media" });
await app.register(adminDashboardRoutes, { prefix: "/admin" });
await app.register(adminTestsRoutes, { prefix: "/admin" });
await app.register(adminMediaRoutes, { prefix: "/admin" });
await app.register(adminUsersRoutes, { prefix: "/admin" });
await app.register(adminTemplatesRoutes, { prefix: "/admin" });

const host = process.env.API_HOST ?? "0.0.0.0";
const port = Number(process.env.API_PORT ?? 4000);

try {
  await app.listen({ host, port });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
