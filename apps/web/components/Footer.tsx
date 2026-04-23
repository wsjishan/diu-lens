import Link from 'next/link';

export function Footer() {
  return (
    <footer className="flex flex-col items-center justify-between gap-3.5 pt-5 text-[0.79rem] sm:flex-row sm:items-end sm:gap-5 sm:text-[0.84rem] lg:pt-7">
      <p className="landing-text-muted text-center sm:text-left">
        Copyright {new Date().getFullYear()} DIU Lens. All rights reserved.
      </p>
      <nav
        id="support"
        aria-label="Footer links"
        className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 sm:justify-end sm:gap-6"
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
