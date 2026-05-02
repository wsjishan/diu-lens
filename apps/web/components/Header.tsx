import Link from 'next/link';
import { Eye } from 'lucide-react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

export function Header() {
  return (
    <header className="relative flex items-center justify-between py-1.5 max-[639px]:justify-center max-[639px]:py-0 sm:py-1">
      <div className="flex items-center gap-2 max-[639px]:gap-0 sm:gap-3">
        <span className="inline-flex size-[1.9rem] items-center justify-center rounded-full border border-slate-300/78 bg-white/88 text-blue-700 shadow-[0_8px_18px_-12px_rgba(30,64,175,0.34)] dark:border-blue-200/28 dark:bg-[#102646]/84 dark:text-blue-100 dark:shadow-[0_8px_18px_-12px_rgba(37,99,235,0.28)] max-[639px]:hidden sm:size-9 lg:size-[2.375rem]">
          <Eye
            className="size-[0.95rem] sm:size-[1.05rem] lg:size-[1.12rem]"
            aria-hidden="true"
          />
        </span>
        <p className="landing-text-primary text-[1.06rem] leading-none font-semibold tracking-[-0.016em] max-[639px]:text-center max-[639px]:text-[0.66rem] max-[639px]:font-bold max-[639px]:tracking-[0.21em] max-[639px]:text-[#58a9ff] max-[639px]:uppercase sm:text-[1.44rem] lg:text-[1.8rem]">
          DIU Lens
        </p>
      </div>

      <div className="flex items-center gap-2 max-[639px]:hidden sm:gap-3.5 lg:gap-[1.125rem]">
        <Link
          href="/faq"
          className="landing-link text-[0.74rem] font-medium max-[639px]:text-[0.7rem] sm:text-[0.9rem] lg:text-[1.02rem]"
        >
          FAQ
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
