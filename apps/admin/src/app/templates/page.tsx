import { Card, CardContent, CardHeader, CardTitle } from "@testx/ui";

export default function TemplatesPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Templates</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">System templates are seeded in the database package.</CardContent>
    </Card>
  );
}
