import { Aperture } from 'lucide-react';

export function Header() {
  return (
    <header className="mb-3 flex min-h-18 items-center border-b border-slate-200 py-4 sm:mb-4 sm:py-5">
      <div className="flex items-center gap-3">
        <div className="grid size-[1.875rem] place-items-center rounded-xl bg-slate-800/95 text-slate-100/90">
          <Aperture
            className="size-3"
            aria-hidden="true"
          />
        </div>
        <p className="text-xl leading-none font-semibold tracking-tight">
          <span className="text-slate-900">DIU </span>
          <span className="text-slate-700">Lens</span>
        </p>
      </div>
    </header>
  );
}
