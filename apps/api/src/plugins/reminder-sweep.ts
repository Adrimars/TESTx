import fp from "fastify-plugin";
import { runReminderSweep } from "../services/notification.service";

/**
 * Periodic re-engagement reminder scan (21.1). Runs far more often than the reminder
 * window itself (see notification.service.ts's REMINDER_INTERVAL_DAYS) - that's fine and
 * intentional, since the window-bucketed dedupeKey plus the NotificationLog unique
 * constraint make repeat runs inside the same window a no-op rather than a duplicate send.
 */
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

export const reminderSweepPlugin = fp(async (app) => {
  const sweep = () => {
    runReminderSweep(app).catch((err) => {
      app.log.error({ err }, "reminder sweep failed");
    });
  };

  sweep();
  const timer = setInterval(sweep, SWEEP_INTERVAL_MS);
  timer.unref();

  app.addHook("onClose", () => {
    clearInterval(timer);
  });
});
