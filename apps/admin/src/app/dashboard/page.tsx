import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@testx/ui";

const stats = ["Total Evaluators", "Active Tests", "Total Responses", "Flagged Responses"];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Live counts will be connected in Phase 5.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat}>
            <CardHeader>
              <CardDescription>{stat}</CardDescription>
              <CardTitle>0</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent tests</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">No API data loaded yet.</CardContent>
      </Card>
    </div>
  );
}
