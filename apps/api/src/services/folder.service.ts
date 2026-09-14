import type { PrismaClient } from "@testx/database";
import { FOLDER_MAX_DEPTH } from "@testx/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function notFound(id: string): never {
  throw Object.assign(new Error(`Folder not found: ${id}`), { statusCode: 404 });
}

function conflict(name: string): never {
  throw Object.assign(new Error(`A folder named "${name}" already exists here.`), { statusCode: 409 });
}

/**
 * Count levels above the given parentId. Root-level items have depth 0.
 * Walking the chain is fast enough for the capped depth of 10.
 */
async function computeDepth(prisma: PrismaClient, parentId: string | null): Promise<number> {
  if (!parentId) return 0;
  let depth = 0;
  let currentId: string | null = parentId;
  while (currentId) {
    depth++;
    if (depth > FOLDER_MAX_DEPTH) {
      throw Object.assign(
        new Error(`Maximum folder depth of ${FOLDER_MAX_DEPTH} reached.`),
        { statusCode: 400 }
      );
    }
    const row = await prisma.mediaFolder.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    });
    currentId = row?.parentId ?? null;
  }
  return depth;
}

/**
 * Check that targetParentId is not inside the subtree rooted at folderId,
 * which would create a cycle when moving folderId under targetParentId.
 */
async function wouldCreateCycle(
  prisma: PrismaClient,
  folderId: string,
  targetParentId: string | null,
): Promise<boolean> {
  if (!targetParentId) return false;
  let currentId: string | null = targetParentId;
  while (currentId) {
    if (currentId === folderId) return true;
    const row = await prisma.mediaFolder.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    });
    currentId = row?.parentId ?? null;
  }
  return false;
}

/**
 * Enforce unique (parentId, name). PostgreSQL NULL != NULL in a unique index, so
 * root-level uniqueness is enforced here in addition to the DB partial index.
 */
async function assertNameUnique(
  prisma: PrismaClient,
  name: string,
  parentId: string | null,
  excludeId?: string,
): Promise<void> {
  const existing = await prisma.mediaFolder.findFirst({
    where: {
      parentId: parentId ?? null,
      name,
      id: excludeId ? { not: excludeId } : undefined,
    },
    select: { id: true },
  });
  if (existing) conflict(name);
}

// ---------------------------------------------------------------------------
// Serializer
// ---------------------------------------------------------------------------

function serializeFolder(
  row: { id: string; name: string; parentId: string | null; createdAt: Date; updatedAt: Date }
) {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parentId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** List direct children of a folder, or root-level folders when parentId is null. */
export async function listFolders(
  prisma: PrismaClient,
  parentId: string | null = null,
) {
  const rows = await prisma.mediaFolder.findMany({
    where: { parentId: parentId ?? null },
    orderBy: { name: "asc" },
    include: { _count: { select: { media: true } } },
  });
  return rows.map((r) => ({
    ...serializeFolder(r),
    mediaCount: r._count.media,
  }));
}

/** Return the entire folder tree as a flat list with parentId links. */
export async function listAllFolders(prisma: PrismaClient) {
  const rows = await prisma.mediaFolder.findMany({
    orderBy: [{ parentId: "asc" }, { name: "asc" }],
    include: { _count: { select: { media: true } } },
  });
  return rows.map((r) => ({
    ...serializeFolder(r),
    mediaCount: r._count.media,
  }));
}

/** Return the ancestor chain of a folder as an ordered breadcrumb path (root → leaf). */
export async function getFolderPath(
  prisma: PrismaClient,
  id: string,
): Promise<Array<{ id: string; name: string }>> {
  const crumbs: Array<{ id: string; name: string }> = [];
  let currentId: string | null = id;
  while (currentId) {
    const row = await prisma.mediaFolder.findUnique({
      where: { id: currentId },
      select: { id: true, name: true, parentId: true },
    });
    if (!row) break;
    crumbs.unshift({ id: row.id, name: row.name });
    currentId = row.parentId;
  }
  return crumbs;
}

export async function createFolder(
  prisma: PrismaClient,
  name: string,
  parentId: string | null = null,
) {
  name = name.trim();
  if (!name) {
    throw Object.assign(new Error("Folder name cannot be empty."), { statusCode: 400 });
  }
  if (name.length > 255) {
    throw Object.assign(new Error("Folder name must be 255 characters or fewer."), { statusCode: 400 });
  }

  // Validate parent exists
  if (parentId) {
    const parent = await prisma.mediaFolder.findUnique({ where: { id: parentId }, select: { id: true } });
    if (!parent) notFound(parentId);
  }

  // Depth: the new folder will be at depth = parent's depth + 1
  const parentDepth = await computeDepth(prisma, parentId);
  if (parentDepth >= FOLDER_MAX_DEPTH) {
    throw Object.assign(
      new Error(`Maximum folder depth of ${FOLDER_MAX_DEPTH} reached.`),
      { statusCode: 400 }
    );
  }

  await assertNameUnique(prisma, name, parentId);

  const row = await prisma.mediaFolder.create({
    data: { name, parentId: parentId ?? null },
  });
  return serializeFolder(row);
}

export async function renameFolder(prisma: PrismaClient, id: string, name: string) {
  name = name.trim();
  if (!name) {
    throw Object.assign(new Error("Folder name cannot be empty."), { statusCode: 400 });
  }
  if (name.length > 255) {
    throw Object.assign(new Error("Folder name must be 255 characters or fewer."), { statusCode: 400 });
  }

  const folder = await prisma.mediaFolder.findUnique({ where: { id } });
  if (!folder) notFound(id);

  await assertNameUnique(prisma, name, folder.parentId, id);

  const updated = await prisma.mediaFolder.update({ where: { id }, data: { name } });
  return serializeFolder(updated);
}

export async function moveFolder(
  prisma: PrismaClient,
  id: string,
  newParentId: string | null,
) {
  const folder = await prisma.mediaFolder.findUnique({ where: { id } });
  if (!folder) notFound(id);

  if (newParentId === id) {
    throw Object.assign(new Error("A folder cannot be its own parent."), { statusCode: 400 });
  }

  if (newParentId) {
    const target = await prisma.mediaFolder.findUnique({ where: { id: newParentId }, select: { id: true } });
    if (!target) notFound(newParentId);

    if (await wouldCreateCycle(prisma, id, newParentId)) {
      throw Object.assign(new Error("Moving this folder would create a cycle."), { statusCode: 400 });
    }
  }

  // Depth after the move
  const targetDepth = await computeDepth(prisma, newParentId);
  if (targetDepth >= FOLDER_MAX_DEPTH) {
    throw Object.assign(
      new Error(`Maximum folder depth of ${FOLDER_MAX_DEPTH} reached.`),
      { statusCode: 400 }
    );
  }

  await assertNameUnique(prisma, folder.name, newParentId, id);

  const updated = await prisma.mediaFolder.update({
    where: { id },
    data: { parentId: newParentId },
  });
  return serializeFolder(updated);
}

/**
 * Delete a folder. Blocks if any media inside (recursively) is referenced by a
 * question or option, unless `force` is true (which orphans those media to root).
 */
export async function deleteFolder(
  prisma: PrismaClient,
  id: string,
  force = false,
): Promise<void> {
  const folder = await prisma.mediaFolder.findUnique({ where: { id } });
  if (!folder) notFound(id);

  // Collect all folder IDs in the subtree (BFS)
  const subtreeIds: string[] = [id];
  const queue = [id];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = await prisma.mediaFolder.findMany({
      where: { parentId: current },
      select: { id: true },
    });
    for (const child of children) {
      subtreeIds.push(child.id);
      queue.push(child.id);
    }
  }

  // Collect all media IDs in the subtree
  const mediaInSubtree = await prisma.media.findMany({
    where: { folderId: { in: subtreeIds } },
    select: { id: true, fileName: true },
  });
  const mediaIds = mediaInSubtree.map((m) => m.id);

  if (mediaIds.length > 0) {
    // Check if any of these media are referenced
    const [questionRefs, optionRefs] = await Promise.all([
      prisma.question.findMany({
        where: { mediaId: { in: mediaIds } },
        select: { id: true, testId: true },
      }),
      prisma.questionOption.findMany({
        where: { mediaId: { in: mediaIds } },
        select: { id: true },
      }),
    ]);

    const hasRefs = questionRefs.length > 0 || optionRefs.length > 0;
    if (hasRefs && !force) {
      const referencedNames = mediaInSubtree
        .filter((m) =>
          questionRefs.some((q) => q.id === m.id) ||
          optionRefs.some((o) => o.id === m.id)
        )
        .map((m) => m.fileName)
        .slice(0, 5)
        .join(", ");
      throw Object.assign(
        new Error(
          `This folder contains media referenced by existing tests (${referencedNames}${
            mediaInSubtree.length > 5 ? "…" : ""
          }). Use force=true to delete anyway, which will unlink those references.`
        ),
        { statusCode: 409 }
      );
    }
  }

  // Delete all sub-folders (cascade will set media.folderId → null via ON DELETE SET NULL)
  // Delete deepest first to satisfy FK constraints, then the root folder last.
  // Since ON DELETE SET NULL is set on MediaFolder.parentId, we can delete top-down and
  // children's parentId gets nulled. But to actually remove the folder rows we go bottom-up.
  // Simplest: delete all subtree folders except root, then root.
  const nonRootIds = subtreeIds.filter((fid) => fid !== id);
  if (nonRootIds.length > 0) {
    await prisma.mediaFolder.deleteMany({ where: { id: { in: nonRootIds } } });
  }
  await prisma.mediaFolder.delete({ where: { id } });
}

/** Get or create intermediate folders for a slash-separated path, starting from folderId. */
export async function ensureFolderPath(
  prisma: PrismaClient,
  segments: string[],
  rootFolderId: string | null = null,
): Promise<string | null> {
  let currentParentId: string | null = rootFolderId;
  for (const raw of segments) {
    const name = raw.trim();
    if (!name) continue;
    let existing = await prisma.mediaFolder.findFirst({
      where: { parentId: currentParentId, name },
      select: { id: true },
    });
    if (!existing) {
      const depth = await computeDepth(prisma, currentParentId);
      if (depth >= FOLDER_MAX_DEPTH) {
        throw Object.assign(
          new Error(`Maximum folder depth of ${FOLDER_MAX_DEPTH} reached while creating path.`),
          { statusCode: 400 }
        );
      }
      existing = await prisma.mediaFolder.create({
        data: { name, parentId: currentParentId },
        select: { id: true },
      });
    }
    currentParentId = existing.id;
  }
  return currentParentId;
}
