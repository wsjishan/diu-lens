import Link from 'next/link';

export function Footer() {
  return (
    <footer className="flex flex-col items-center justify-between gap-3.5 pt-4 text-[0.79rem] max-[639px]:mt-0 max-[639px]:gap-2.5 max-[639px]:border-t max-[639px]:border-[#11263c] max-[639px]:pt-[1.125rem] max-[639px]:text-[0.57rem] sm:flex-row sm:items-end sm:gap-5 sm:pt-5 sm:text-[0.84rem] lg:pt-7">
      <p className="landing-text-muted text-center max-[639px]:order-2 max-[639px]:text-[#465b72] sm:text-left">
        © 2024 DIU Lens Identity System.
      </p>
      <nav
        id="support"
        aria-label="Footer links"
        className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 max-[639px]:order-1 max-[639px]:gap-x-4 max-[639px]:gap-y-1 max-[639px]:font-semibold max-[639px]:text-[#8b9bb0] sm:justify-end sm:gap-6"
      >
        <a
          href="#"
          className="landing-link"
        >
          Privacy Policy
        </a>
        <a
          href="#"
          className="landing-link"
        >
          Support
        </a>
        <Link
          href="/admin/login"
          className="landing-link"
        >
          Admin
        </Link>
      </nav>
    </footer>
  );
}
