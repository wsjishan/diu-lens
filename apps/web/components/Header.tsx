import Link from 'next/link';
import { Aperture } from 'lucide-react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

export function Header() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200/50 px-4 sm:px-6 lg:px-8 dark:border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="grid size-7.5 place-items-center rounded-xl bg-slate-800/95 text-blue-400 shadow-[0_6px_12px_-10px_rgba(30,64,175,0.48)] dark:bg-slate-950/90 dark:text-blue-300 dark:shadow-[0_8px_16px_-12px_rgba(56,189,248,0.4)]">
            <Aperture
              className="size-3"
              aria-hidden="true"
            />
          </div>
          <p className="text-xl leading-none font-bold tracking-tight">
            <span className="text-slate-900 dark:text-slate-100">
              DIU{' '}
            </span>
            <span className="text-slate-700 dark:text-slate-400">
              Lens
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <nav
            aria-label="Primary"
            className="hidden items-center gap-6 md:flex"
          >
            <Link
              href="/faq"
              className="text-sm text-slate-500/85 transition-colors duration-150 hover:text-slate-800 dark:text-slate-400/90 dark:hover:text-slate-200"
            >
              FAQ
            </Link>
          </nav>
          <ThemeToggle />
        </div>
    </header>
  );
}
