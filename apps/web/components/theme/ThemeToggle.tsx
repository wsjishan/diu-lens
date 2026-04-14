'use client';

import { memo } from 'react';
import { useTheme } from './ThemeProvider';

export const ThemeToggle = memo(function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      className="group relative flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-slate-700 shadow-sm ring-1 ring-black/5 backdrop-blur-md transition-all duration-200 hover:scale-105 hover:bg-gray-200 hover:shadow-md active:scale-95 dark:bg-slate-800/60 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800 dark:hover:shadow-[0_0_0_1px_rgba(51,65,85,0.85),0_0_18px_rgba(34,211,238,0.35)]"
    >
      <span
        aria-hidden="true"
        className="absolute text-base leading-none transition-transform transition-opacity duration-300 dark:-rotate-90 dark:scale-0 dark:opacity-0"
      >
        🌙
      </span>
      <span
        aria-hidden="true"
        className="absolute text-base leading-none rotate-90 scale-0 opacity-0 transition-transform transition-opacity duration-300 dark:rotate-0 dark:scale-100 dark:opacity-100"
      >
        ☀️
      </span>
    </button>
  );
});
