import type { FileMediaType, MediaSourceType } from "../constants";

export type Media = {
  id: string;
  fileName: string;
  fileType: FileMediaType;
  mimeType: string;
  fileSize: number;
  sourceType: MediaSourceType;
  sourceUrl: string | null;
  thumbnailUrl: string | null;
  tags: string[];
  uploadedAt: string;
};
