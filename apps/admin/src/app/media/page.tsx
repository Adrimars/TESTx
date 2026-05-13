import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "@testx/ui";

export default function MediaPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Media Library</h1>
          <p className="text-muted-foreground">Uploads and Google Drive imports connect in Phase 2.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary">Import Drive</Button>
          <Button>Upload</Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Browse media</CardTitle>
          <CardDescription>Search, filters, and thumbnails will use live API data.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Search media" />
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No media loaded yet.</div>
        </CardContent>
      </Card>
    </div>
  );
}
