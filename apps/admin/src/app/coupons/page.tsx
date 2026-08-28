"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Gift, ImageOff, Pencil, Plus, Upload } from "lucide-react";
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
  Input,
  PageHeader,
} from "@testx/ui";
import type { Coupon } from "@testx/shared";
import { apiFetch } from "@/lib/api";
import type { AdminMedia, Paginated, UploadResult } from "@/lib/admin-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Draft = {
  title: string;
  description: string;
  pointsCost: string;
  displayOrder: string;
  isActive: boolean;
  imageUrl: string;
};

const EMPTY_DRAFT: Draft = {
  title: "",
  description: "",
  pointsCost: "",
  displayOrder: "",
  isActive: true,
  imageUrl: "",
};

function resolveImageUrl(imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  return imageUrl.startsWith("http") ? imageUrl : `${API_URL}${imageUrl}`;
}

export default function CouponsPage() {
  const [items, setItems] = useState<Coupon[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");

  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const deactivateDialogRef = useRef<HTMLDialogElement>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Coupon | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState("");

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    setListError("");
    try {
      const data = await apiFetch<Paginated<Coupon>>("/admin/coupons?page=1&limit=100");
      setItems(data.items);
      setTotal(data.total);
    } catch (err: unknown) {
      setListError(err instanceof Error ? err.message : "Failed to load coupons");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCoupons();
  }, [fetchCoupons]);

  function openCreateDialog() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setFormError("");
    dialogRef.current?.showModal();
  }

  function openEditDialog(coupon: Coupon) {
    setEditingId(coupon.id);
    setDraft({
      title: coupon.title,
      description: coupon.description ?? "",
      pointsCost: String(coupon.pointsCost),
      displayOrder: String(coupon.displayOrder),
      isActive: coupon.isActive,
      imageUrl: coupon.imageUrl ?? "",
    });
    setFormError("");
    dialogRef.current?.showModal();
  }

  async function handleImageUpload(file: File) {
    setUploading(true);
    setFormError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_URL}/admin/media/upload`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const body = (await res.json()) as UploadResult | { message?: string };
      if (!res.ok || !("results" in body)) {
        throw new Error((body as { message?: string }).message ?? `Upload failed (${res.status})`);
      }
      const result = body.results[0];
      if (!result || result.error || !result.media) {
        throw new Error(result?.error ?? "Upload failed");
      }
      const media = result.media as AdminMedia;
      setDraft((current) => ({ ...current, imageUrl: `/media/${media.id}/file` }));
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!draft.title.trim()) {
      setFormError("Title is required");
      return;
    }
    const pointsCost = Number(draft.pointsCost);
    if (!Number.isInteger(pointsCost) || pointsCost <= 0) {
      setFormError("Point cost must be a positive whole number");
      return;
    }
    const displayOrder = draft.displayOrder.trim() === "" ? undefined : Number(draft.displayOrder);
    if (displayOrder !== undefined && !Number.isInteger(displayOrder)) {
      setFormError("Display order must be a whole number");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const payload = {
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        imageUrl: draft.imageUrl || null,
        pointsCost,
        isActive: draft.isActive,
        ...(displayOrder !== undefined && { displayOrder }),
      };
      if (editingId) {
        await apiFetch(`/admin/coupons/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/admin/coupons", { method: "POST", body: JSON.stringify(payload) });
      }
      dialogRef.current?.close();
      await fetchCoupons();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to save coupon");
    } finally {
      setSaving(false);
    }
  }

  function openDeactivateDialog(coupon: Coupon) {
    setDeactivateTarget(coupon);
    setDeactivateError("");
    deactivateDialogRef.current?.showModal();
  }

  async function handleDeactivate() {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      await apiFetch(`/admin/coupons/${deactivateTarget.id}/deactivate`, { method: "PUT" });
      deactivateDialogRef.current?.close();
      setDeactivateTarget(null);
      await fetchCoupons();
    } catch (err: unknown) {
      setDeactivateError(err instanceof Error ? err.message : "Failed to deactivate coupon");
    } finally {
      setDeactivating(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rewards Catalog"
        description={`${total} catalog item${total !== 1 ? "s" : ""}`}
        actions={
          <Button onClick={openCreateDialog}>
            <Plus className="size-4" aria-hidden />
            New Coupon
          </Button>
        }
      />

      {listError && <Alert>{listError}</Alert>}

      {loading ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Gift className="size-8" aria-hidden />}
          title="No catalog items yet"
          description="Create a coupon so evaluators have something to browse in the mobile Rewards screen."
          action={
            <Button onClick={openCreateDialog}>
              <Plus className="size-4" aria-hidden />
              New Coupon
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((coupon) => {
            const resolved = resolveImageUrl(coupon.imageUrl);
            return (
              <Card key={coupon.id} className="overflow-hidden">
                <div className="relative aspect-video bg-muted">
                  {resolved ? (
                    <img src={resolved} alt={coupon.title} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <ImageOff className="size-8" aria-hidden />
                    </div>
                  )}
                  {!coupon.isActive && (
                    <Badge variant="neutral" className="absolute left-2 top-2">Inactive</Badge>
                  )}
                </div>
                <CardContent className="space-y-2 p-3">
                  <p className="truncate text-sm font-medium text-foreground" title={coupon.title}>
                    {coupon.title}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="primary">{coupon.pointsCost} pts</Badge>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      Order {coupon.displayOrder}
                    </span>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button variant="secondary" size="sm" className="flex-1" onClick={() => openEditDialog(coupon)}>
                      <Pencil className="size-4" aria-hidden />
                      Edit
                    </Button>
                    {coupon.isActive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => openDeactivateDialog(coupon)}
                      >
                        Deactivate
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog ref={dialogRef} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingId ? "Edit Coupon" : "New Coupon"}</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <Field label="Title" htmlFor="coupon-title">
            <Input
              id="coupon-title"
              placeholder="50 TL Voucher"
              value={draft.title}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
            />
          </Field>
          <Field label="Description" htmlFor="coupon-description" optional>
            <Input
              id="coupon-description"
              placeholder="What the evaluator is redeeming"
              value={draft.description}
              onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Point cost" htmlFor="coupon-points">
              <Input
                id="coupon-points"
                type="number"
                min={1}
                placeholder="5000"
                value={draft.pointsCost}
                onChange={(event) => setDraft((current) => ({ ...current, pointsCost: event.target.value }))}
              />
            </Field>
            <Field label="Display order" htmlFor="coupon-order" optional hint="Lower shows first">
              <Input
                id="coupon-order"
                type="number"
                placeholder="Auto"
                value={draft.displayOrder}
                onChange={(event) => setDraft((current) => ({ ...current, displayOrder: event.target.value }))}
              />
            </Field>
          </div>
          <Field label="Image" optional>
            <div className="flex items-center gap-3">
              <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                {draft.imageUrl ? (
                  <img
                    src={resolveImageUrl(draft.imageUrl) ?? undefined}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImageOff className="size-5 text-muted-foreground" aria-hidden />
                )}
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="size-4" aria-hidden />
                {uploading ? "Uploading…" : draft.imageUrl ? "Replace image" : "Upload image"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleImageUpload(file);
                  event.target.value = "";
                }}
              />
            </div>
          </Field>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 rounded border-input accent-primary"
              checked={draft.isActive}
              onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.checked }))}
            />
            Active — visible to evaluators
          </label>
          {formError && <Alert>{formError}</Alert>}
        </DialogBody>

        <DialogFooter>
          <Button variant="secondary" onClick={() => dialogRef.current?.close()} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || uploading}>
            {saving ? "Saving…" : editingId ? "Save changes" : "Create coupon"}
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog ref={deactivateDialogRef} className="max-w-md">
        <div className="space-y-4 p-5">
          <div className="space-y-1.5">
            <h2 className="text-section-title text-foreground">Deactivate coupon?</h2>
            <p className="text-sm text-muted-foreground">
              &ldquo;{deactivateTarget?.title}&rdquo; will no longer appear on the mobile Rewards screen.
            </p>
          </div>
          {deactivateError && <Alert>{deactivateError}</Alert>}
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                deactivateDialogRef.current?.close();
                setDeactivateTarget(null);
              }}
              disabled={deactivating}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeactivate} disabled={deactivating}>
              {deactivating ? "Deactivating…" : "Deactivate"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
