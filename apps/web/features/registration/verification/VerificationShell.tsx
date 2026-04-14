import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type VerificationShellProps = {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
};

export function VerificationShell({
  title,
  description,
  children,
  className,
}: VerificationShellProps) {
  return (
    <section className={cn('flex flex-col gap-5 sm:gap-6', className)}>
      <header className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
          {title}
        </h2>
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
          {description}
        </p>
      </header>
      {children}
    </section>
  );
}
