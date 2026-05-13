import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@testx/ui";

export default function DashboardPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Start your next evaluation</CardTitle>
          <CardDescription>Eligible tests will be assigned automatically from the API.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button className="w-full sm:w-auto">Start Next Test</Button>
          <p className="text-sm text-muted-foreground">No tests are loaded until Phase 4 implements assignment.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Rewards</CardTitle>
          <CardDescription>Your points balance appears in the navbar.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="secondary" disabled>
            Withdraw Coming Soon
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
