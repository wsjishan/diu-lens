import Link from 'next/link';

export function Footer() {
  return (
    <footer className="landing-topbar border-t px-4 py-3.5 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center justify-between gap-2.5 sm:flex-row sm:items-center">
        <p className="landing-text-muted text-center text-[0.72rem] sm:text-left">
          Copyright {new Date().getFullYear()} DIU Lens. All rights reserved.
        </p>
        <nav
          id="support"
          aria-label="Footer links"
          className="flex flex-wrap items-center justify-center gap-4 sm:justify-start"
        >
          <a
            href="#"
            className="landing-link rounded-md px-1.5 py-0.5 text-[0.72rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/45 dark:focus-visible:ring-blue-400/55"
          >
            Privacy Policy
          </a>
          <span
            aria-hidden="true"
            className="landing-text-muted hidden text-[0.65rem] sm:inline"
          >
            •
          </span>
          <a
            href="#"
            className="landing-link rounded-md px-1.5 py-0.5 text-[0.72rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/45 dark:focus-visible:ring-blue-400/55"
          >
            Support
          </a>
          <span
            aria-hidden="true"
            className="landing-text-muted hidden text-[0.65rem] sm:inline"
          >
            •
          </span>
          <Link
            href="/admin/login"
            className="landing-link rounded-md px-1.5 py-0.5 text-[0.72rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/45 dark:focus-visible:ring-blue-400/55"
          >
            Admin
          </Link>
        </nav>
      </div>
    </footer>
  );
}
