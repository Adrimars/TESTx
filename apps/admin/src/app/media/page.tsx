"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  CloudUpload,
  FileArchive,
  FileAudio,
  FileJson,
  FileText,
  FileVideo,
  Folder,
  FolderOpen,
  FolderPlus,
  FolderUp,
  Pencil,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  IconButton,
  Input,
  PageHeader,
} from "@testx/ui";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/status";
import type {
  AdminMedia,
  AdminMediaFolder,
  FolderUploadResult,
  UploadResult,
} from "@/lib/admin-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MediaListResponse = { items: AdminMedia[]; total: number; page: number; limit: number };
type FolderListResponse = { items: AdminMediaFolder[] };

const FILE_TYPE_TABS = [
  { label: "All", value: "" },
  { label: "Images", value: "IMAGE" },
  { label: "Videos", value: "VIDEO" },
  { label: "Audio", value: "AUDIO" },
  { label: "Text", value: "TEXT" },
  { label: "JSON", value: "JSON" },
] as const;

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function buildTree(flat: AdminMediaFolder[]): AdminMediaFolder[] {
  const byId = new Map(flat.map((f) => [f.id, { ...f, children: [] as AdminMediaFolder[] }]));
  const roots: AdminMediaFolder[] = [];
  for (const f of byId.values()) {
    if (f.parentId) {
      byId.get(f.parentId)?.children?.push(f);
    } else {
      roots.push(f);
    }
  }
  return roots;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MediaThumbnail({ media }: { media: AdminMedia }) {
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
  if (media.fileType === "VIDEO") {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
        <FileVideo className="size-8" aria-hidden />
      </div>
    );
  }
  if (media.fileType === "AUDIO") {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
        <FileAudio className="size-8" aria-hidden />
      </div>
    );
  }
  // JSON
  if (media.fileType === "JSON") {
    const preview = media.textContent?.slice(0, 120) ?? "";
    return (
      <div className="flex h-full w-full flex-col items-start justify-start overflow-hidden bg-muted p-3 text-left">
        <FileJson className="mb-1 size-5 shrink-0 text-primary" aria-hidden />
        <p className="line-clamp-4 text-xs text-muted-foreground leading-relaxed break-words font-mono w-full">
          {preview || <em className="opacity-50">Empty</em>}
        </p>
      </div>
    );
  }
  // TEXT
  const preview = media.textContent?.slice(0, 120) ?? "";
  return (
    <div className="flex h-full w-full flex-col items-start justify-start overflow-hidden bg-muted p-3 text-left">
      <FileText className="mb-1 size-5 shrink-0 text-muted-foreground" aria-hidden />
      <p className="line-clamp-4 text-xs text-muted-foreground leading-relaxed break-words whitespace-pre-wrap w-full">
        {preview || <em className="opacity-50">Empty</em>}
      </p>
    </div>
  );
}

function FolderNode({
  folder,
  activeFolderId,
  onNavigate,
  onDropMedia,
  level = 0,
}: {
  folder: AdminMediaFolder;
  activeFolderId: string | null;
  onNavigate: (id: string | null) => void;
  onDropMedia?: (mediaId: string, folderId: string) => void;
  level?: number;
}) {
  const [open, setOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const hasChildren = (folder.children?.length ?? 0) > 0;
  const isActive = folder.id === activeFolderId;

  return (
    <div>
      <button
        type="button"
        onClick={() => { onNavigate(folder.id); if (hasChildren) setOpen((o) => !o); }}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
          const mediaId = e.dataTransfer.getData("mediaId");
          if (mediaId && onDropMedia) onDropMedia(mediaId, folder.id);
        }}
        className={`flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-sm text-left transition-colors ${
          dragOver
            ? "bg-primary/20 text-primary ring-1 ring-primary/40"
            : isActive
            ? "bg-primary/10 text-primary font-medium"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        }`}
        style={{ paddingLeft: `${8 + level * 12}px` }}
      >
        {hasChildren ? (
          <ChevronRight
            className={`size-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
            aria-hidden
          />
        ) : (
          <span className="size-3 shrink-0" />
        )}
        {isActive ? (
          <FolderOpen className="size-3.5 shrink-0" aria-hidden />
        ) : (
          <Folder className="size-3.5 shrink-0" aria-hidden />
        )}
        <span className="truncate">{folder.name}</span>
        {(folder.mediaCount ?? 0) > 0 && (
          <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
            {folder.mediaCount}
          </span>
        )}
      </button>
      {open && hasChildren && (
        <div>
          {folder.children?.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              activeFolderId={activeFolderId}
              onNavigate={onNavigate}
              onDropMedia={onDropMedia}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FolderDropCard({
  folder,
  onNavigate,
  onDropMedia,
  onRename,
  onDelete,
}: {
  folder: AdminMediaFolder;
  onNavigate: (id: string) => void;
  onDropMedia: (mediaId: string) => void;
  onRename: (folder: AdminMediaFolder) => void;
  onDelete: (folder: AdminMediaFolder) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <Card
      className={`group cursor-pointer overflow-hidden transition-colors ${
        dragOver ? "border-primary ring-2 ring-primary/30" : "hover:border-primary/40"
      }`}
      onClick={() => onNavigate(folder.id)}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        const mediaId = e.dataTransfer.getData("mediaId");
        if (mediaId) onDropMedia(mediaId);
      }}
    >
      <div className={`flex aspect-video items-center justify-center transition-colors ${dragOver ? "bg-primary/10" : "bg-muted/50"}`}>
        <Folder className={`size-10 ${dragOver ? "text-primary" : "text-muted-foreground"}`} aria-hidden />
      </div>
      <CardContent className="p-3">
        <p className="truncate text-sm font-medium text-foreground">{folder.name}</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {folder.mediaCount ?? 0} file{folder.mediaCount !== 1 ? "s" : ""}
          </span>
          <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <IconButton
              variant="ghost"
              aria-label="Rename folder"
              onClick={(e) => { e.stopPropagation(); onRename(folder); }}
            >
              <Pencil className="size-3.5" aria-hidden />
            </IconButton>
            <IconButton
              variant="ghost"
              aria-label="Delete folder"
              className="text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(folder); }}
            >
              <Trash2 className="size-3.5" aria-hidden />
            </IconButton>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function MediaPage() {
  const router = useRouter();

  // ── State ────────────────────────────────────────────────────────────────

  const [items, setItems] = useState<AdminMedia[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [allFolders, setAllFolders] = useState<AdminMediaFolder[]>([]);
  const [folderTree, setFolderTree] = useState<AdminMediaFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<Array<{ id: string; name: string }>>([]);

  const [viewingTextMedia, setViewingTextMedia] = useState<AdminMedia | null>(null);

  // Upload dialog
  const uploadDialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dirInputRef = useRef<HTMLInputElement>(null);

  type FileStatus = {
    file: File;
    relativePath: string;
    kind: "file" | "dir" | "zip";
    status: "pending" | "uploading" | "done" | "error";
    error?: string;
  };
  const [fileQueue, setFileQueue] = useState<FileStatus[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // New folder dialog
  const newFolderDialogRef = useRef<HTMLDialogElement>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderError, setNewFolderError] = useState("");
  const [newFolderLoading, setNewFolderLoading] = useState(false);

  // Rename folder dialog
  const renameFolderDialogRef = useRef<HTMLDialogElement>(null);
  const [renameFolderTarget, setRenameFolderTarget] = useState<AdminMediaFolder | null>(null);
  const [renameFolderName, setRenameFolderName] = useState("");
  const [renameFolderError, setRenameFolderError] = useState("");
  const [renameFolderLoading, setRenameFolderLoading] = useState(false);

  // Delete folder confirm
  const deleteFolderDialogRef = useRef<HTMLDialogElement>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<AdminMediaFolder | null>(null);
  const [deleteFolderError, setDeleteFolderError] = useState("");
  const [deleteFolderLoading, setDeleteFolderLoading] = useState(false);

  // Drive import dialog
  const driveDialogRef = useRef<HTMLDialogElement>(null);
  const [driveUrl, setDriveUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [driveResult, setDriveResult] = useState<{ count: number } | null>(null);
  const [driveError, setDriveError] = useState("");

  // Delete media confirm
  const deleteMediaDialogRef = useRef<HTMLDialogElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminMedia | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Drag-to-folder
  const [dragOverRootSidebar, setDragOverRootSidebar] = useState(false);
  const isDraggingMedia = useRef(false);

  // ── Debounce search ──────────────────────────────────────────────────────

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // ── Fetchers ─────────────────────────────────────────────────────────────

  const fetchFolders = useCallback(async () => {
    try {
      const data = await apiFetch<FolderListResponse>("/admin/media/folders?all=true");
      setAllFolders(data.items);
      setFolderTree(buildTree(data.items));
    } catch {
      setAllFolders([]);
      setFolderTree([]);
    }
  }, []);

  const fetchMedia = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: "1", limit: "50" });
      if (activeTab) params.set("fileType", activeTab);
      if (debouncedSearch) params.set("search", debouncedSearch);
      // When searching across all, don't filter by folder
      if (!debouncedSearch && activeFolderId !== undefined) {
        params.set("folderId", activeFolderId ?? "");
      }
      const data = await apiFetch<MediaListResponse>(`/admin/media?${params}`);
      setItems(data.items);
      setTotal(data.total);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, debouncedSearch, activeFolderId]);

  const fetchBreadcrumb = useCallback(async () => {
    if (!activeFolderId) { setBreadcrumb([]); return; }
    try {
      const data = await apiFetch<{ path: Array<{ id: string; name: string }> }>(
        `/admin/media/folders/${activeFolderId}/path`
      );
      setBreadcrumb(data.path);
    } catch {
      setBreadcrumb([]);
    }
  }, [activeFolderId]);

  useEffect(() => { void fetchFolders(); }, [fetchFolders]);
  useEffect(() => { void fetchMedia(); }, [fetchMedia]);
  useEffect(() => { void fetchBreadcrumb(); }, [fetchBreadcrumb]);

  function refresh() {
    void fetchFolders();
    void fetchMedia();
  }

  // ── Navigation ───────────────────────────────────────────────────────────

  function navigate(id: string | null) {
    setActiveFolderId(id);
    setSearch("");
  }

  // ── Upload helpers ───────────────────────────────────────────────────────

  function addFiles(files: FileList | File[], kind: "file" | "zip" = "file") {
    const next: FileStatus[] = [];
    for (const file of Array.from(files)) {
      const isZip =
        file.name.toLowerCase().endsWith(".zip") ||
        file.type === "application/zip" ||
        file.type === "application/x-zip-compressed";
      next.push({ file, relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name, kind: isZip ? "zip" : kind, status: "pending" });
    }
    setFileQueue((prev) => [...prev, ...next]);
  }

  function addDirFiles(files: FileList) {
    const next: FileStatus[] = Array.from(files).map((file) => ({
      file,
      relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
      kind: "dir" as const,
      status: "pending" as const,
    }));
    setFileQueue((prev) => [...prev, ...next]);
  }

  function openUploadDialog() {
    setFileQueue([]);
    uploadDialogRef.current?.showModal();
  }

  async function handleDropzoneDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);

    // Internal media drag — handled by folder drop targets, not this handler
    if (e.dataTransfer.getData("mediaId")) return;

    const dtItems = e.dataTransfer.items;
    if (!dtItems || dtItems.length === 0) return;

    // Check if any item is a directory via webkitGetAsEntry
    const entriesHaveDir = Array.from(dtItems).some((item) => {
      const entry = item.webkitGetAsEntry?.();
      return entry?.isDirectory;
    });

    if (entriesHaveDir) {
      // Walk directory tree via FileSystemAPI
      const allFiles: Array<{ file: File; relativePath: string }> = [];
      const processEntry = async (entry: FileSystemEntry, prefix: string): Promise<void> => {
        if (entry.isFile) {
          await new Promise<void>((resolve) => {
            (entry as FileSystemFileEntry).file((f) => {
              allFiles.push({ file: f, relativePath: `${prefix}${f.name}` });
              resolve();
            });
          });
        } else if (entry.isDirectory) {
          const reader = (entry as FileSystemDirectoryEntry).createReader();
          await new Promise<void>((resolve) => {
            reader.readEntries(async (entries) => {
              for (const child of entries) {
                await processEntry(child, `${prefix}${entry.name}/`);
              }
              resolve();
            });
          });
        }
      };
      for (const item of Array.from(dtItems)) {
        const entry = item.webkitGetAsEntry?.();
        if (entry) await processEntry(entry, "");
      }
      const next: FileStatus[] = allFiles.map(({ file, relativePath }) => ({
        file,
        relativePath,
        kind: "dir" as const,
        status: "pending" as const,
      }));
      setFileQueue((prev) => [...prev, ...next]);
    } else {
      // Regular files or single zip
      addFiles(e.dataTransfer.files);
    }
    openUploadDialog();
  }

  async function handleUpload() {
    if (fileQueue.length === 0 || uploading) return;
    setUploading(true);

    const batch = [...fileQueue];
    setFileQueue((prev) => prev.map((item) => ({ ...item, status: "uploading" as const })));

    // Group by kind
    const regular = batch.filter((f) => f.kind === "file");
    const dirFiles = batch.filter((f) => f.kind === "dir");
    const zips = batch.filter((f) => f.kind === "zip");

    const statusMap = new Map<FileStatus, "done" | "error">();
    const errorMap = new Map<FileStatus, string>();

    // Regular files → single-file upload
    if (regular.length > 0) {
      const formData = new FormData();
      if (activeFolderId) formData.append("folderId", activeFolderId);
      regular.forEach((item) => formData.append("file", item.file));
      try {
        const res = await fetch(`${API_URL}/admin/media/upload`, {
          method: "POST", credentials: "include", body: formData,
        });
        const body = (await res.json()) as UploadResult | { message?: string };
        if (!res.ok || !("results" in body)) {
          const msg = (body as { message?: string }).message ?? `Upload failed (${res.status})`;
          regular.forEach((item) => { statusMap.set(item, "error"); errorMap.set(item, msg); });
        } else {
          body.results.forEach((result, i) => {
            const item = regular[i];
            if (!item) return;
            if (result.error) { statusMap.set(item, "error"); errorMap.set(item, result.error); }
            else statusMap.set(item, "done");
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        regular.forEach((item) => { statusMap.set(item, "error"); errorMap.set(item, msg); });
      }
    }

    // Directory files → folder-upload
    if (dirFiles.length > 0) {
      const formData = new FormData();
      if (activeFolderId) formData.append("folderId", activeFolderId);
      dirFiles.forEach((item) => {
        formData.append("path", item.relativePath);
        formData.append("file", item.file);
      });
      try {
        const res = await fetch(`${API_URL}/admin/media/folder-upload`, {
          method: "POST", credentials: "include", body: formData,
        });
        const body = (await res.json()) as FolderUploadResult | { message?: string };
        if (!res.ok || !("results" in body)) {
          const msg = (body as { message?: string }).message ?? `Upload failed (${res.status})`;
          dirFiles.forEach((item) => { statusMap.set(item, "error"); errorMap.set(item, msg); });
        } else {
          body.results.forEach((result) => {
            const match = dirFiles.find((item) => item.relativePath === result.path);
            if (!match) return;
            if (result.error) { statusMap.set(match, "error"); errorMap.set(match, result.error); }
            else statusMap.set(match, "done");
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Folder upload failed";
        dirFiles.forEach((item) => { statusMap.set(item, "error"); errorMap.set(item, msg); });
      }
    }

    // ZIP files → zip-upload (one at a time)
    for (const item of zips) {
      const formData = new FormData();
      if (activeFolderId) formData.append("folderId", activeFolderId);
      formData.append("file", item.file);
      try {
        const res = await fetch(`${API_URL}/admin/media/zip-upload`, {
          method: "POST", credentials: "include", body: formData,
        });
        if (!res.ok) {
          const body = (await res.json()) as { message?: string };
          statusMap.set(item, "error");
          errorMap.set(item, body.message ?? `ZIP upload failed (${res.status})`);
        } else {
          statusMap.set(item, "done");
        }
      } catch (err: unknown) {
        statusMap.set(item, "error");
        errorMap.set(item, err instanceof Error ? err.message : "ZIP upload failed");
      }
    }

    setFileQueue((prev) =>
      prev.map((item) => {
        const status = statusMap.get(item);
        if (!status) return item;
        return { ...item, status, error: errorMap.get(item) };
      })
    );
    setUploading(false);
    refresh();
  }

  // ── New folder ───────────────────────────────────────────────────────────

  function openNewFolderDialog() {
    setNewFolderName("");
    setNewFolderError("");
    newFolderDialogRef.current?.showModal();
  }

  async function handleNewFolder() {
    if (!newFolderName.trim()) return;
    setNewFolderLoading(true);
    setNewFolderError("");
    try {
      await apiFetch("/admin/media/folders", {
        method: "POST",
        body: JSON.stringify({ name: newFolderName.trim(), parentId: activeFolderId }),
      });
      newFolderDialogRef.current?.close();
      await fetchFolders();
      await fetchMedia();
    } catch (err: unknown) {
      setNewFolderError(err instanceof Error ? err.message : "Failed to create folder");
    } finally {
      setNewFolderLoading(false);
    }
  }

  // ── Rename folder ────────────────────────────────────────────────────────

  function openRenameFolderDialog(folder: AdminMediaFolder) {
    setRenameFolderTarget(folder);
    setRenameFolderName(folder.name);
    setRenameFolderError("");
    renameFolderDialogRef.current?.showModal();
  }

  async function handleRenameFolder() {
    if (!renameFolderTarget || !renameFolderName.trim()) return;
    setRenameFolderLoading(true);
    setRenameFolderError("");
    try {
      await apiFetch(`/admin/media/folders/${renameFolderTarget.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: renameFolderName.trim() }),
      });
      renameFolderDialogRef.current?.close();
      await fetchFolders();
    } catch (err: unknown) {
      setRenameFolderError(err instanceof Error ? err.message : "Failed to rename folder");
    } finally {
      setRenameFolderLoading(false);
    }
  }

  // ── Delete folder ────────────────────────────────────────────────────────

  function openDeleteFolderDialog(folder: AdminMediaFolder) {
    setDeleteFolderTarget(folder);
    setDeleteFolderError("");
    deleteFolderDialogRef.current?.showModal();
  }

  async function handleDeleteFolder(force = false) {
    if (!deleteFolderTarget) return;
    setDeleteFolderLoading(true);
    setDeleteFolderError("");
    try {
      const qs = force ? "?force=true" : "";
      await apiFetch(`/admin/media/folders/${deleteFolderTarget.id}${qs}`, { method: "DELETE" });
      deleteFolderDialogRef.current?.close();
      if (activeFolderId === deleteFolderTarget.id) navigate(null);
      await fetchFolders();
      await fetchMedia();
    } catch (err: unknown) {
      setDeleteFolderError(err instanceof Error ? err.message : "Failed to delete folder");
    } finally {
      setDeleteFolderLoading(false);
    }
  }

  // ── Drive import ─────────────────────────────────────────────────────────

  function openDriveDialog() {
    setDriveUrl(""); setDriveResult(null); setDriveError("");
    driveDialogRef.current?.showModal();
  }

  async function handleDriveImport() {
    if (!driveUrl.trim()) return;
    setImporting(true); setDriveResult(null); setDriveError("");
    try {
      const result = await apiFetch<{ count: number }>("/admin/media/import-drive", {
        method: "POST",
        body: JSON.stringify({ folderUrl: driveUrl.trim(), folderId: activeFolderId }),
      });
      setDriveResult({ count: result.count });
      refresh();
    } catch (err: unknown) {
      setDriveError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  // ── Delete media ─────────────────────────────────────────────────────────

  function openDeleteDialog(media: AdminMedia) {
    setDeleteTarget(media); setDeleteError("");
    deleteMediaDialogRef.current?.showModal();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/admin/media/${deleteTarget.id}`, { method: "DELETE" });
      deleteMediaDialogRef.current?.close();
      setDeleteTarget(null);
      refresh();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  // ── Move media (drag-to-folder) ──────────────────────────────────────────

  async function handleMoveMedia(mediaId: string, targetFolderId: string | null) {
    try {
      await apiFetch(`/admin/media/${mediaId}/folder`, {
        method: "PUT",
        body: JSON.stringify({ folderId: targetFolderId }),
      });
      refresh();
    } catch {
      // silent — folder count will be off but media is unchanged
    }
  }

  // ── Folder cards in current view ─────────────────────────────────────────

  const currentFolders = allFolders.filter((f) => (f.parentId ?? null) === (activeFolderId ?? null));

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full gap-0">
      {/* Sidebar */}
      <aside className="hidden w-56 shrink-0 border-r border-border bg-muted/30 lg:block">
        <div className="p-3">
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Folders
          </p>
          <button
            type="button"
            onClick={() => navigate(null)}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverRootSidebar(true); }}
            onDragLeave={() => setDragOverRootSidebar(false)}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOverRootSidebar(false);
              const mediaId = e.dataTransfer.getData("mediaId");
              if (mediaId) void handleMoveMedia(mediaId, null);
            }}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
              dragOverRootSidebar
                ? "bg-primary/20 text-primary ring-1 ring-primary/40"
                : activeFolderId === null
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <FolderOpen className="size-3.5 shrink-0" aria-hidden />
            All media
          </button>
          {folderTree.map((folder) => (
            <FolderNode
              key={folder.id}
              folder={folder}
              activeFolderId={activeFolderId}
              onNavigate={navigate}
              onDropMedia={(mediaId, folderId) => void handleMoveMedia(mediaId, folderId)}
            />
          ))}
        </div>
      </aside>

      {/* Main */}
      <div className="min-w-0 flex-1 space-y-5 p-6">
        <PageHeader
          title="Media Library"
          description={`${total} item${total !== 1 ? "s" : ""}${activeFolderId ? " in folder" : ""}`}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={openNewFolderDialog}>
                <FolderPlus className="size-4" aria-hidden />
                New folder
              </Button>
              <Button variant="secondary" onClick={openDriveDialog}>
                <FolderUp className="size-4" aria-hidden />
                Drive
              </Button>
              <Button onClick={openUploadDialog}>
                <Upload className="size-4" aria-hidden />
                Upload
              </Button>
            </div>
          }
        />

        {/* Breadcrumb */}
        {breadcrumb.length > 0 && (
          <nav className="flex items-center gap-1 text-sm">
            <button
              type="button"
              onClick={() => navigate(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              All media
            </button>
            {breadcrumb.map((crumb, i) => (
              <React.Fragment key={crumb.id}>
                <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden />
                {i === breadcrumb.length - 1 ? (
                  <span className="font-medium text-foreground">{crumb.name}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate(crumb.id)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {crumb.name}
                  </button>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}

        {/* Folder actions for active folder */}
        {activeFolderId && (() => {
          const activeFolder = allFolders.find((f) => f.id === activeFolderId);
          if (!activeFolder) return null;
          return (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => openRenameFolderDialog(activeFolder)}>
                <Pencil className="size-3.5" aria-hidden /> Rename
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => openDeleteFolderDialog(activeFolder)}
              >
                <Trash2 className="size-3.5" aria-hidden /> Delete folder
              </Button>
            </div>
          );
        })()}

        {/* Type filter tabs */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex w-fit gap-1 rounded-lg border border-border bg-muted p-1">
            {FILE_TYPE_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                aria-pressed={activeTab === tab.value}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
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
            type="search"
            aria-label="Search media by filename"
            placeholder="Search by filename…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-xs"
          />
        </div>

        {/* Drop zone overlay (for whole page) */}
        <div
          onDragOver={(e) => { e.preventDefault(); if (!isDraggingMedia.current) setIsDragging(true); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false); }}
          onDrop={handleDropzoneDrop}
          className={`relative transition-colors rounded-lg ${isDragging ? "ring-2 ring-primary ring-offset-2" : ""}`}
        >
          {isDragging && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-primary/10 text-primary text-lg font-medium">
              Drop files, folder, or ZIP here
            </div>
          )}

          {loading ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Loading…</div>
          ) : currentFolders.length === 0 && items.length === 0 ? (
            <EmptyState
              icon={<CloudUpload className="size-8" aria-hidden />}
              title="No media yet"
              description="Upload files, drop a folder, or create a text item."
              action={
                <Button onClick={openUploadDialog}>
                  <Upload className="size-4" aria-hidden />
                  Upload
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {/* Subfolder cards */}
              {currentFolders.map((folder) => (
                <FolderDropCard
                  key={folder.id}
                  folder={folder}
                  onNavigate={navigate}
                  onDropMedia={(mediaId) => void handleMoveMedia(mediaId, folder.id)}
                  onRename={openRenameFolderDialog}
                  onDelete={openDeleteFolderDialog}
                />
              ))}

              {/* Media cards */}
              {items.map((media) => (
                <Card
                  key={media.id}
                  className="group overflow-hidden"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("mediaId", media.id);
                    e.dataTransfer.effectAllowed = "move";
                    isDraggingMedia.current = true;
                  }}
                  onDragEnd={() => { isDraggingMedia.current = false; }}
                >
                  <div
                    className="relative aspect-video bg-muted cursor-pointer"
                    onClick={() => (media.fileType === "TEXT" || media.fileType === "JSON") ? setViewingTextMedia(media) : undefined}
                  >
                    <MediaThumbnail media={media} />
                    <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                      <IconButton
                        variant="surface"
                        aria-label={`Delete ${media.fileName}`}
                        title="Delete"
                        onClick={() => openDeleteDialog(media)}
                        className="size-8 hover:text-destructive"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </IconButton>
                    </div>
                  </div>
                  <CardContent className="p-3">
                    <p className="truncate text-sm font-medium text-foreground" title={media.fileName}>
                      {media.fileName}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <Badge>{media.fileType}</Badge>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {formatBytes(media.fileSize)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">{formatDate(media.uploadedAt)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────────────── */}

      {/* Text / JSON viewer */}
      {viewingTextMedia && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setViewingTextMedia(null)}
        >
          <div
            className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-card shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                {viewingTextMedia.fileType === "JSON"
                  ? <FileJson className="size-4 text-primary" aria-hidden />
                  : <FileText className="size-4 text-muted-foreground" aria-hidden />
                }
                <h2 className="font-semibold text-foreground">{viewingTextMedia.fileName}</h2>
              </div>
              <div className="flex items-center gap-2">
                {viewingTextMedia.fileType === "JSON" && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setViewingTextMedia(null);
                      router.push(`/tests/import?mediaId=${viewingTextMedia.id}`);
                    }}
                  >
                    Create test from JSON
                  </Button>
                )}
                <IconButton variant="ghost" aria-label="Close" onClick={() => setViewingTextMedia(null)}>
                  <X className="size-4" aria-hidden />
                </IconButton>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-5">
              <pre className="whitespace-pre-wrap break-words font-mono text-sm text-foreground">
                {viewingTextMedia.textContent ?? "(empty)"}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Upload dialog */}
      <Dialog ref={uploadDialogRef} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault(); setIsDragging(false);
              if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
            }}
            className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-sm transition-colors ${
              isDragging ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-accent"
            }`}
          >
            <CloudUpload className="size-7" aria-hidden />
            <span>Drop files or a <strong>.zip</strong> here</span>
            <div className="flex gap-2">
              <button
                type="button"
                className="font-medium text-primary underline"
                onClick={() => fileInputRef.current?.click()}
              >
                Browse files
              </button>
              <span>·</span>
              <button
                type="button"
                className="font-medium text-primary underline"
                onClick={() => dirInputRef.current?.click()}
              >
                Browse folder
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*,.txt,.json,application/json,application/zip"
              multiple className="hidden"
              onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
            <input ref={dirInputRef} type="file" className="hidden"
              {...{ webkitdirectory: "", multiple: true } as unknown as React.InputHTMLAttributes<HTMLInputElement>}
              onChange={(e) => { if (e.target.files) addDirFiles(e.target.files); e.target.value = ""; }} />
          </div>

          {fileQueue.length > 0 && (
            <ul className="max-h-48 space-y-1.5 overflow-y-auto">
              {fileQueue.map((item, i) => (
                <li key={i} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    {item.kind === "zip" ? (
                      <FileArchive className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    ) : item.kind === "dir" ? (
                      <Folder className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    ) : (
                      <Upload className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    )}
                    <span className="min-w-0 truncate">{item.relativePath}</span>
                  </div>
                  <span className={`shrink-0 text-xs font-medium ${
                    item.status === "done" ? "text-success" :
                    item.status === "error" ? "text-destructive" :
                    item.status === "uploading" ? "text-primary" : "text-muted-foreground"
                  }`}>
                    {item.status === "done" ? "✓ Done" :
                     item.status === "error" ? `✗ ${item.error ?? "Error"}` :
                     item.status === "uploading" ? "Uploading…" : "Pending"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => uploadDialogRef.current?.close()} disabled={uploading}>
            {fileQueue.some((f) => f.status === "done") ? "Close" : "Cancel"}
          </Button>
          <Button
            onClick={handleUpload}
            disabled={fileQueue.length === 0 || uploading || fileQueue.every((f) => f.status === "done")}
          >
            {uploading ? "Uploading…" : `Upload (${fileQueue.length})`}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* New folder dialog */}
      <Dialog ref={newFolderDialogRef} className="max-w-sm">
        <DialogHeader><DialogTitle>New folder</DialogTitle></DialogHeader>
        <DialogBody className="space-y-3">
          <Field label="Folder name" htmlFor="newFolderName">
            <Input
              id="newFolderName"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleNewFolder(); }}
              disabled={newFolderLoading}
              autoFocus
            />
          </Field>
          {newFolderError && <Alert>{newFolderError}</Alert>}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => newFolderDialogRef.current?.close()}>Cancel</Button>
          <Button onClick={handleNewFolder} disabled={!newFolderName.trim() || newFolderLoading}>
            {newFolderLoading ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Rename folder dialog */}
      <Dialog ref={renameFolderDialogRef} className="max-w-sm">
        <DialogHeader><DialogTitle>Rename folder</DialogTitle></DialogHeader>
        <DialogBody className="space-y-3">
          <Field label="New name" htmlFor="renameFolderName">
            <Input
              id="renameFolderName"
              value={renameFolderName}
              onChange={(e) => setRenameFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleRenameFolder(); }}
              disabled={renameFolderLoading}
              autoFocus
            />
          </Field>
          {renameFolderError && <Alert>{renameFolderError}</Alert>}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => renameFolderDialogRef.current?.close()}>Cancel</Button>
          <Button onClick={handleRenameFolder} disabled={!renameFolderName.trim() || renameFolderLoading}>
            {renameFolderLoading ? "Renaming…" : "Rename"}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Delete folder confirm */}
      <Dialog ref={deleteFolderDialogRef} className="max-w-md">
        <div className="space-y-4 p-5">
          <div className="space-y-1.5">
            <h2 className="text-section-title text-foreground">Delete folder?</h2>
            <p className="text-sm text-muted-foreground">
              &ldquo;{deleteFolderTarget?.name}&rdquo; and all its subfolders will be removed.
              Media files inside will be moved to root.
            </p>
          </div>
          {deleteFolderError && (
            <div className="space-y-2">
              <Alert>{deleteFolderError}</Alert>
              {deleteFolderError.includes("referenced by existing tests") && (
                <Button
                  variant="danger"
                  onClick={() => handleDeleteFolder(true)}
                  disabled={deleteFolderLoading}
                >
                  {deleteFolderLoading ? "Deleting…" : "Force delete (unlink references)"}
                </Button>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => deleteFolderDialogRef.current?.close()} disabled={deleteFolderLoading}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => handleDeleteFolder(false)} disabled={deleteFolderLoading}>
              {deleteFolderLoading ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Drive import dialog */}
      <Dialog ref={driveDialogRef} className="max-w-md">
        <DialogHeader><DialogTitle>Import from Google Drive</DialogTitle></DialogHeader>
        <DialogBody className="space-y-4">
          <Field label="Folder URL" htmlFor="driveUrl" hint="The folder must be shared publicly or with the service account.">
            <Input id="driveUrl" placeholder="https://drive.google.com/drive/folders/…"
              value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} disabled={importing} />
          </Field>
          {driveError && <Alert>{driveError}</Alert>}
          {driveResult && (
            <Alert tone="success">
              Imported {driveResult.count} file{driveResult.count !== 1 ? "s" : ""} successfully.
            </Alert>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => driveDialogRef.current?.close()} disabled={importing}>
            {driveResult ? "Close" : "Cancel"}
          </Button>
          {!driveResult && (
            <Button onClick={handleDriveImport} disabled={!driveUrl.trim() || importing}>
              {importing ? "Importing…" : "Import"}
            </Button>
          )}
        </DialogFooter>
      </Dialog>

      {/* Delete media confirm */}
      <Dialog ref={deleteMediaDialogRef} className="max-w-md">
        <div className="space-y-4 p-5">
          <div className="space-y-1.5">
            <h2 className="text-section-title text-foreground">Delete media?</h2>
            <p className="text-sm text-muted-foreground">
              &ldquo;{deleteTarget?.fileName}&rdquo; will be permanently removed.
            </p>
          </div>
          {deleteError && <Alert>{deleteError}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { deleteMediaDialogRef.current?.close(); setDeleteTarget(null); }} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
