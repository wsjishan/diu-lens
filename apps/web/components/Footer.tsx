export function Footer() {
  return (
    <footer className="mt-7 border-t border-slate-200/90 px-4 py-3 text-center sm:px-6 sm:py-3.5 sm:text-left lg:px-8">
      <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[0.72rem] text-slate-500/75">
          Copyright {new Date().getFullYear()} DIU Lens. All rights reserved.
        </p>
        <nav
          id="support"
          aria-label="Footer links"
          className="flex items-center justify-center gap-3 sm:justify-start"
        >
          <a
            href="#"
            className="text-[0.72rem] font-medium text-slate-500/80 transition-colors hover:text-slate-600"
          >
            Privacy Policy
          </a>
          <a
            href="#"
            className="text-[0.72rem] font-medium text-slate-500/80 transition-colors hover:text-slate-600"
          >
            Support
          </a>
          <a
            href="#"
            className="text-[0.72rem] font-medium text-slate-500/80 transition-colors hover:text-slate-600"
          >
            Admin
          </a>
        </nav>
      </div>
    </footer>
  );
}
