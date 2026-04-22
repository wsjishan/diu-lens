'use client';

import { memo } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from './ThemeProvider';

export const ThemeToggle = memo(function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      className="group relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300/65 bg-white/72 text-slate-700 shadow-[0_12px_20px_-18px_rgba(30,64,175,0.6)] backdrop-blur-sm transition-all duration-200 hover:border-slate-400/70 hover:bg-white/86 hover:text-slate-900 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/45 dark:border-white/15 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-blue-300/35 dark:hover:bg-slate-900/90 dark:hover:text-blue-100 dark:focus-visible:ring-blue-400/55"
    >
      <Moon
        aria-hidden="true"
        className="absolute size-4 transition-transform transition-opacity duration-300 dark:-rotate-90 dark:scale-0 dark:opacity-0"
      />
      <Sun
        aria-hidden="true"
        className="absolute size-4 rotate-90 scale-0 opacity-0 transition-transform transition-opacity duration-300 dark:rotate-0 dark:scale-100 dark:opacity-100"
      />
    </button>
  );
});
