import { CircleHelp, ScanFace } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function Header() {
  return (
    <header className="flex items-center justify-between border-b border-border/70 pb-4 sm:pb-5">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
          <ScanFace
            className="size-5"
            aria-hidden="true"
          />
        </div>
        <div>
          <p className="text-base font-semibold tracking-tight text-slate-900">
            DIU Lens
          </p>
          <p className="text-xs text-muted-foreground">
            Student Identification Platform
          </p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Get help"
      >
        <CircleHelp className="size-4" />
      </Button>
    </header>
  );
}
