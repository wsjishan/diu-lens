import Link from 'next/link';
import { Eye } from 'lucide-react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

export function Header() {
  return (
    <header className="relative flex items-center justify-between py-0.5 md:py-0.5 lg:py-1">
      <div className="flex items-center gap-2.5 md:gap-2.5 lg:gap-3">
        <span className="inline-flex size-8.5 items-center justify-center rounded-full border border-slate-300/78 bg-white/88 text-blue-700 shadow-[0_8px_18px_-12px_rgba(30,64,175,0.34)] dark:border-blue-200/28 dark:bg-[#102646]/84 dark:text-blue-100 dark:shadow-[0_8px_18px_-12px_rgba(37,99,235,0.28)] lg:size-[2.375rem]">
          <Eye
            className="size-[0.98rem] md:size-[1rem] lg:size-[1.12rem]"
            aria-hidden="true"
          />
        </span>
        <p className="landing-text-primary text-[1.24rem] leading-none font-semibold tracking-[-0.016em] md:text-[1.28rem] lg:text-[1.8rem]">
          DIU Lens
        </p>
      </div>

      <div className="flex items-center gap-2.5 md:gap-3 lg:gap-[1.125rem]">
        <Link
          href="/faq"
          className="landing-link text-[0.8rem] font-medium md:text-[0.84rem] lg:text-[1.02rem]"
        >
          FAQ
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
