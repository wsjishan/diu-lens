import { Aperture } from 'lucide-react';

export function Header() {
  return (
    <header className="mb-3 flex min-h-18 items-center justify-between border-b border-slate-200 py-4 sm:mb-4 sm:py-5">
      <div className="flex items-center gap-3">
        <div className="grid size-7.5 place-items-center rounded-xl bg-slate-800/95 text-blue-400">
          <Aperture
            className="size-3"
            aria-hidden="true"
          />
        </div>
        <p className="text-xl leading-none font-bold tracking-tight">
          <span className="text-slate-900">DIU </span>
          <span className="text-slate-700">Lens</span>
        </p>
      </div>
      <nav
        aria-label="Primary"
        className="hidden items-center gap-6 md:flex"
      >
        <a
          href="#features"
          className="text-sm text-slate-500/85 transition-colors hover:text-slate-800"
        >
          Features
        </a>
        <a
          href="#how-it-works"
          className="text-sm text-slate-500/85 transition-colors hover:text-slate-800"
        >
          How DIU Lens Works
        </a>
      </nav>
    </header>
  );
}
