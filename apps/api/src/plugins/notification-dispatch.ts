import fp from "fastify-plugin";
import { dispatchPendingNotifications } from "../services/notification.service";

/**
 * Periodic send loop for 21.2's NotificationLog. Short interval, since a PENDING row means
 * an evaluator is waiting to be told about a test they can take right now - unlike the
 * reminder sweep, there's no dedup window making a fast poll wasteful here.
 */
const DISPATCH_INTERVAL_MS = 30 * 1000;

export const notificationDispatchPlugin = fp(async (app) => {
  let running = false;

  const tick = () => {
    // A slow batch (e.g. a flaky push provider) must not overlap with the next timer fire -
    // that would let two ticks race to claim from the same PENDING pool at once.
    if (running) return;
    running = true;
    dispatchPendingNotifications(app)
      .catch((err) => {
        app.log.error({ err }, "notification dispatch failed");
      })
      .finally(() => {
        running = false;
      });
  };

  tick();
  const timer = setInterval(tick, DISPATCH_INTERVAL_MS);
  timer.unref();

  app.addHook("onClose", () => {
    clearInterval(timer);
  });
});
