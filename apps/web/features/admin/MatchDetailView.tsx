'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { CheckCircle2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MatchCandidate } from '@/features/admin/types';

const QUERY_IMAGE_KEY = 'diu_lens_query_image';

type MatchDetailViewProps = {
  candidate: MatchCandidate;
};

export function MatchDetailView({ candidate }: MatchDetailViewProps) {
  const queryImage = useMemo(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    return sessionStorage.getItem(QUERY_IMAGE_KEY);
  }, []);

  return (
    <div className="grid gap-6">
      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="border-border bg-card text-foreground">
          <CardHeader>
            <CardTitle className="text-foreground">Query Image</CardTitle>
            <CardDescription className="text-muted-foreground">Uploaded by admin during search</CardDescription>
          </CardHeader>
          <CardContent>
            {queryImage ? (
              <img
                src={queryImage}
                alt="Query face"
                className="h-96 w-full rounded-xl border border-border object-cover"
              />
            ) : (
              <div className="grid h-96 place-items-center rounded-xl border border-dashed border-border bg-muted/40 text-center text-sm text-muted-foreground">
                Query image is unavailable in this session.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card text-foreground">
          <CardHeader>
            <CardTitle className="text-foreground">Matched Student Profile</CardTitle>
            <CardDescription className="text-muted-foreground">Top mock candidate details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <img
              src={candidate.studentImage}
              alt={candidate.fullName}
              className="h-64 w-full rounded-xl border border-border object-cover"
            />

            <div className="grid gap-2 rounded-xl border border-border bg-muted/35 p-4 text-sm">
              <p><span className="text-muted-foreground">Full Name:</span> {candidate.fullName}</p>
              <p><span className="text-muted-foreground">Student ID:</span> {candidate.studentId}</p>
              <p><span className="text-muted-foreground">Department:</span> {candidate.department}</p>
              <p>
                <span className="text-muted-foreground">Confidence:</span>{' '}
                <span className="font-medium text-emerald-200">{candidate.confidence.toFixed(1)}%</span>
              </p>
              <p><span className="text-muted-foreground">Review Note:</span> {candidate.notes}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="border-border bg-card text-foreground">
        <CardHeader>
          <CardTitle className="text-foreground">Comparison Summary</CardTitle>
          <CardDescription className="text-muted-foreground">
            This is a UI-only review surface for final verification decisions.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button className="h-10">
            <CheckCircle2 className="size-4" />
            Confirm Match
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-10 border-border bg-transparent text-foreground hover:bg-muted"
          >
            <Link href="/admin/results">
              <RotateCcw className="size-4" />
              Return to Results
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
