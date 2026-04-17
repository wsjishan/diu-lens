import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-slate-200/90 px-6 py-3 text-center dark:border-white/10 sm:text-left">
      <div className="flex flex-col items-center justify-between gap-2 sm:flex-row sm:items-center">
        <p className="text-[0.72rem] text-slate-500/75 dark:text-slate-400">
          Copyright {new Date().getFullYear()} DIU Lens. All rights reserved.
        </p>
        <nav
          id="support"
          aria-label="Footer links"
          className="flex items-center justify-center gap-3 sm:justify-start"
        >
          <a
            href="#"
            className="text-[0.72rem] font-medium text-slate-500/80 transition-colors hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"
          >
            Privacy Policy
          </a>
          <a
            href="#"
            className="text-[0.72rem] font-medium text-slate-500/80 transition-colors hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"
          >
            Support
          </a>
          <Link
            href="/admin/login"
            className="text-[0.72rem] font-medium text-slate-500/80 transition-colors hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"
          >
            Admin
          </Link>
        </nav>
      </div>
    </footer>
  );
}
