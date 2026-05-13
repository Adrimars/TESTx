import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@testx/ui";

export default function LoginPage() {
  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Admin login</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input type="email" placeholder="Email" />
        <Input type="password" placeholder="Password" />
        <Button className="w-full">Sign in</Button>
        <Button className="w-full" variant="secondary">
          Sign in with Google
        </Button>
      </CardContent>
    </Card>
  );
}
