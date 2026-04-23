'use client';

import { memo } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from './ThemeProvider';

export const ThemeToggle = memo(function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      className="relative flex h-8 w-[3.65rem] items-center rounded-full border border-slate-300/72 bg-white/78 p-[0.2rem] text-slate-600 backdrop-blur-md transition-colors duration-200 hover:border-slate-400/78 hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/55 dark:border-white/15 dark:bg-[#0b1d39]/62 dark:text-slate-300 dark:hover:border-white/22 dark:hover:bg-[#0d2244]/72 max-[639px]:h-[1.72rem] max-[639px]:w-[2.92rem] sm:h-9 sm:w-[4.05rem]"
    >
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute top-1/2 h-6 w-6 -translate-y-1/2 rounded-full shadow-[0_5px_12px_rgba(0,0,0,0.16)] ring-1 transition-all duration-250 max-[639px]:h-[1.08rem] max-[639px]:w-[1.08rem] sm:h-7 sm:w-7',
          isDarkMode
            ? 'left-[0.16rem] bg-white/18 ring-white/22'
            : 'left-[1.4rem] bg-blue-100/90 ring-blue-300/58 max-[639px]:left-[1.12rem] sm:left-[1.8rem]'
        )}
      />
      <span className="relative z-10 flex w-full items-center justify-between px-[0.28rem] max-[639px]:px-[0.24rem] sm:px-[0.35rem]">
        <Moon
          className={cn(
            'size-3 transition-colors max-[639px]:size-[0.68rem] sm:size-3.5',
            isDarkMode ? 'text-slate-100' : 'text-slate-400'
          )}
        />
        <Sun
          className={cn(
            'size-3 transition-colors max-[639px]:size-[0.68rem] sm:size-3.5',
            isDarkMode ? 'text-slate-500' : 'text-blue-600'
          )}
        />
      </span>
    </button>
  );
});
