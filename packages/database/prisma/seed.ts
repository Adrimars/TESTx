import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@testx.local" },
    update: {},
    create: {
      email: "admin@testx.local",
      passwordHash,
      role: "ADMIN",
      isVerified: true,
    },
  });

  const evaluator = await prisma.user.upsert({
    where: { email: "evaluator@testx.local" },
    update: {},
    create: {
      email: "evaluator@testx.local",
      passwordHash,
      role: "EVALUATOR",
      isVerified: true,
      evaluatorProfile: {
        create: {
          dateOfBirth: new Date("1996-04-12"),
          gender: "FEMALE",
          country: "US",
          city: "Austin",
          balance: 0,
        },
      },
    },
    include: { evaluatorProfile: true },
  });

  const media = await prisma.media.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      fileName: "sample-product-a.jpg",
      fileType: "IMAGE",
      mimeType: "image/jpeg",
      fileSize: 102400,
      sourceType: "UPLOAD",
      sourceUrl: "/uploads/sample-product-a.jpg",
      tags: ["sample", "photo"],
    },
  });

  const test = await prisma.test.create({
    data: {
      title: "Sample Photo Preference Test",
      description: "Pick the option that feels most appealing.",
      status: "ACTIVE",
      advisoryTimeMin: 3,
      minTimePerQuestion: 60,
      rewardPoints: 4,
      questions: {
        create: [
          {
            type: "SINGLE_SELECT",
            prompt: "Which product image would you click first?",
            mediaType: "IMAGE",
            order: 1,
            config: {},
            options: {
              create: [
                { label: "Product A", mediaId: media.id, order: 1 },
                { label: "Product B", order: 2 },
              ],
            },
          },
          {
            type: "RATING",
            prompt: "How clear is the product presentation?",
            mediaType: "IMAGE",
            order: 2,
            config: { min: 1, max: 5, minLabel: "Unclear", maxLabel: "Very clear" },
          },
        ],
      },
    },
  });

  await prisma.template.upsert({
    where: { name: "Photo Comparison" },
    update: {},
    create: {
      name: "Photo Comparison",
      description: "Single-select image comparison skeleton.",
      isSystem: true,
      structure: {
        questions: Array.from({ length: 5 }, (_, index) => ({
          type: "SINGLE_SELECT",
          prompt: `Photo comparison question ${index + 1}`,
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
        questions: Array.from({ length: 5 }, (_, index) => ({
          type: "RATING",
          prompt: `Rate media item ${index + 1}`,
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
        questions: Array.from({ length: 5 }, (_, index) => ({
          type: "SINGLE_SELECT",
          prompt: `Text survey question ${index + 1}`,
          mediaType: "TEXT",
          options: ["Option A", "Option B", "Option C"],
        })),
      },
    },
  });

  console.log({ admin: admin.email, evaluator: evaluator.email, test: test.title });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
