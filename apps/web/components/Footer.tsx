export function Footer() {
  return (
    <footer className="mt-3 border-t border-slate-200/90 py-5 sm:py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500/75">
          Copyright {new Date().getFullYear()} DIU Lens. All rights reserved.
        </p>
        <nav
          aria-label="Footer links"
          className="flex items-center gap-4"
        >
          <a
            href="#"
            className="text-xs font-medium text-slate-500/80 transition-colors hover:text-slate-600"
          >
            Privacy Policy
          </a>
          <a
            href="#"
            className="text-xs font-medium text-slate-500/80 transition-colors hover:text-slate-600"
          >
            Support
          </a>
        </nav>
      </div>
    </footer>
  );
}
