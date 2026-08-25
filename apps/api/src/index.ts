import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { adminDashboardRoutes } from "./routes/admin/dashboard";
import { adminMediaRoutes } from "./routes/admin/media";
import { adminResultsRoutes } from "./routes/admin/results";
import { adminTestsRoutes } from "./routes/admin/tests";
import { adminUsersRoutes } from "./routes/admin/users";
import { authRoutes } from "./routes/auth";
import { evaluatorRoutes } from "./routes/evaluator";
import { userRoutes } from "./routes/users";
import { mobileRoutes } from "./routes/mobile";
import { publicMediaRoutes } from "./routes/media";
import { errorHandlerPlugin } from "./plugins/error-handler";
import { prismaPlugin } from "./plugins/prisma";
import { rateLimitPlugin } from "./plugins/rate-limit";

const app = Fastify({
  logger: true,
});

await app.register(cors, {
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  // Authorization is needed for the bearer scheme added in Phase 9.1; native
  // clients bypass CORS entirely, but any browser-based client needs it.
  allowedHeaders: ["Content-Type", "Authorization"],
  origin: [
    process.env.EVALUATOR_APP_URL ?? "http://localhost:3000",
    process.env.ADMIN_APP_URL ?? "http://localhost:3001",
    // Expo's web target, used to exercise the mobile app during development. Native
    // builds are not subject to CORS at all, so this origin has no production use and
    // is left out of production entirely rather than shipped as a permanent hole.
    ...(process.env.NODE_ENV === "production"
      ? []
      : [process.env.MOBILE_WEB_URL ?? "http://localhost:8081"]),
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
await app.register(userRoutes, { prefix: "/users" });
await app.register(mobileRoutes, { prefix: "/mobile" });
await app.register(publicMediaRoutes, { prefix: "/media" });
await app.register(adminDashboardRoutes, { prefix: "/admin" });
await app.register(adminTestsRoutes, { prefix: "/admin" });
await app.register(adminResultsRoutes, { prefix: "/admin" });
await app.register(adminMediaRoutes, { prefix: "/admin" });
await app.register(adminUsersRoutes, { prefix: "/admin" });

const host = process.env.API_HOST ?? "0.0.0.0";
const port = Number(process.env.API_PORT ?? 4000);

try {
  await app.listen({ host, port });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
