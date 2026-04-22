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
      className="relative flex h-10 w-[4.65rem] items-center rounded-full border border-slate-300/80 bg-white/72 px-1 text-slate-600 backdrop-blur-md transition-colors duration-200 hover:border-slate-400/80 hover:bg-white/88 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60 dark:border-white/20 dark:bg-[#0b1a36]/65 dark:text-slate-300 dark:hover:border-white/30 dark:hover:bg-[#0f2347]/75"
    >
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute top-1 h-8 w-8 rounded-full shadow-[0_8px_20px_rgba(0,0,0,0.18)] ring-1 transition-all duration-250',
          isDarkMode
            ? 'left-1 bg-white/22 ring-white/28'
            : 'left-[2.25rem] bg-blue-100/90 ring-blue-300/65'
        )}
      />
      <span className="relative z-10 flex w-full items-center justify-between px-1">
        <Moon className={cn('size-4 transition-colors', isDarkMode ? 'text-slate-100' : 'text-slate-400')} />
        <Sun className={cn('size-4 transition-colors', isDarkMode ? 'text-slate-400' : 'text-blue-600')} />
      </span>
    </button>
  );
});
