import Link from 'next/link';
import { ScanFace } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminRecognitionPage() {
  return (
    <div className="grid gap-6">
      <Card className="border-border bg-card text-foreground">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <ScanFace className="size-5" />
            Recognition Workspace
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Recognition flow is prepared. Enrollment moderation is prioritized for MVP.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-dashed border-border bg-muted/35 p-8 text-center text-sm text-muted-foreground">
            Upload and live match controls will be connected in the next step.
          </div>

          <Button asChild variant="outline">
            <Link href="/admin/enrollments">Back to Enrollments</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
