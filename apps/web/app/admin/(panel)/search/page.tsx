'use client';

import { ChangeEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, WandSparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const QUERY_IMAGE_KEY = 'diu_lens_query_image';

export default function AdminSearchPage() {
  const router = useRouter();
  const [isMatching, setIsMatching] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');

  const hasImage = useMemo(() => Boolean(previewUrl), [previewUrl]);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setSelectedFileName(file.name);

    const fileReader = new FileReader();
    fileReader.onload = () => {
      setPreviewUrl(fileReader.result as string);
    };
    fileReader.readAsDataURL(file);
  };

  const startMockMatch = () => {
    if (!previewUrl) {
      return;
    }

    setIsMatching(true);
    sessionStorage.setItem(QUERY_IMAGE_KEY, previewUrl);

    window.setTimeout(() => {
      router.push('/admin/results');
    }, 1300);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
      <Card className="border-border bg-card text-foreground">
        <CardHeader>
          <CardTitle className="text-foreground">Upload Query Image</CardTitle>
          <CardDescription className="text-muted-foreground">
            Upload a clear frontal image for best identification confidence.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label
            htmlFor="query-image-upload"
            className="group block cursor-pointer rounded-2xl border border-dashed border-blue-300/45 bg-blue-500/8 p-8 text-center transition-colors hover:border-blue-300/70 hover:bg-blue-500/14"
          >
            <div className="mx-auto mb-4 inline-flex size-14 items-center justify-center rounded-full border border-blue-300/40 bg-blue-400/15 text-blue-100">
              <Upload className="size-6" />
            </div>
            <p className="font-medium text-foreground">Drop an image here, or click to browse</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Supports JPG, PNG, or WEBP. Suggested resolution: 512x512 or higher.
            </p>
            <input
              id="query-image-upload"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={onFileChange}
            />
          </label>

          {hasImage ? (
            <div className="rounded-xl border border-border bg-muted/35 p-3">
              <p className="text-xs text-muted-foreground">Preview: {selectedFileName}</p>
              <img
                src={previewUrl ?? ''}
                alt="Uploaded query"
                className="mt-3 h-72 w-full rounded-lg object-cover"
              />
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-muted/35 p-4 text-sm text-muted-foreground">
              No image selected yet.
            </div>
          )}

          <Button className="h-10 w-full sm:w-auto" onClick={startMockMatch} disabled={!hasImage || isMatching}>
            <WandSparkles className="size-4" />
            {isMatching ? 'Processing Mock Match...' : 'Start Match'}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border bg-card text-foreground">
        <CardHeader>
          <CardTitle className="text-foreground">Search Notes</CardTitle>
          <CardDescription className="text-muted-foreground">Frontend placeholder controls</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="rounded-lg border border-border bg-muted/35 p-3">
            <p className="font-medium text-foreground">Status Filter</p>
            <p className="mt-1 text-muted-foreground">All campus records (mock)</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/35 p-3">
            <p className="font-medium text-foreground">Confidence Preference</p>
            <p className="mt-1 text-muted-foreground">Above 80% (mock)</p>
          </div>
          <div className="rounded-lg border border-amber-300/20 bg-amber-500/10 p-3 text-amber-100">
            This page simulates upload and match workflow only; no face model runs yet.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
