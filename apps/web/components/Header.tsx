import Image from 'next/image';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

export function Header() {
  return (
    <header className="relative flex items-center justify-between py-0 md:py-0.5 lg:py-1">
      <div className="flex items-center gap-1.5 sm:gap-2.5 lg:gap-4">
        <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-[0.7rem] border border-white/8 bg-white/[0.045] shadow-[0_8px_18px_-16px_rgba(59,130,246,0.45)] ring-1 ring-white/8 backdrop-blur-sm sm:h-9 sm:w-9 sm:rounded-[0.85rem] lg:h-12 lg:w-12 lg:rounded-[1rem] lg:border-white/10 lg:bg-white/6 lg:shadow-[0_12px_24px_-18px_rgba(59,130,246,0.6)] lg:ring-blue-500/20">
          <Image
            src="/branding/logo.png"
            alt="DIU Lens logo"
            width={48}
            height={48}
            priority
            className="relative h-6 w-6 drop-shadow-[0_4px_8px_rgba(15,23,42,0.28)] sm:h-7 sm:w-7 lg:h-10 lg:w-10 lg:drop-shadow-[0_8px_14px_rgba(15,23,42,0.45)]"
          />
        </span>
        <p className="landing-text-primary text-[1.08rem] leading-none font-semibold tracking-[-0.01em] sm:text-[1.16rem] md:text-[1.28rem] md:tracking-[-0.016em] lg:text-[1.8rem]">
          DIU Lens
        </p>
      </div>

      <div className="flex items-center gap-2.5 md:gap-3 lg:gap-[1.125rem]">
        <ThemeToggle />
      </div>
    </header>
  );
}
