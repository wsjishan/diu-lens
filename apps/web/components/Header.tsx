import { Aperture } from 'lucide-react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

export function Header() {
  return (
    <header className="flex h-16 items-center justify-between rounded-2xl border border-transparent bg-white/70 px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] ring-1 ring-slate-200/70 backdrop-blur-sm dark:bg-[#0f172a]/80 dark:ring-white/10 sm:px-5 lg:px-6">
      <div className="flex items-center gap-3">
        <div className="grid size-8 place-items-center rounded-xl bg-slate-900 text-blue-300 shadow-[0_12px_28px_-18px_rgba(30,64,175,0.9)] dark:bg-slate-950/90 dark:text-blue-200 dark:shadow-[0_14px_32px_-18px_rgba(59,130,246,0.6)]">
          <Aperture
            className="size-3.5"
            aria-hidden="true"
          />
        </div>
        <div className="leading-tight">
          <p className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-xl">
            DIU <span className="text-slate-600 dark:text-slate-300">Lens</span>
          </p>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Identity simplified
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 sm:gap-4">
        <nav
          aria-label="Primary"
          className="hidden items-center gap-5 rounded-full bg-slate-100/70 px-3 py-1 text-sm font-medium text-slate-600 ring-1 ring-slate-200/80 transition-colors duration-150 md:flex dark:bg-white/5 dark:text-slate-300 dark:ring-white/10"
        >
          <a
            href="#features"
            className="rounded-full px-2 py-1 transition-colors duration-150 hover:text-slate-900 dark:hover:text-white"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="rounded-full px-2 py-1 transition-colors duration-150 hover:text-slate-900 dark:hover:text-white"
          >
            How it works
          </a>
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
