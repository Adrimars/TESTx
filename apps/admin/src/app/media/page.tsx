"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog, Input } from "@testx/ui";
import type { Media } from "@testx/shared";
import { apiFetch } from "@/lib/api";

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

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
  function openUploadDialog() {
    setSelectedFile(null);
    setUploadError("");
    uploadDialogRef.current?.showModal();
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);
    setUploadError("");
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const res = await fetch(`${API_URL}/admin/media/upload`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? `Upload failed (${res.status})`);
      }
      uploadDialogRef.current?.close();
      await fetchMedia();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
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
    deleteDialogRef.current?.showModal();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/admin/media/${deleteTarget.id}`, { method: "DELETE" });
      deleteDialogRef.current?.close();
      await fetchMedia();
    } catch {
      // silently close — rare failure
      deleteDialogRef.current?.close();
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
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
      <Dialog ref={uploadDialogRef} className="w-full max-w-md">
        <div className="p-6 space-y-4">
          <CardHeader className="p-0">
            <CardTitle>Upload File</CardTitle>
          </CardHeader>
          <div
            className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-8 text-sm text-muted-foreground hover:bg-muted/50"
            onClick={() => fileInputRef.current?.click()}
          >
            <span className="text-2xl">📁</span>
            {selectedFile ? (
              <span className="font-medium text-foreground">{selectedFile.name}</span>
            ) : (
              <span>Click to select an image, video, or audio file</span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,audio/*"
              className="hidden"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            />
          </div>
          {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => uploadDialogRef.current?.close()} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={!selectedFile || uploading}>
              {uploading ? "Uploading…" : "Upload"}
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
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => deleteDialogRef.current?.close()} disabled={deleting}>
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
