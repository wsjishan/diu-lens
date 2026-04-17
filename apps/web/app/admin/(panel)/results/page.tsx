'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { mockCandidates } from '@/features/admin/mock-data';

const QUERY_IMAGE_KEY = 'diu_lens_query_image';

export default function AdminResultsPage() {
  const queryImage =
    typeof window !== 'undefined' ? sessionStorage.getItem(QUERY_IMAGE_KEY) : null;

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <Card className="border-border bg-card text-foreground">
          <CardHeader>
            <CardTitle className="text-foreground">Query Image</CardTitle>
            <CardDescription className="text-muted-foreground">Input used for mock match search</CardDescription>
          </CardHeader>
          <CardContent>
            {queryImage ? (
              <img
                src={queryImage}
                alt="Query face"
                className="h-80 w-full rounded-xl border border-border object-cover"
              />
            ) : (
              <div className="grid h-80 place-items-center rounded-xl border border-dashed border-border bg-muted/40 text-center text-sm text-muted-foreground">
                No uploaded query image found.
                <br />
                Run a search from the Search page first.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card text-foreground">
          <CardHeader>
            <CardTitle className="text-foreground">Top Candidate Results</CardTitle>
            <CardDescription className="text-muted-foreground">
              Mock ranking based on simulated confidence scores.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {mockCandidates.map((candidate, index) => (
              <article
                key={candidate.id}
                className="grid gap-3 rounded-xl border border-border bg-muted/35 p-3 md:grid-cols-[96px_1fr_auto] md:items-center"
              >
                <img
                  src={candidate.studentImage}
                  alt={candidate.fullName}
                  className="h-24 w-24 rounded-lg object-cover"
                />

                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">{candidate.fullName}</p>
                  <p className="text-xs text-muted-foreground">Student ID: {candidate.studentId}</p>
                  <p className="text-xs text-muted-foreground">Department: {candidate.department}</p>
                  <p className="inline-flex items-center gap-1 rounded-full border border-emerald-300/35 bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-100">
                    <CheckCircle2 className="size-3.5" />
                    Confidence {candidate.confidence.toFixed(1)}%
                  </p>
                </div>

                <div className="flex items-center gap-2 md:justify-end">
                  <span className="rounded-md border border-border bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
                    Rank #{index + 1}
                  </span>
                  <Button asChild size="sm">
                    <Link href={`/admin/match/${candidate.id}`}>
                      View Details
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </Button>
                </div>
              </article>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
