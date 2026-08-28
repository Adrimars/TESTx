import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

/**
 * One-off fixture for the Phase 15 on-device QA pass (feedback from this run becomes
 * Phase 16). Two ACTIVE tests, no demographic filters, built from real downloaded photos
 * (packages/database/prisma/seed-assets/phase16-qa) rather than the generated mockups
 * seed.ts falls back to - real content, but not a real study, and safe to delete once
 * the pass is done.
 *
 * Idempotent: fixed ids + upsert, so running this again after re-seeding the rest of the
 * database just recreates these two tests without duplicating them.
 */

const prisma = new PrismaClient();

function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
}

function assetDir(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "seed-assets", "phase16-qa");
}

function uploadDir(): string {
  return path.resolve(repoRoot(), process.env.UPLOAD_DIR ?? "./uploads", "phase16-qa");
}

const MEDIA_ID_PREFIX = "20000000-0000-0000-0000-";
function mediaId(n: number): string {
  return MEDIA_ID_PREFIX + String(n).padStart(12, "0");
}

async function upsertMedia(n: number, fileName: string, tags: string[]) {
  const id = mediaId(n);
  const target = path.join(uploadDir(), fileName);
  await fs.mkdir(uploadDir(), { recursive: true });
  await fs.copyFile(path.join(assetDir(), fileName), target);
  const { size } = await fs.stat(target);

  return prisma.media.upsert({
    where: { id },
    update: { sourceUrl: path.posix.join("phase16-qa", fileName), fileSize: size },
    create: {
      id,
      fileName,
      fileType: "IMAGE",
      mimeType: "image/jpeg",
      fileSize: size,
      sourceType: "UPLOAD",
      sourceUrl: path.posix.join("phase16-qa", fileName),
      thumbnailUrl: `/media/${id}/file`,
      tags: ["phase16-qa", ...tags],
    },
  });
}

async function main() {
  const media = {
    seaForest: await upsertMedia(1, "pic-10.jpg", ["nature"]),
    waterfall: await upsertMedia(2, "pic-15.jpg", ["nature"]),
    deskOverhead: await upsertMedia(3, "pic-20.jpg", ["desk"]),
    openBook: await upsertMedia(4, "pic-24.jpg", ["still-life"]),
    greenCanyon: await upsertMedia(5, "pic-28.jpg", ["nature"]),
    duskField: await upsertMedia(6, "pic-33.jpg", ["nature"]),
    cafeCups: await upsertMedia(7, "pic-42.jpg", ["lifestyle"]),
    laptopWood: await upsertMedia(8, "pic-48.jpg", ["desk"]),
    deskFlatlay: await upsertMedia(9, "pic-60.jpg", ["desk"]),
    goldenHair: await upsertMedia(10, "pic-65.jpg", ["lifestyle"]),
    grapevine: await upsertMedia(11, "pic-75.jpg", ["nature"]),
    trafficAerial: await upsertMedia(12, "pic-88.jpg", ["urban"]),
    controller: await upsertMedia(13, "pic-96.jpg", ["lifestyle"]),
    parkSneakers: await upsertMedia(14, "pic-103.jpg", ["lifestyle"]),
  };

  // ── Test A: Rating & Ranking ─────────────────────────────────────────────
  // Q1 leaves minLabel/maxLabel unset on purpose - it's the one place in this fixture
  // that exercises 15.3's default "Low"/"High" fallback rather than admin-set text.
  await prisma.test.upsert({
    where: { id: "20000000-0000-0000-0001-000000000000" },
    update: {},
    create: {
      id: "20000000-0000-0000-0001-000000000000",
      title: "Golden Hour Wallpaper Study",
      description: "Quick photo-rating pass - not a real study, Phase 15 QA fixture.",
      status: "ACTIVE",
      advisoryTimeMin: 2,
      minTimePerQuestion: 3,
      rewardPoints: 3,
      questions: {
        create: [
          {
            type: "RATING",
            prompt: "Rate how much you'd want this as your phone wallpaper",
            mediaType: "IMAGE",
            order: 1,
            config: { min: 1, max: 5 },
            options: { create: [{ label: "Dusk field", mediaId: media.duskField.id, order: 1 }] },
          },
          {
            type: "RANKING",
            prompt: "Rank these five photos from best to worst wallpaper",
            mediaType: "IMAGE",
            order: 2,
            config: {},
            options: {
              create: [
                { label: "Sea and forest", mediaId: media.seaForest.id, order: 1 },
                { label: "Waterfall", mediaId: media.waterfall.id, order: 2 },
                { label: "Green canyon", mediaId: media.greenCanyon.id, order: 3 },
                { label: "Grapevine", mediaId: media.grapevine.id, order: 4 },
                { label: "Game controller", mediaId: media.controller.id, order: 5 },
              ],
            },
          },
          {
            type: "RATING",
            prompt: "Rate how visually interesting this photo is",
            mediaType: "IMAGE",
            order: 3,
            config: { min: 1, max: 5, minLabel: "Meh", maxLabel: "Stunning" },
            options: { create: [{ label: "Traffic, aerial", mediaId: media.trafficAerial.id, order: 1 }] },
          },
        ],
      },
    },
  });

  // ── Test B: Quick Picks ───────────────────────────────────────────────────
  // Q3's prompt says "zero, some, or all" outright - it's worded to invite the exact
  // thing 15.1 stopped blocking.
  await prisma.test.upsert({
    where: { id: "20000000-0000-0000-0002-000000000000" },
    update: {},
    create: {
      id: "20000000-0000-0000-0002-000000000000",
      title: "Quick Picks",
      description: "Two-option, tap-list, and multi-select pass - Phase 15 QA fixture.",
      status: "ACTIVE",
      advisoryTimeMin: 2,
      minTimePerQuestion: 3,
      rewardPoints: 3,
      questions: {
        create: [
          {
            type: "SINGLE_SELECT",
            prompt: "Which feels more like your idea of a relaxing evening?",
            mediaType: "IMAGE",
            order: 1,
            config: {},
            options: {
              create: [
                { label: "Coffee shop", mediaId: media.cafeCups.id, order: 1 },
                { label: "Game night", mediaId: media.controller.id, order: 2 },
              ],
            },
          },
          {
            type: "SINGLE_SELECT",
            prompt: "Which of these would you pick for a “work smarter” blog header?",
            mediaType: "IMAGE",
            order: 2,
            config: {},
            options: {
              create: [
                { label: "Desk, overhead", mediaId: media.deskOverhead.id, order: 1 },
                { label: "Laptop on wood", mediaId: media.laptopWood.id, order: 2 },
                { label: "Desk flat-lay", mediaId: media.deskFlatlay.id, order: 3 },
                { label: "Park sneakers", mediaId: media.parkSneakers.id, order: 4 },
              ],
            },
          },
          {
            type: "MULTI_SELECT",
            prompt: "Select any of these that feel calming to you - zero, some, or all is a completely fine answer",
            mediaType: "IMAGE",
            order: 3,
            // No maxSelections (plan.md Phase 16.3): the prompt promises "all" is a valid
            // answer, so the config must not cap the evaluator below the option count.
            config: {},
            options: {
              create: [
                { label: "Open book", mediaId: media.openBook.id, order: 1 },
                { label: "Golden hour", mediaId: media.goldenHair.id, order: 2 },
                { label: "Grapevine", mediaId: media.grapevine.id, order: 3 },
                { label: "Traffic, aerial", mediaId: media.trafficAerial.id, order: 4 },
              ],
            },
          },
        ],
      },
    },
  });

  console.log("Phase 16 QA fixtures ready: “Golden Hour Wallpaper Study” and “Quick Picks”, both ACTIVE.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
