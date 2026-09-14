import type { MediaType, MediaSourceType } from "../constants";

export type MediaFolder = {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  /** Included when the caller requests the full tree. */
  children?: MediaFolder[];
  /** Number of direct media items (included in flat list responses). */
  mediaCount?: number;
};

export type Media = {
  id: string;
  fileName: string;
  fileType: MediaType;
  mimeType: string;
  fileSize: number;
  sourceType: MediaSourceType;
  sourceUrl: string | null;
  thumbnailUrl: string | null;
  tags: string[];
  uploadedAt: string;
  folderId: string | null;
  /** Populated only when fileType === "TEXT". */
  textContent: string | null;
};
