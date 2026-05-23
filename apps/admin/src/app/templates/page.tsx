"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@testx/ui";
import { apiFetch } from "@/lib/api";
import type { AdminTestDetail, TemplateItem } from "@/lib/admin-types";

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await apiFetch<{ items: TemplateItem[] }>("/admin/templates");
        setTemplates(data.items);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load templates");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  async function createFromTemplate(templateId: string) {
    setCreatingId(templateId);
    setError("");
    try {
      const test = await apiFetch<AdminTestDetail>(`/admin/tests/from-template/${templateId}`, { method: "POST" });
      router.push(`/tests/${test.id}/edit`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create test");
    } finally {
      setCreatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Templates</h1>
        <p className="text-muted-foreground">Seeded starting points for common evaluation patterns.</p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading templates...</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardHeader>
                <CardTitle>{template.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{template.description}</p>
                <Button onClick={() => createFromTemplate(template.id)} disabled={creatingId === template.id}>
                  {creatingId === template.id ? "Creating..." : "Use Template"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
