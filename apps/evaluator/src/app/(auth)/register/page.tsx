import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@testx/ui";

export default function RegisterPage() {
  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Create evaluator account</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input type="email" placeholder="Email" />
        <Input type="password" placeholder="Password" />
        <Button className="w-full">Register</Button>
        <Button className="w-full" variant="secondary">
          Continue with Google
        </Button>
      </CardContent>
    </Card>
  );
}
