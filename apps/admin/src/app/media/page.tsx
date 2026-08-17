"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog, Input } from "@testx/ui";
import type { Media } from "@testx/shared";
import { apiFetch } from "@/lib/api";
import type { UploadResult } from "@/lib/admin-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type MediaListResponse = { items: Media[]; total: number; page: number; limit: number };

const FILE_TYPE_TABS = [
  { label: "All", value: "" },
  { label: "Images", value: "IMAGE" },
  { label: "Videos", value: "VIDEO" },
  { label: "Audio", value: "AUDIO" },
] as const;

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function MediaThumbnail({ media }: { media: Media }) {
  if (media.fileType === "IMAGE") {
    return (
      <img
        src={`${API_URL}/media/${media.id}/file`}
        alt={media.fileName}
        className="h-full w-full object-cover"
        loading="lazy"
      />
    );
  }
  const icon = media.fileType === "VIDEO" ? "🎬" : "🎵";
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted text-3xl">
      {icon}
    </div>
  );
}

export default function MediaPage() {
  const [items, setItems] = useState<Media[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Upload dialog
  const uploadDialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  type FileStatus = { file: File; status: "pending" | "uploading" | "done" | "error"; error?: string };
  const [fileQueue, setFileQueue] = useState<FileStatus[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Drive import dialog
  const driveDialogRef = useRef<HTMLDialogElement>(null);
  const [driveUrl, setDriveUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [driveResult, setDriveResult] = useState<{ count: number } | null>(null);
  const [driveError, setDriveError] = useState("");

  // Delete confirm dialog
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<Media | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchMedia = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: "1", limit: "50" });
      if (activeTab) params.set("fileType", activeTab);
      if (debouncedSearch) params.set("search", debouncedSearch);
      const data = await apiFetch<MediaListResponse>(`/admin/media?${params}`);
      setItems(data.items);
      setTotal(data.total);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, debouncedSearch]);

  useEffect(() => {
    void fetchMedia();
  }, [fetchMedia]);

  // Upload flow
  function addFiles(files: FileList | File[]) {
    const accepted = Array.from(files).filter((f) =>
      f.type.startsWith("image/") || f.type.startsWith("video/") || f.type.startsWith("audio/")
    );
    setFileQueue((prev) => [
      ...prev,
      ...accepted.map((file) => ({ file, status: "pending" as const })),
    ]);
  }

  function openUploadDialog() {
    setFileQueue([]);
    uploadDialogRef.current?.showModal();
  }

  function handleDropzoneDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  }

  async function handleUpload() {
    if (fileQueue.length === 0 || uploading) return;
    setUploading(true);

    // Snapshot the batch: files added while this request is in flight are not part
    // of it and must keep their own status.
    const batch = fileQueue.map((item) => item.file);
    const inBatch = new Set(batch);

    const formData = new FormData();
    batch.forEach((file) => formData.append("file", file));

    setFileQueue((prev) =>
      prev.map((item) => (inBatch.has(item.file) ? { ...item, status: "uploading" as const } : item))
    );

    try {
      const res = await fetch(`${API_URL}/admin/media/upload`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const body = (await res.json()) as UploadResult | { message?: string };

      if (!res.ok || !("results" in body)) {
        const msg = (body as { message?: string }).message ?? `Upload failed (${res.status})`;
        setFileQueue((prev) =>
          prev.map((item) => (inBatch.has(item.file) ? { ...item, status: "error", error: msg } : item))
        );
      } else {
        // The server returns one result per file in the order they were sent, so pair
        // them up by position. Filenames are not unique within a batch.
        const resultByFile = new Map(batch.map((file, i) => [file, body.results[i]]));
        setFileQueue((prev) =>
          prev.map((item) => {
            if (!inBatch.has(item.file)) return item;
            const result = resultByFile.get(item.file);
            if (!result) return { ...item, status: "error", error: "No result returned" };
            if (result.error) return { ...item, status: "error", error: result.error };
            return { ...item, status: "done" };
          })
        );
        await fetchMedia();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setFileQueue((prev) =>
        prev.map((item) => (inBatch.has(item.file) ? { ...item, status: "error", error: msg } : item))
      );
    } finally {
      setUploading(false);
    }
  }

  // Drive import flow
  function openDriveDialog() {
    setDriveUrl("");
    setDriveResult(null);
    setDriveError("");
    driveDialogRef.current?.showModal();
  }

  async function handleDriveImport() {
    if (!driveUrl.trim()) return;
    setImporting(true);
    setDriveResult(null);
    setDriveError("");
    try {
      const result = await apiFetch<{ count: number; items: Media[] }>("/admin/media/import-drive", {
        method: "POST",
        body: JSON.stringify({ folderUrl: driveUrl.trim() }),
      });
      setDriveResult({ count: result.count });
      await fetchMedia();
    } catch (err: unknown) {
      setDriveError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  // Delete flow
  function openDeleteDialog(media: Media) {
    setDeleteTarget(media);
    setDeleteError("");
    deleteDialogRef.current?.showModal();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/admin/media/${deleteTarget.id}`, { method: "DELETE" });
      deleteDialogRef.current?.close();
      setDeleteTarget(null);
      await fetchMedia();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Media Library</h1>
          <p className="text-sm text-muted-foreground">{total} file{total !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={openDriveDialog}>Import from Drive</Button>
          <Button onClick={openUploadDialog}>Upload</Button>
        </div>
      </div>

      {/* Filter + Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-1 rounded-lg border border-border bg-muted p-1">
          {FILE_TYPE_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                activeTab === tab.value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Input
          placeholder="Search by filename…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground">
          <span>No media yet.</span>
          <span>Upload a file or import from Google Drive.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((media) => (
            <Card key={media.id} className="overflow-hidden">
              <div className="relative aspect-video bg-muted">
                <MediaThumbnail media={media} />
                <button
                  onClick={() => openDeleteDialog(media)}
                  className="absolute right-2 top-2 rounded-md bg-black/60 p-1.5 text-white opacity-0 transition hover:bg-black/80 group-hover:opacity-100 focus:opacity-100"
                  aria-label="Delete"
                  title="Delete"
                >
                  🗑
                </button>
              </div>
              <CardContent className="p-3">
                <p className="truncate text-sm font-medium" title={media.fileName}>{media.fileName}</p>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <Badge>{media.fileType}</Badge>
                  <span className="text-xs text-muted-foreground">{formatBytes(media.fileSize)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{formatDate(media.uploadedAt)}</span>
                  <button
                    onClick={() => openDeleteDialog(media)}
                    className="text-xs text-destructive hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog ref={uploadDialogRef} className="w-full max-w-lg">
        <div className="p-6 space-y-4">
          <CardHeader className="p-0">
            <CardTitle>Upload Files</CardTitle>
          </CardHeader>

          {/* Dropzone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDropzoneDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 text-sm transition-colors ${
              isDragging
                ? "border-primary bg-primary/5 text-primary"
                : "border-border text-muted-foreground hover:bg-muted/50"
            }`}
          >
            <span className="text-2xl">📁</span>
            <span>Drag files here or <span className="font-medium text-primary underline">browse</span></span>
            <span className="text-xs">Images, videos, and audio files</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,audio/*"
              multiple
              className="hidden"
              onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
            />
          </div>

          {/* File list */}
          {fileQueue.length > 0 && (
            <ul className="max-h-48 space-y-1.5 overflow-y-auto">
              {fileQueue.map((item, i) => (
                <li key={i} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">{item.file.name}</span>
                  <span className={`shrink-0 text-xs font-medium ${
                    item.status === "done" ? "text-green-600" :
                    item.status === "error" ? "text-destructive" :
                    item.status === "uploading" ? "text-primary" :
                    "text-muted-foreground"
                  }`}>
                    {item.status === "done" ? "✓ Done" :
                     item.status === "error" ? `✗ ${item.error ?? "Error"}` :
                     item.status === "uploading" ? "Uploading…" :
                     "Pending"}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => uploadDialogRef.current?.close()} disabled={uploading}>
              {fileQueue.some((f) => f.status === "done") ? "Close" : "Cancel"}
            </Button>
            <Button
              onClick={handleUpload}
              disabled={fileQueue.length === 0 || uploading || fileQueue.every((f) => f.status === "done")}
            >
              {uploading ? "Uploading…" : `Upload ${fileQueue.length > 0 ? `(${fileQueue.length})` : ""}`}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Drive Import Dialog */}
      <Dialog ref={driveDialogRef} className="w-full max-w-md">
        <div className="p-6 space-y-4">
          <CardHeader className="p-0">
            <CardTitle>Import from Google Drive</CardTitle>
            <p className="text-sm text-muted-foreground">Paste a public Google Drive folder URL.</p>
          </CardHeader>
          <Input
            placeholder="https://drive.google.com/drive/folders/…"
            value={driveUrl}
            onChange={(e) => setDriveUrl(e.target.value)}
            disabled={importing}
          />
          {driveError && <p className="text-sm text-destructive">{driveError}</p>}
          {driveResult && (
            <p className="text-sm text-green-600">
              ✓ Imported {driveResult.count} file{driveResult.count !== 1 ? "s" : ""} successfully.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => driveDialogRef.current?.close()} disabled={importing}>
              {driveResult ? "Close" : "Cancel"}
            </Button>
            {!driveResult && (
              <Button onClick={handleDriveImport} disabled={!driveUrl.trim() || importing}>
                {importing ? "Importing…" : "Import"}
              </Button>
            )}
          </div>
        </div>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog ref={deleteDialogRef} className="w-full max-w-sm">
        <div className="p-6 space-y-4">
          <CardHeader className="p-0">
            <CardTitle>Delete media?</CardTitle>
            <p className="text-sm text-muted-foreground">
              &ldquo;{deleteTarget?.fileName}&rdquo; will be permanently removed.
            </p>
          </CardHeader>
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                deleteDialogRef.current?.close();
                setDeleteTarget(null);
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              className="bg-destructive text-destructive-foreground hover:opacity-90"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
