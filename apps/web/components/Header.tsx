import Link from 'next/link';
import { Eye } from 'lucide-react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

export function Header() {
  return (
    <header className="flex items-center justify-between py-1">
      <div className="flex items-center gap-3.5">
        <span className="inline-flex size-8 items-center justify-center rounded-full bg-blue-500/18 text-blue-300 shadow-[0_0_34px_rgba(59,130,246,0.35)] ring-1 ring-blue-300/40 sm:size-9 lg:size-10">
          <Eye className="size-4 sm:size-[1.1rem] lg:size-5" aria-hidden="true" />
        </span>
        <p className="landing-text-primary text-[1.55rem] leading-none font-semibold tracking-[-0.02em] sm:text-[1.75rem] lg:text-[2.05rem]">
          DIU Lens
        </p>
      </div>

      <div className="flex items-center gap-3 sm:gap-4 lg:gap-5">
        <Link
          href="/faq"
          className="landing-link text-[0.9rem] font-medium sm:text-[1rem] lg:text-[1.28rem]"
        >
          FAQ
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
