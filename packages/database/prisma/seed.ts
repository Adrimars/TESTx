import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { existsSync, readdirSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Distinct hues so the seeded images are visually tellable apart in preference tests.
const PLACEHOLDER_COLORS: [number, number, number][] = [
  [214, 87, 74],
  [232, 149, 62],
  [226, 195, 74],
  [116, 176, 92],
  [74, 160, 168],
  [80, 122, 200],
  [124, 96, 190],
  [196, 92, 158],
  [140, 122, 106],
  [96, 106, 122],
];

const IMAGE_WIDTH = 400;
const IMAGE_HEIGHT = 300;

/**
 * Where the committed seed imagery lives. Drop real photographs into a `custom/` folder
 * beside it and they are used instead - the generated mockups are a fallback for a fresh
 * clone, not a preference.
 */
function getSeedAssetDir(): { dir: string; isCustom: boolean } {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const custom = path.resolve(here, "seed-assets", "custom");
  if (existsSync(custom) && readdirSync(custom).some((f) => /\.(png|jpe?g|webp)$/i.test(f))) {
    return { dir: custom, isCustom: true };
  }
  return { dir: path.resolve(here, "seed-assets"), isCustom: false };
}

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

function getSeedUploadDir(): string {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  return path.resolve(repoRoot, process.env.UPLOAD_DIR ?? "./uploads", "seed");
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(width: number, height: number, pixel: (x: number, y: number) => [number, number, number]): Buffer {
  const raw = Buffer.alloc(height * (1 + width * 3));
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(x, y);
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

async function writePlaceholderImage(
  dir: string,
  fileName: string,
  [r, g, b]: [number, number, number]
): Promise<{ filePath: string; fileSize: number }> {
  const png = encodePng(IMAGE_WIDTH, IMAGE_HEIGHT, (x, y) => {
    const t = (x / IMAGE_WIDTH + y / IMAGE_HEIGHT) / 2;
    const band = y > IMAGE_HEIGHT * 0.7 ? 40 : 0;
    const shade = (c: number) => Math.max(0, Math.min(255, Math.round(c * (0.65 + t * 0.5) + band)));
    return [shade(r), shade(g), shade(b)];
  });

  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, png);
  return { filePath, fileSize: png.length };
}

/** Compute age from a YYYY-MM-DD string as of today. */
function ageFromDob(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 10);

  // ── Admin ────────────────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: "admin@testx.local" },
    update: {},
    create: { email: "admin@testx.local", passwordHash, role: "ADMIN", isVerified: true },
  });

  // ── Media items ──────────────────────────────────────────────────────────
  const mediaIds = [
    "00000000-0000-0000-0000-000000000001",
    "00000000-0000-0000-0000-000000000002",
    "00000000-0000-0000-0000-000000000003",
    "00000000-0000-0000-0000-000000000004",
    "00000000-0000-0000-0000-000000000005",
    "00000000-0000-0000-0000-000000000006",
    "00000000-0000-0000-0000-000000000007",
    "00000000-0000-0000-0000-000000000008",
    "00000000-0000-0000-0000-000000000009",
    "00000000-0000-0000-0000-000000000010",
  ];

  const mediaNames = [
    "product-a.png",
    "product-b.png",
    "product-c.png",
    "product-d.png",
    "product-e.png",
    "product-f.png",
    "lifestyle-1.png",
    "lifestyle-2.png",
    "lifestyle-3.png",
    "packaging-1.png",
  ];

  const uploadDir = getSeedUploadDir();
  await fs.mkdir(uploadDir, { recursive: true });

  const medias = await Promise.all(
    mediaIds.map(async (id, i) => {
      const { filePath, fileSize } = await writePlaceholderImage(
        uploadDir,
        mediaNames[i]!,
        PLACEHOLDER_COLORS[i] ?? PLACEHOLDER_COLORS[0]!
      );

      return prisma.media.upsert({
        where: { id },
        update: { sourceType: "UPLOAD", sourceUrl: filePath, mimeType: "image/png", fileSize },
        create: {
          id,
          fileName: mediaNames[i]!,
          fileType: "IMAGE",
          mimeType: "image/png",
          fileSize,
          sourceType: "UPLOAD",
          sourceUrl: filePath,
          thumbnailUrl: `/media/${id}/file`,
          tags: ["sample", i < 6 ? "product" : "lifestyle"],
        },
      });
    })
  );

  // ── Sample evaluator accounts ────────────────────────────────────────────
  const evaluatorSeeds = [
    { email: "evaluator@testx.local", dob: "1996-04-12", gender: "FEMALE" as const, country: "US", city: "Austin" },
    { email: "alice@demo.testx",      dob: "1990-07-22", gender: "FEMALE" as const, country: "GB", city: "London" },
    { email: "bob@demo.testx",        dob: "1985-03-15", gender: "MALE"   as const, country: "US", city: "New York" },
    { email: "carlos@demo.testx",     dob: "2000-11-30", gender: "MALE"   as const, country: "ES", city: "Madrid" },
    { email: "diana@demo.testx",      dob: "1978-01-05", gender: "FEMALE" as const, country: "DE", city: "Berlin" },
    { email: "elena@demo.testx",      dob: "1993-09-18", gender: "FEMALE" as const, country: "FR", city: "Paris" },
    { email: "frank@demo.testx",      dob: "1988-06-25", gender: "MALE"   as const, country: "CA", city: "Toronto" },
    { email: "grace@demo.testx",      dob: "1970-12-08", gender: "FEMALE" as const, country: "AU", city: "Sydney" },
  ];

  const evaluators = await Promise.all(
    evaluatorSeeds.map((seed) =>
      prisma.user.upsert({
        where: { email: seed.email },
        update: {},
        create: {
          email: seed.email,
          passwordHash,
          role: "EVALUATOR",
          isVerified: true,
          evaluatorProfile: {
            create: {
              age: ageFromDob(seed.dob),
              gender: seed.gender,
              country: seed.country,
              city: seed.city,
              balance: 0,
            },
          },
        },
        include: { evaluatorProfile: true },
      })
    )
  );

  // ── Studio imagery for the brand study ───────────────────────────────────
  // Copied out of the repo rather than generated here: the tiny PNG encoder above can
  // draw a gradient and nothing else, and a preference test whose options are four flat
  // gradients cannot tell you anything about a preference.
  const assets = getSeedAssetDir();
  const assetFiles = readdirSync(assets.dir)
    .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
    .sort();

  const studioMedia = await Promise.all(
    assetFiles.map(async (fileName, index) => {
      const id = `10000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`;
      const target = path.join(uploadDir, fileName);
      await fs.copyFile(path.join(assets.dir, fileName), target);
      const { size } = await fs.stat(target);
      const ext = path.extname(fileName).toLowerCase();

      return prisma.media.upsert({
        where: { id },
        // Stored relative to the upload root so the row survives the project moving.
        update: { sourceUrl: path.posix.join("seed", fileName), fileSize: size },
        create: {
          id,
          fileName,
          fileType: "IMAGE",
          mimeType: MIME_BY_EXT[ext] ?? "image/png",
          fileSize: size,
          sourceType: "UPLOAD",
          sourceUrl: path.posix.join("seed", fileName),
          thumbnailUrl: `/media/${id}/file`,
          tags: ["seed", "studio"],
        },
      });
    })
  );

  /** Looks a studio image up by filename, so the questions read by what they show. */
  const shot = (name: string) => {
    const found = studioMedia.find((m) => m.fileName === name) ?? studioMedia[0];
    if (!found) throw new Error("No seed imagery found - run generate-seed-images.py");
    return found.id;
  };

  // ── Test 1: ACTIVE — Photo Comparison ────────────────────────────────────
  const existingPhotoTest = await prisma.test.findFirst({
    where: { title: "Photo Preference Study", status: "ACTIVE" },
  });

  let photoTest = existingPhotoTest;
  if (!photoTest) {
    photoTest = await prisma.test.create({
      data: {
        title: "Photo Preference Study",
        description: "Which product packaging catches your eye? Be honest — there are no right or wrong answers.",
        status: "ACTIVE",
        advisoryTimeMin: 4,
        minTimePerQuestion: 60,
        rewardPoints: 5,
        questions: {
          create: [
            {
              type: "SINGLE_SELECT",
              prompt: "Which product image would you click first in an online store?",
              mediaType: "IMAGE",
              order: 1,
              config: {},
              options: {
                create: [
                  { label: "Product A", mediaId: medias[0]!.id, order: 1 },
                  { label: "Product B", mediaId: medias[1]!.id, order: 2 },
                  { label: "Product C", mediaId: medias[2]!.id, order: 3 },
                ],
              },
            },
            {
              type: "SINGLE_SELECT",
              prompt: "Which lifestyle image best represents your ideal brand?",
              mediaType: "IMAGE",
              order: 2,
              config: {},
              options: {
                create: [
                  { label: "Option 1", mediaId: medias[6]!.id, order: 1 },
                  { label: "Option 2", mediaId: medias[7]!.id, order: 2 },
                ],
              },
            },
            {
              type: "RATING",
              prompt: "How appealing is this product packaging overall?",
              mediaType: "IMAGE",
              mediaId: medias[2]!.id,
              order: 3,
              config: { min: 1, max: 5, minLabel: "Not appealing", maxLabel: "Very appealing" },
            },
            {
              type: "RANKING",
              prompt: "Rank these packaging designs from most to least appealing.",
              mediaType: "IMAGE",
              order: 4,
              config: { bestLabel: "Most appealing", worstLabel: "Least appealing" },
              options: {
                create: [
                  { label: "Design A", mediaId: medias[0]!.id, order: 1 },
                  { label: "Design B", mediaId: medias[1]!.id, order: 2 },
                  { label: "Design C", mediaId: medias[2]!.id, order: 3 },
                ],
              },
            },
            {
              type: "SINGLE_SELECT",
              prompt: "Attention check: select the option that says I am paying attention.",
              mediaType: "TEXT",
              order: 5,
              isAttentionCheck: true,
              config: {
                autoGenerated: true,
                correctOptionLabel: "I am paying attention",
              },
              options: {
                create: [
                  { label: "I am paying attention", order: 1 },
                  { label: "Skip this question", order: 2 },
                ],
              },
            },
          ],
        },
      },
    });
  }

  // ── Test 2: ACTIVE — Media Rating ─────────────────────────────────────────
  const existingRatingTest = await prisma.test.findFirst({
    where: { title: "Brand Imagery Rating", status: "ACTIVE" },
  });

  let ratingTest = existingRatingTest;
  if (!ratingTest) {
    ratingTest = await prisma.test.create({
      data: {
        title: "Brand Imagery Rating",
        description: "Rate a series of images on their emotional impact and brand fit.",
        status: "ACTIVE",
        advisoryTimeMin: 3,
        minTimePerQuestion: 60,
        rewardPoints: 6,
        questions: {
          create: [
            {
              type: "RATING",
              prompt: "Rate the emotional warmth of this image.",
              mediaType: "IMAGE",
              mediaId: medias[6]!.id,
              order: 1,
              config: { min: 1, max: 5, minLabel: "Cold", maxLabel: "Warm" },
            },
            {
              type: "RATING",
              prompt: "How trustworthy does this packaging look?",
              mediaType: "IMAGE",
              mediaId: medias[7]!.id,
              order: 2,
              config: { min: 1, max: 5, minLabel: "Untrustworthy", maxLabel: "Very trustworthy" },
            },
            {
              type: "RATING",
              prompt: "How likely are you to pick this off the shelf?",
              mediaType: "IMAGE",
              mediaId: medias[8]!.id,
              order: 3,
              config: { min: 1, max: 10, minLabel: "Not likely", maxLabel: "Definitely" },
            },
          ],
        },
      },
    });
  }

  // ── Test 3: ACTIVE — Coffee Brand Study (one question per type) ───────────
  // The fixture for the mobile swipe engine. Every question type in one active test, on
  // imagery you can actually form a preference about, because a card interaction can only
  // really be judged against a question worth answering.
  const existingStudy = await prisma.test.findFirst({
    where: { title: "Coffee Brand Study", status: "ACTIVE" },
  });

  let studyTest = existingStudy;
  if (!studyTest) {
    studyTest = await prisma.test.create({
      data: {
        title: "Coffee Brand Study",
        description:
          "We are naming and packaging a new single-origin roaster. Tell us which designs land.",
        status: "ACTIVE",
        advisoryTimeMin: 4,
        minTimePerQuestion: 8,
        rewardPoints: 10,
        questions: {
          create: [
            {
              // Two options: the swipe-right / swipe-left card.
              type: "SINGLE_SELECT",
              prompt: "Which bag would you rather pick up off the shelf?",
              mediaType: "IMAGE",
              order: 1,
              config: {},
              options: {
                create: [
                  // Order matters: the first option is the swipe-right choice.
                  { label: "Vertex", mediaId: shot("bag-modern.png"), order: 1 },
                  { label: "Alder", mediaId: shot("bag-heritage.png"), order: 2 },
                ],
              },
            },
            {
              // Three or more options: the docked tap list, no swipe-to-choose.
              type: "SINGLE_SELECT",
              prompt: "Which name sounds most like a coffee you would pay extra for?",
              mediaType: "TEXT",
              order: 2,
              config: {},
              options: {
                create: [
                  { label: "Alder", order: 1 },
                  { label: "Vertex", order: 2 },
                  { label: "Foundry", order: 3 },
                  { label: "Meridian", order: 4 },
                ],
              },
            },
            {
              // Sub-deck: one card per option, include/skip, bounded by min/max.
              type: "MULTI_SELECT",
              prompt: "Which of these feel like the same brand? Pick 2 to 3.",
              mediaType: "IMAGE",
              order: 3,
              config: { minSelections: 2, maxSelections: 3 },
              options: {
                create: [
                  { label: "Golden hour", mediaId: shot("mood-warm.png"), order: 1 },
                  { label: "Early morning", mediaId: shot("mood-cool.png"), order: 2 },
                  { label: "After hours", mediaId: shot("mood-dark.png"), order: 3 },
                  { label: "First light", mediaId: shot("mood-fresh.png"), order: 4 },
                ],
              },
            },
            {
              // Drag-to-target: five pills down the right edge.
              type: "RATING",
              prompt: "How premium does this packaging look to you?",
              mediaType: "IMAGE",
              order: 4,
              config: { min: 1, max: 5, minLabel: "Supermarket", maxLabel: "Specialty" },
              options: {
                create: [{ label: "Foundry", mediaId: shot("bag-stamp.png"), order: 1 }],
              },
            },
            {
              // Drag-to-slot: four cards, four slots, strict order.
              type: "RANKING",
              prompt: "Rank these four bags from best to worst.",
              mediaType: "IMAGE",
              order: 5,
              config: { bestLabel: "Best", worstLabel: "Worst" },
              options: {
                create: [
                  { label: "Alder", mediaId: shot("bag-heritage.png"), order: 1 },
                  { label: "Marlow", mediaId: shot("bag-blush.png"), order: 2 },
                  { label: "Thicket", mediaId: shot("bag-forest.png"), order: 3 },
                  { label: "Meridian", mediaId: shot("bag-cobalt.png"), order: 4 },
                ],
              },
            },
          ],
        },
      },
    });
  }

  // ── Test 3b: ACTIVE — Phase 12 QA Pass ────────────────────────────────────
  // Isolates each interaction Phase 12 touched into its own question, with a prompt that
  // says what to check - so a manual pass can go card by card instead of hunting for the
  // right scenario across the other fixtures. Not a real study; delete freely once the
  // phase ships.
  const existingQaTest = await prisma.test.findFirst({
    where: { title: "Phase 12 QA Pass", status: "ACTIVE" },
  });

  let qaTest = existingQaTest;
  if (!qaTest) {
    qaTest = await prisma.test.create({
      data: {
        title: "Phase 12 QA Pass",
        description: "Design-system and gesture QA fixture - not a real study.",
        status: "ACTIVE",
        advisoryTimeMin: 3,
        minTimePerQuestion: 5,
        rewardPoints: 1,
        questions: {
          create: [
            {
              // Tap a half: opens the full-photo preview (12.1) with a "Choose" button.
              // Also drag the card normally - confirms the preview's tap target isn't
              // stealing the swipe gesture (12.6's TapZone fix).
              type: "SINGLE_SELECT",
              prompt:
                "QA 1/6 - two-option photo: tap a side for the full preview and Choose from it, then answer the next one by swiping instead",
              mediaType: "IMAGE",
              order: 1,
              config: {},
              options: {
                create: [
                  { label: "Heritage bag", mediaId: shot("bag-heritage.png"), order: 1 },
                  { label: "Modern bag", mediaId: shot("bag-modern.png"), order: 2 },
                ],
              },
            },
            {
              // No photo to preview - a tap should commit immediately.
              type: "SINGLE_SELECT",
              prompt: "QA 2/6 - two-option text: tapping a side should commit immediately, no preview",
              mediaType: "TEXT",
              order: 2,
              config: {},
              options: {
                create: [
                  { label: "Left option", order: 1 },
                  { label: "Right option", order: 2 },
                ],
              },
            },
            {
              // 3+ option tap list: the Check icon (12.5) and the scale/fade tap feedback (12.3).
              type: "SINGLE_SELECT",
              prompt: "QA 3/6 - tap list: watch for the selection bump and the checkmark icon fading in",
              mediaType: "TEXT",
              order: 3,
              config: {},
              options: {
                create: [
                  { label: "First", order: 1 },
                  { label: "Second", order: 2 },
                  { label: "Third", order: 3 },
                  { label: "Fourth", order: 4 },
                ],
              },
            },
            {
              // Sub-deck: swipe AND the tap Skip/Pick buttons (12.6), plus hitting the cap.
              type: "MULTI_SELECT",
              prompt: "QA 4/6 - pick 2 to 3: try both swiping and tapping Skip/Pick, and hit the max",
              mediaType: "IMAGE",
              order: 4,
              config: { minSelections: 2, maxSelections: 3 },
              options: {
                create: [
                  { label: "Warm", mediaId: shot("mood-warm.png"), order: 1 },
                  { label: "Cool", mediaId: shot("mood-cool.png"), order: 2 },
                  { label: "Dark", mediaId: shot("mood-dark.png"), order: 3 },
                  { label: "Fresh", mediaId: shot("mood-fresh.png"), order: 4 },
                ],
              },
            },
            {
              // Drag onto a pill, then answer the idea of tapping one directly (12.6) -
              // feel for the haptic tick (12.3) as a pill arms.
              type: "RATING",
              prompt: "QA 5/6 - rating: drag onto a number - then, on your next Rating question, just tap one",
              mediaType: "IMAGE",
              order: 5,
              config: { min: 1, max: 5, minLabel: "Low", maxLabel: "High" },
              options: {
                create: [{ label: "Stamp", mediaId: shot("bag-stamp.png"), order: 1 }],
              },
            },
            {
              // Six slots, not four - room to place a few, reclaim one by tapping a
              // filled slot (12.1), and place the rest by tapping open slots (12.6)
              // instead of dragging every single one.
              type: "RANKING",
              prompt:
                "QA 6/6 - rank all 6: drag a couple, tap a filled slot to pull it back out, tap the rest into open slots",
              mediaType: "IMAGE",
              order: 6,
              config: { bestLabel: "Best", worstLabel: "Worst" },
              options: {
                create: [
                  { label: "Heritage", mediaId: shot("bag-heritage.png"), order: 1 },
                  { label: "Modern", mediaId: shot("bag-modern.png"), order: 2 },
                  { label: "Blush", mediaId: shot("bag-blush.png"), order: 3 },
                  { label: "Forest", mediaId: shot("bag-forest.png"), order: 4 },
                  { label: "Cobalt", mediaId: shot("bag-cobalt.png"), order: 5 },
                  { label: "Stamp", mediaId: shot("bag-stamp.png"), order: 6 },
                ],
              },
            },
          ],
        },
      },
    });
  }

  // ── Test 4: CLOSED — Text Survey (with responses for analytics) ───────────
  const existingClosedTest = await prisma.test.findFirst({
    where: { title: "Consumer Habits Survey", status: "CLOSED" },
  });

  let closedTest = existingClosedTest;
  if (!closedTest) {
    closedTest = await prisma.test.create({
      data: {
        title: "Consumer Habits Survey",
        description: "Help us understand how consumers shop online.",
        status: "CLOSED",
        advisoryTimeMin: 5,
        minTimePerQuestion: 30,
        rewardPoints: 5,
        questions: {
          create: [
            {
              type: "SINGLE_SELECT",
              prompt: "How often do you shop online?",
              mediaType: "TEXT",
              order: 1,
              config: {},
              options: {
                create: [
                  { label: "Daily", order: 1 },
                  { label: "Weekly", order: 2 },
                  { label: "Monthly", order: 3 },
                  { label: "Rarely", order: 4 },
                ],
              },
            },
            {
              type: "MULTI_SELECT",
              prompt: "Which factors most influence your purchase decision?",
              mediaType: "TEXT",
              order: 2,
              config: { minSelections: 1, maxSelections: 3 },
              options: {
                create: [
                  { label: "Price", order: 1 },
                  { label: "Reviews", order: 2 },
                  { label: "Brand reputation", order: 3 },
                  { label: "Packaging", order: 4 },
                  { label: "Sustainability", order: 5 },
                ],
              },
            },
            {
              type: "RATING",
              prompt: "How satisfied are you with your recent online shopping experience?",
              mediaType: "TEXT",
              order: 3,
              config: { min: 1, max: 5, minLabel: "Very unsatisfied", maxLabel: "Very satisfied" },
            },
            {
              type: "RANKING",
              prompt: "Rank these delivery options from most to least important to you.",
              mediaType: "TEXT",
              order: 4,
              config: { bestLabel: "Most important", worstLabel: "Least important" },
              options: {
                create: [
                  { label: "Same-day delivery", order: 1 },
                  { label: "Free shipping", order: 2 },
                  { label: "Package tracking", order: 3 },
                  { label: "Flexible returns", order: 4 },
                ],
              },
            },
          ],
        },
      },
    });
  }

  // ── Generate sample responses for the CLOSED test ────────────────────────
  const closedTestFull = await prisma.test.findUniqueOrThrow({
    where: { id: closedTest.id },
    include: { questions: { include: { options: true }, orderBy: { order: "asc" } } },
  });

  const existingResponseCount = await prisma.testResponse.count({
    where: { testId: closedTest.id },
  });

  if (existingResponseCount < 35) {
    const [q1, q2, q3, q4] = closedTestFull.questions;

    const q1Options = q1?.options ?? [];
    const q2Options = q2?.options ?? [];
    const q4Options = [...(q4?.options ?? [])].sort((a, b) => a.order - b.order);

    const syntheticEvals = [
      { email: "synth1@demo.testx",  dob: "1995-03-10", gender: "MALE"        as const, country: "US", city: "Chicago" },
      { email: "synth2@demo.testx",  dob: "1988-07-14", gender: "FEMALE"      as const, country: "GB", city: "Manchester" },
      { email: "synth3@demo.testx",  dob: "2001-12-01", gender: "MALE"        as const, country: "AU", city: "Melbourne" },
      { email: "synth4@demo.testx",  dob: "1975-05-20", gender: "FEMALE"      as const, country: "CA", city: "Vancouver" },
      { email: "synth5@demo.testx",  dob: "1992-09-08", gender: "MALE"        as const, country: "DE", city: "Munich" },
      { email: "synth6@demo.testx",  dob: "1983-11-25", gender: "FEMALE"      as const, country: "FR", city: "Lyon" },
      { email: "synth7@demo.testx",  dob: "1998-04-17", gender: "MALE"        as const, country: "ES", city: "Barcelona" },
      { email: "synth8@demo.testx",  dob: "1969-02-28", gender: "FEMALE"      as const, country: "US", city: "Seattle" },
      { email: "synth9@demo.testx",  dob: "2003-08-03", gender: "MALE"        as const, country: "IT", city: "Rome" },
      { email: "synth10@demo.testx", dob: "1986-06-11", gender: "FEMALE"      as const, country: "NL", city: "Amsterdam" },
      { email: "synth11@demo.testx", dob: "1994-01-19", gender: "MALE"        as const, country: "US", city: "Los Angeles" },
      { email: "synth12@demo.testx", dob: "1979-10-06", gender: "FEMALE"      as const, country: "GB", city: "Edinburgh" },
      { email: "synth13@demo.testx", dob: "1991-03-22", gender: "MALE"        as const, country: "BR", city: "São Paulo" },
      { email: "synth14@demo.testx", dob: "2002-07-30", gender: "FEMALE"      as const, country: "MX", city: "Mexico City" },
      { email: "synth15@demo.testx", dob: "1984-12-14", gender: "MALE"        as const, country: "JP", city: "Tokyo" },
      // Additional evaluators for richer demographic breakdown in demo analytics
      { email: "synth16@demo.testx", dob: "1972-08-22", gender: "FEMALE"      as const, country: "US", city: "Dallas" },
      { email: "synth17@demo.testx", dob: "1999-05-11", gender: "MALE"        as const, country: "IN", city: "Mumbai" },
      { email: "synth18@demo.testx", dob: "1987-02-03", gender: "FEMALE"      as const, country: "KR", city: "Seoul" },
      { email: "synth19@demo.testx", dob: "2000-11-27", gender: "MALE"        as const, country: "CA", city: "Montreal" },
      { email: "synth20@demo.testx", dob: "1976-04-16", gender: "UNDISCLOSED" as const, country: "SE", city: "Stockholm" },
      { email: "synth21@demo.testx", dob: "1993-07-09", gender: "FEMALE"      as const, country: "US", city: "Miami" },
      { email: "synth22@demo.testx", dob: "1981-09-30", gender: "MALE"        as const, country: "ZA", city: "Cape Town" },
      { email: "synth23@demo.testx", dob: "2004-01-14", gender: "FEMALE"      as const, country: "AU", city: "Brisbane" },
      { email: "synth24@demo.testx", dob: "1967-06-05", gender: "MALE"        as const, country: "DE", city: "Hamburg" },
      { email: "synth25@demo.testx", dob: "1996-10-21", gender: "FEMALE"      as const, country: "GB", city: "Birmingham" },
      { email: "synth26@demo.testx", dob: "1989-03-18", gender: "MALE"        as const, country: "FR", city: "Marseille" },
      { email: "synth27@demo.testx", dob: "2005-08-07", gender: "FEMALE"      as const, country: "US", city: "Phoenix" },
      { email: "synth28@demo.testx", dob: "1973-12-25", gender: "MALE"        as const, country: "NL", city: "Rotterdam" },
      { email: "synth29@demo.testx", dob: "1997-06-30", gender: "FEMALE"      as const, country: "IT", city: "Milan" },
      { email: "synth30@demo.testx", dob: "1985-04-02", gender: "OTHER"       as const, country: "CA", city: "Calgary" },
    ];

    const synthUsers = await Promise.all(
      syntheticEvals.map((seed) =>
        prisma.user.upsert({
          where: { email: seed.email },
          update: {},
          create: {
            email: seed.email,
            passwordHash,
            role: "EVALUATOR",
            isVerified: true,
            evaluatorProfile: {
              create: {
                age: ageFromDob(seed.dob),
                gender: seed.gender,
                country: seed.country,
                city: seed.city,
                balance: 5,
              },
            },
          },
          include: { evaluatorProfile: true },
        })
      )
    );

    const allResponders = [...evaluators, ...synthUsers];

    for (let i = 0; i < allResponders.length; i++) {
      const user = allResponders[i]!;
      const existing = await prisma.testResponse.findUnique({
        where: { testId_userId: { testId: closedTest.id, userId: user.id } },
      });
      if (existing) continue;

      const isFlagged = i === 3;
      const completedAt = new Date(Date.now() - (allResponders.length - i) * 3600 * 1000 * 24);
      const startedAt = new Date(completedAt.getTime() - (180 + i * 10) * 1000);

      const q1OptionPick = q1Options[i % q1Options.length];
      const q2Picks = q2Options
        .slice(0, (i % 3) + 1)
        .map((o) => o.id);
      // Rotating the ranking per responder gives the report a spread of positions to show.
      const q4Ranking = q4Options.map(
        (_, index) => q4Options[(index + i) % q4Options.length]!.id
      );

      await prisma.testResponse.create({
        data: {
          testId: closedTest.id,
          userId: user.id,
          isFlagged,
          flagReasons: isFlagged ? ["SPEED_TOO_FAST"] : [],
          pointsEarned: isFlagged ? 0 : 5,
          startedAt,
          completedAt,
          totalTimeSeconds: Math.round((completedAt.getTime() - startedAt.getTime()) / 1000),
          answers: {
            create: [
              ...(q1 && q1OptionPick
                ? [{ questionId: q1.id, selectedOptions: [q1OptionPick.id], timeSpentSeconds: 30 + (i % 5) * 10 }]
                : []),
              ...(q2 && q2Picks.length > 0
                ? [{ questionId: q2.id, selectedOptions: q2Picks, timeSpentSeconds: 45 + (i % 4) * 15 }]
                : []),
              ...(q3
                ? [{ questionId: q3.id, ratingValue: (i % 5) + 1, timeSpentSeconds: 20 + (i % 3) * 10 }]
                : []),
              ...(q4 && q4Ranking.length > 0
                ? [{ questionId: q4.id, selectedOptions: q4Ranking, timeSpentSeconds: 35 + (i % 4) * 10 }]
                : []),
            ],
          },
        },
      });
    }

    await prisma.evaluatorProfile.updateMany({
      where: { userId: { in: synthUsers.map((u) => u.id) } },
      data: { balance: 5 },
    });
  }

  // ── Templates ────────────────────────────────────────────────────────────
  await prisma.template.upsert({
    where: { name: "Photo Comparison" },
    update: {},
    create: {
      name: "Photo Comparison",
      description: "Single-select image comparison skeleton.",
      isSystem: true,
      structure: {
        questions: Array.from({ length: 5 }, (_, i) => ({
          type: "SINGLE_SELECT",
          prompt: `Photo comparison question ${i + 1}`,
          mediaType: "IMAGE",
          options: [],
        })),
      },
    },
  });

  await prisma.template.upsert({
    where: { name: "Media Rating" },
    update: {},
    create: {
      name: "Media Rating",
      description: "Rating scale skeleton for media concepts.",
      isSystem: true,
      structure: {
        questions: Array.from({ length: 5 }, (_, i) => ({
          type: "RATING",
          prompt: `Rate media item ${i + 1}`,
          mediaType: "IMAGE",
          config: { min: 1, max: 5 },
        })),
      },
    },
  });

  await prisma.template.upsert({
    where: { name: "Text Survey" },
    update: {},
    create: {
      name: "Text Survey",
      description: "Text-only single-select survey skeleton.",
      isSystem: true,
      structure: {
        questions: Array.from({ length: 5 }, (_, i) => ({
          type: "SINGLE_SELECT",
          prompt: `Text survey question ${i + 1}`,
          mediaType: "TEXT",
          options: ["Option A", "Option B", "Option C"],
        })),
      },
    },
  });

  console.log({
    admin: admin.email,
    evaluators: evaluators.length,
    tests: {
      photoTest: photoTest.title,
      ratingTest: ratingTest.title,
      studyTest: studyTest.title,
      qaTest: qaTest.title,
      closedTest: closedTest.title,
    },
    media: medias.length + studioMedia.length,
    imagery: assets.isCustom ? "custom photos" : "generated mockups",
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
