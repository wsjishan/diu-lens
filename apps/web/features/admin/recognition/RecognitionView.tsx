'use client';

import { ChangeEvent, DragEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ImagePlus,
  Loader2,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  AdminApiAuthError,
  matchRecognitionProbe,
  RecognitionMatchCandidate,
  RecognitionMatchResponse,
} from '@/features/admin/api';
import { useAdminAuth } from '@/features/admin/auth/AdminAuthContext';
import { useAdminToast } from '@/features/admin/ui/AdminToastProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const DEFAULT_TOP_K = '5';
const DEFAULT_THRESHOLD = '0.38';
const STRONG_MATCH_DISTANCE = 0.2;
const POSSIBLE_MATCH_DISTANCE = 0.38;

function formatDistance(value: number) {
  if (!Number.isFinite(value)) {
    return '-';
  }
  return value.toFixed(4);
}

function parsePositiveInt(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function parsePositiveFloat(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function getDistanceConfidence(distance: number): {
  label: string;
  className: string;
} {
  if (distance <= STRONG_MATCH_DISTANCE) {
    return {
      label: 'Strong match',
      className: 'border-emerald-300/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200',
    };
  }

  if (distance <= POSSIBLE_MATCH_DISTANCE) {
    return {
      label: 'Possible match',
      className: 'border-amber-300/30 bg-amber-500/10 text-amber-700 dark:text-amber-200',
    };
  }

  return {
    label: 'Weak candidate',
    className: 'border-rose-300/30 bg-rose-500/10 text-rose-700 dark:text-rose-200',
  };
}

function CandidateCard({ candidate, isTopCandidate }: { candidate: RecognitionMatchCandidate; isTopCandidate: boolean }) {
  const confidence = getDistanceConfidence(candidate.best_distance);

  return (
    <article
      className={cn(
        'grid gap-3 rounded-xl border p-4 md:grid-cols-[auto_1fr] md:items-start',
        isTopCandidate
          ? 'border-primary/35 bg-primary/10'
          : 'border-border bg-muted/30'
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md border border-border bg-background/70 px-2 py-1 text-xs text-muted-foreground">
          Rank #{candidate.rank}
        </span>
        <span
          className={cn(
            'rounded-md border px-2 py-1 text-xs',
            confidence.className
          )}
        >
          {confidence.label}
        </span>
      </div>

      <div className="grid gap-2 text-sm">
        {candidate.full_name ? (
          <p className="font-medium text-foreground">{candidate.full_name}</p>
        ) : (
          <p className="font-medium text-foreground">Name unavailable</p>
        )}
        <p className="text-xs text-muted-foreground">Student ID: <span className="text-foreground">{candidate.student_id}</span></p>
        {candidate.university_email ? (
          <p className="text-xs text-muted-foreground">
            University email: <span className="text-foreground">{candidate.university_email}</span>
          </p>
        ) : null}
        {candidate.phone ? (
          <p className="text-xs text-muted-foreground">
            Phone: <span className="text-foreground">{candidate.phone}</span>
          </p>
        ) : null}

        <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
          <p>Best distance: <span className="text-foreground">{formatDistance(candidate.best_distance)}</span></p>
          <p>Top-3 avg distance: <span className="text-foreground">{formatDistance(candidate.top_avg_distance)}</span></p>
          <p>Support count: <span className="text-foreground">{candidate.support_count}</span></p>
          <p>Matched angles count: <span className="text-foreground">{candidate.matched_angles_count}</span></p>
          <p>
            Rank gap to next:{' '}
            <span className="text-foreground">
              {candidate.rank_gap_to_next === null ? '-' : formatDistance(candidate.rank_gap_to_next)}
            </span>
          </p>
          <p>
            Matched angles:{' '}
            <span className="text-foreground">
              {candidate.matched_angles.length > 0 ? candidate.matched_angles.join(', ') : '-'}
            </span>
          </p>
          <p>
            Crop path:{' '}
            <span className="break-all text-foreground">{candidate.representative_crop_path || '-'}</span>
          </p>
          <p className="sm:col-span-2">
            Source image path:{' '}
            <span className="break-all text-foreground">{candidate.representative_source_image_path || '-'}</span>
          </p>
          <p className="sm:col-span-2">
            Decision factors:{' '}
            <span className="text-foreground">
              {candidate.decision_reasons.length > 0
                ? candidate.decision_reasons.join(', ')
                : '-'}
            </span>
          </p>
        </div>
      </div>
    </article>
  );
}

export function RecognitionView() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { token, clearSession } = useAdminAuth();
  const { showToast } = useAdminToast();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [topKInput, setTopKInput] = useState(DEFAULT_TOP_K);
  const [thresholdInput, setThresholdInput] = useState(DEFAULT_THRESHOLD);

  const [isMatching, setIsMatching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [results, setResults] = useState<RecognitionMatchResponse | null>(null);

  const hasImage = Boolean(selectedFile);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  const handleAuthFailure = useCallback(
    (errorValue: unknown): boolean => {
      if (errorValue instanceof AdminApiAuthError) {
        clearSession();
        showToast({ title: 'Session expired', message: errorValue.message, variant: 'error' });
        router.replace('/admin/login?next=%2Fadmin%2Frecognition');
        return true;
      }
      return false;
    },
    [clearSession, router, showToast]
  );

  const onSelectFile = useCallback((file: File | null) => {
    if (!file) {
      return;
    }

    if (!file.type || !file.type.startsWith('image/')) {
      setErrorMessage('Please choose a valid image file.');
      return;
    }

    setSelectedFile(file);
    setErrorMessage(null);
    setResults(null);
    setHasSearched(false);
  }, []);

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    onSelectFile(file);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);

    const file = event.dataTransfer.files?.[0] ?? null;
    onSelectFile(file);
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(true);
  };

  const onDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setResults(null);
    setErrorMessage(null);
    setHasSearched(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const runMatch = useCallback(async () => {
    if (!token || !selectedFile) {
      return;
    }

    const parsedTopK = parsePositiveInt(topKInput);
    if (parsedTopK === null) {
      setErrorMessage('top_k must be a positive integer.');
      return;
    }

    const parsedThreshold = parsePositiveFloat(thresholdInput);
    if (parsedThreshold === null) {
      setErrorMessage('threshold must be a positive number.');
      return;
    }

    setHasSearched(true);
    setIsMatching(true);
    setErrorMessage(null);

    try {
      const response = await matchRecognitionProbe(token, selectedFile, {
        topK: parsedTopK,
        threshold: parsedThreshold,
      });

      if (!response.success) {
        setResults(null);
        setErrorMessage(response.message);
        showToast({ title: 'Match request failed', message: response.message, variant: 'error' });
        return;
      }

      setResults(response);
      showToast({ title: 'Search completed', message: response.message, variant: 'success' });
    } catch (errorValue) {
      if (handleAuthFailure(errorValue)) {
        return;
      }

      const message =
        errorValue instanceof Error
          ? errorValue.message
          : 'Unable to run recognition match right now.';
      setErrorMessage(message);
      setResults(null);
      showToast({ title: 'Request failed', message, variant: 'error' });
    } finally {
      setIsMatching(false);
    }
  }, [handleAuthFailure, selectedFile, showToast, thresholdInput, token, topKInput]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runMatch();
  };

  const candidates = useMemo(() => results?.candidates ?? [], [results]);
  const reliableCandidates = useMemo(
    () => candidates.filter((candidate) => candidate.best_distance <= POSSIBLE_MATCH_DISTANCE),
    [candidates]
  );
  const weakCandidates = useMemo(
    () => candidates.filter((candidate) => candidate.best_distance > POSSIBLE_MATCH_DISTANCE),
    [candidates]
  );
  const confidenceCounts = useMemo(() => {
    let strong = 0;
    let possible = 0;
    let weak = 0;

    for (const candidate of candidates) {
      if (candidate.best_distance <= STRONG_MATCH_DISTANCE) {
        strong += 1;
      } else if (candidate.best_distance <= POSSIBLE_MATCH_DISTANCE) {
        possible += 1;
      } else {
        weak += 1;
      }
    }

    return { strong, possible, weak };
  }, [candidates]);

  return (
    <div className="grid gap-6">
      <Card className="border-border bg-card text-foreground">
        <CardHeader>
          <CardTitle className="text-foreground">Recognition Candidate Search</CardTitle>
          <CardDescription className="text-muted-foreground">
            Upload a probe image to find ranked candidate students from approved enrollments.
            Results are suggestions for manual review, not automatic identity confirmation.
          </CardDescription>
        </CardHeader>
      </Card>

      <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card className="border-border bg-card text-foreground">
          <CardHeader>
            <CardTitle className="text-foreground">Probe Image</CardTitle>
            <CardDescription className="text-muted-foreground">
              Use a clear face crop when possible. Low-quality input images may return weaker candidates.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="space-y-4" onSubmit={onSubmit}>
              <div
                className={cn(
                  'rounded-xl border border-dashed p-5 transition-colors',
                  dragActive
                    ? 'border-primary/60 bg-primary/10'
                    : 'border-border bg-muted/25'
                )}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onInputChange}
                />

                <div className="grid gap-3 text-center">
                  <div className="mx-auto inline-flex size-12 items-center justify-center rounded-full border border-border bg-background/70 text-muted-foreground">
                    <Upload className="size-5" />
                  </div>
                  <p className="text-sm text-foreground">Drag and drop an image here</p>
                  <p className="text-xs text-muted-foreground">or select one from your device</p>
                  <div className="flex justify-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <ImagePlus className="size-4" />
                      Choose Image
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!hasImage}
                      onClick={clearSelectedFile}
                    >
                      <Trash2 className="size-4" />
                      Remove
                    </Button>
                  </div>
                </div>
              </div>

              {previewUrl ? (
                <div className="rounded-xl border border-border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Selected file: {selectedFile?.name || '-'}</p>
                  <img
                    src={previewUrl}
                    alt="Uploaded probe preview"
                    className="mt-2 h-64 w-full rounded-lg border border-border object-cover"
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-muted/25 p-4 text-sm text-muted-foreground">
                  No input image selected yet.
                </div>
              )}

              <details className="rounded-xl border border-border bg-muted/25 p-3">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-foreground">
                  <SlidersHorizontal className="size-4" />
                  Advanced matching controls
                </summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="top-k">top_k</Label>
                    <Input
                      id="top-k"
                      type="number"
                      min={1}
                      step={1}
                      value={topKInput}
                      onChange={(event) => setTopKInput(event.target.value)}
                      disabled={isMatching}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="threshold">threshold</Label>
                    <Input
                      id="threshold"
                      type="number"
                      min={0.0001}
                      step={0.01}
                      value={thresholdInput}
                      onChange={(event) => setThresholdInput(event.target.value)}
                      disabled={isMatching}
                    />
                  </div>
                </div>
              </details>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  disabled={!hasImage || isMatching}
                  onClick={() => {
                    void runMatch();
                  }}
                >
                  {isMatching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                  {isMatching ? 'Finding matches...' : 'Find Matches'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!hasImage || isMatching}
                  onClick={() => {
                    void runMatch();
                  }}
                >
                  <RefreshCw className="size-4" />
                  Retry
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-border bg-card text-foreground">
          <CardHeader>
            <CardTitle className="text-foreground">Candidate Results</CardTitle>
            <CardDescription className="text-muted-foreground">
              Review ranked candidates and supporting evidence before taking any manual action.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-amber-300/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-200">
              Candidate ranking indicates similarity only. It does not confirm identity.
            </div>

            {isMatching ? (
              <div className="grid place-items-center rounded-xl border border-border bg-muted/25 p-10 text-sm text-muted-foreground">
                <div className="inline-flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Searching...
                </div>
              </div>
            ) : null}

            {!isMatching && errorMessage ? (
              <div className="rounded-xl border border-destructive/35 bg-destructive/10 p-4 text-sm text-red-500">
                <p>{errorMessage}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  disabled={!hasImage}
                  onClick={() => {
                    void runMatch();
                  }}
                >
                  Retry
                </Button>
              </div>
            ) : null}

            {!isMatching && !errorMessage && !hasSearched ? (
              <div className="rounded-xl border border-border bg-muted/25 p-8 text-center text-sm text-muted-foreground">
                Upload a probe image and run “Find Matches” to view ranked candidates.
              </div>
            ) : null}

            {!isMatching && !errorMessage && hasSearched && candidates.length === 0 ? (
              <div className="rounded-xl border border-border bg-muted/25 p-8 text-center text-sm text-muted-foreground">
                <p className="font-medium text-foreground">No reliable match found.</p>
                <p className="mt-2">Try a clearer face image or search manually.</p>
              </div>
            ) : null}

            {!isMatching && !errorMessage && hasSearched && candidates.length > 0 ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-muted/25 p-3 text-xs text-muted-foreground">
                  <p>
                    Ranked candidates: <span className="text-foreground">{candidates.length}</span>
                    {' '}| Strong: <span className="text-foreground">{confidenceCounts.strong}</span>
                    {' '}| Possible: <span className="text-foreground">{confidenceCounts.possible}</span>
                    {' '}| Weak: <span className="text-foreground">{confidenceCounts.weak}</span>
                    {' '}
                    | Threshold used: <span className="text-foreground">{formatDistance(results?.threshold_used ?? 0)}</span>
                  </p>
                  <p className="mt-1">
                    Embeddings searched: <span className="text-foreground">{results?.searched_embedding_rows ?? 0}</span>
                  </p>
                </div>

                {reliableCandidates.length === 0 ? (
                  <div className="inline-flex items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-200">
                    <AlertTriangle className="size-4" />
                    No reliable match found. Try a clearer face image or search manually.
                  </div>
                ) : null}

                {reliableCandidates.length > 0 ? (
                  <div className="grid gap-3">
                    {reliableCandidates.map((candidate, index) => (
                      <CandidateCard
                        key={`${candidate.student_id}-${candidate.rank}-${index}`}
                        candidate={candidate}
                        isTopCandidate={index === 0}
                      />
                    ))}
                  </div>
                ) : null}

                {weakCandidates.length > 0 ? (
                  <details className="rounded-xl border border-border bg-muted/20 p-3">
                    <summary className="cursor-pointer text-xs text-muted-foreground">
                      Show weak candidates for manual review ({weakCandidates.length})
                    </summary>
                    <div className="mt-2 grid gap-2 text-xs text-muted-foreground">
                      {weakCandidates.map((candidate) => (
                        <p key={`${candidate.student_id}-${candidate.rank}`}>
                          Rank {candidate.rank} | Student ID: <span className="text-foreground">{candidate.student_id}</span>
                          {' '}| Distance: <span className="text-foreground">{formatDistance(candidate.best_distance)}</span>
                          {' '}| Label: <span className="text-foreground">Weak candidate</span>
                        </p>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
            ) : null}

            {!isMatching && results ? (
              <details className="rounded-xl border border-border bg-muted/20 p-3">
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  Show debug response
                </summary>
                <p className="mt-2 text-xs text-muted-foreground">
                  Match found: <span className="text-foreground">{results.match_found ? 'Yes' : 'No'}</span>
                  {' '}| Candidates: <span className="text-foreground">{results.candidates.length}</span>
                </p>
                <pre className="mt-2 max-h-72 overflow-auto rounded-lg border border-border/70 bg-background/80 p-2 text-[11px] leading-4 text-foreground">
                  {JSON.stringify(results, null, 2)}
                </pre>
              </details>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
