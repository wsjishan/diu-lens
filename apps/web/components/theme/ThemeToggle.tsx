'use client';

import { memo } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from './ThemeProvider';

export const ThemeToggle = memo(function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';
  const Icon = isDarkMode ? Moon : Sun;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      className="group relative inline-flex size-[1.875rem] items-center justify-center rounded-lg border border-slate-300/55 bg-white/45 text-slate-600 shadow-[0_6px_16px_-14px_rgba(15,23,42,0.36)] backdrop-blur-sm transition-[background-color,border-color,color,box-shadow,transform] duration-100 ease-out hover:border-slate-400/65 hover:bg-white/75 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/40 active:scale-[0.97] dark:border-white/12 dark:bg-white/[0.045] dark:text-slate-300 dark:hover:border-white/18 dark:hover:bg-white/9 dark:hover:text-white sm:size-8"
    >
      <span className="absolute inset-[3px] rounded-[0.45rem] bg-slate-950/[0.025] opacity-0 transition-opacity duration-100 group-hover:opacity-100 dark:bg-white/[0.04]" />
      <span className="relative flex size-3.5 items-center justify-center sm:size-4">
        <Icon
          className={cn(
            'size-3.5 transition-[opacity,transform,color] duration-100 ease-out sm:size-4',
            isDarkMode
              ? 'text-slate-100'
              : 'rotate-0 text-blue-600 group-hover:text-blue-700'
          )}
          aria-hidden="true"
        />
      </span>
    </button>
  );
});
