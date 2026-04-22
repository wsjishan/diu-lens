import Link from 'next/link';

export function Footer() {
  return (
    <footer className="flex flex-col items-start justify-between gap-4 pt-7 text-[0.92rem] sm:flex-row sm:items-end sm:gap-6 lg:pt-8">
      <p className="landing-text-muted">
        Copyright {new Date().getFullYear()} DIU Lens. All rights reserved.
      </p>
      <nav
        id="support"
        aria-label="Footer links"
        className="flex items-center gap-7"
      >
        <a href="#" className="landing-link">
          Privacy Policy
        </a>
        <a href="#" className="landing-link">
          Support
        </a>
        <Link href="/admin/login" className="landing-link">
          Admin
        </Link>
      </nav>
    </footer>
  );
}
