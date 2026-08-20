import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@testx/ui";

/** Logo lockup over a single card — the frame for the admin sign-in screen. */
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-8">
      <div className="flex flex-col items-center gap-2.5">
        <p className="text-sm text-muted-foreground">Welcome to</p>
        <img src="/testxlogo.jpg" alt="TESTx" className="h-11 w-auto" />
      </div>

      <Card className="w-full">
        <CardHeader className="pb-4">
          <CardTitle className="text-section-title">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}
