import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from "@testx/ui";

export default function OnboardingPage() {
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Complete demographic profile</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <Input type="date" aria-label="Date of birth" />
        <Select defaultValue="UNDISCLOSED" aria-label="Gender">
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
          <option value="OTHER">Other</option>
          <option value="UNDISCLOSED">Prefer not to say</option>
        </Select>
        <Input placeholder="Country" />
        <Input placeholder="City" />
        <Button className="sm:col-span-2">Save profile</Button>
      </CardContent>
    </Card>
  );
}
