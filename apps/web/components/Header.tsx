import Image from 'next/image';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

export function Header() {
  return (
    <header className="relative flex h-10 items-center justify-between sm:h-11 lg:h-12">
      <div className="flex items-center gap-2 sm:gap-2.5">
        <span className="relative inline-flex size-8 items-center justify-center rounded-[0.7rem] border border-slate-300/35 bg-white/45 shadow-[0_8px_18px_-16px_rgba(15,23,42,0.4)] ring-1 ring-white/40 backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.045] dark:ring-white/8 sm:size-[2.125rem] lg:size-9">
          <Image
            src="/branding/logo.png"
            alt="DIU Lens logo"
            width={48}
            height={48}
            priority
            className="relative size-[1.375rem] drop-shadow-[0_3px_7px_rgba(15,23,42,0.18)] sm:size-6 lg:size-[1.625rem]"
          />
        </span>
        <p className="landing-text-primary text-[1.02rem] leading-none font-semibold tracking-[-0.01em] sm:text-[1.08rem] lg:text-[1.16rem]">
          DIU Lens
        </p>
      </div>

      <div className="flex items-center">
        <ThemeToggle />
      </div>
    </header>
  );
}
