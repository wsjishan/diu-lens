import Link from 'next/link';
import { Aperture } from 'lucide-react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

export function Header() {
  return (
    <header className="landing-topbar flex h-16 items-center justify-between border-b px-4 sm:h-[4.25rem] sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <div className="grid size-8 place-items-center rounded-2xl border border-slate-300/55 bg-white/70 text-blue-700 shadow-[0_14px_22px_-18px_rgba(30,64,175,0.55)] dark:border-white/12 dark:bg-slate-900/70 dark:text-blue-300">
          <Aperture
            className="size-3.5"
            aria-hidden="true"
          />
        </div>
        <p className="text-lg leading-none font-semibold tracking-tight sm:text-xl">
          <span className="landing-text-primary">DIU </span>
          <span className="landing-text-secondary">Lens</span>
        </p>
      </div>
      <div className="flex items-center gap-2.5 sm:gap-3">
        <nav
          aria-label="Primary"
          className="flex items-center"
        >
          <Link
            href="/faq"
            className="landing-link rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/45 dark:focus-visible:ring-blue-400/55"
          >
            FAQ
          </Link>
        </nav>
        <div className="shrink-0">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
