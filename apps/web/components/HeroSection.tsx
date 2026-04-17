import type { RegistrationHighlight } from '@/features/registration/constants';

type HeroSectionProps = {
  highlights: RegistrationHighlight[];
};

export function HeroSection({ highlights }: HeroSectionProps) {
  return (
    <section className="space-y-6 lg:pr-6">
      <div className="ai-float inline-flex items-center gap-2 rounded-full border border-blue-200/60 bg-white/80 px-3.5 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-blue-700 shadow-[0_12px_26px_-18px_rgba(37,99,235,0.6)] dark:border-white/10 dark:bg-[#0b1220] dark:text-slate-200 dark:shadow-[0_10px_24px_rgba(0,0,0,0.28)]">
        <span className="ai-pulse-ring inline-flex size-2 rounded-full bg-sky-400" />
        AI identity layer · Live
      </div>
      <div className="space-y-4 sm:space-y-5">
        <h1 className="max-w-[18ch] wrap-break-word text-4xl font-bold leading-[1.05] tracking-[-0.03em] text-slate-900 sm:text-5xl lg:max-w-[16ch] lg:text-6xl dark:text-white">
          <span className="bg-linear-to-r from-slate-900 to-blue-700 bg-clip-text text-transparent dark:from-slate-100 dark:to-blue-300">
            Smart identification
          </span>{' '}
          <span className="text-slate-900 dark:text-white">for DIU campus</span>
        </h1>
        <p
          id="how-it-works"
          className="max-w-xl text-base leading-7 text-slate-700 sm:text-lg dark:text-slate-300"
        >
          Verify once, reuse everywhere. DIU Lens keeps your campus access fast,
          secure, and consistent across services.
        </p>
      </div>
      <div
        id="for-students"
        className="max-w-152 space-y-3 sm:space-y-4"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-500/85 dark:text-slate-400">
            Registration flow
          </p>
          <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
            ~ 2 minutes
          </span>
        </div>
        <ol className="ai-flow-track grid gap-3 rounded-2xl bg-white/80 p-3 shadow-[0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-slate-200/70 sm:grid-cols-3 dark:bg-[#0b1220]/80 dark:ring-white/10">
          <li className="ai-flow-step flex items-start gap-2 rounded-xl border border-transparent bg-blue-50/70 px-3 py-2 text-sm text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:bg-blue-500/10 dark:text-slate-200">
            <span className="ai-flow-node inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[0.65rem] font-semibold text-blue-700 ring-1 ring-blue-200/80 dark:bg-blue-500/18 dark:text-slate-100 dark:ring-white/10">
              1
            </span>
            <div>
              <p className="ai-flow-label font-semibold">Student ID check</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Validate against DIU records
              </p>
            </div>
          </li>
          <li className="ai-flow-step flex items-start gap-2 rounded-xl border border-transparent px-3 py-2 text-sm text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-slate-200/60 dark:text-slate-200 dark:ring-white/10">
            <span className="ai-flow-node inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[0.65rem] font-semibold text-blue-700 ring-1 ring-blue-200/80 dark:bg-blue-500/18 dark:text-slate-100 dark:ring-white/10">
              2
            </span>
            <div>
              <p className="ai-flow-label font-semibold">Basic information</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Confirm contact and email
              </p>
            </div>
          </li>
          <li className="ai-flow-step flex items-start gap-2 rounded-xl border border-transparent px-3 py-2 text-sm text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-slate-200/60 dark:text-slate-200 dark:ring-white/10">
            <span className="ai-flow-node inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[0.65rem] font-semibold text-blue-700 ring-1 ring-blue-200/80 dark:bg-blue-500/18 dark:text-slate-100 dark:ring-white/10">
              3
            </span>
            <div>
              <p className="ai-flow-label font-semibold">Face verification</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Capture angles, get cleared
              </p>
            </div>
          </li>
        </ol>
        <div className="space-y-2">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500/85 dark:text-slate-400">
            Why students like it
          </p>
          <ul
            id="features"
            className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2 dark:text-slate-300"
            aria-label="Platform highlights"
          >
            {highlights.map((item) => (
              <li
                key={item.title}
                className="flex items-start gap-2 rounded-xl border border-transparent bg-white/80 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-slate-200/70 dark:bg-[#0b1220]/80 dark:ring-white/10"
              >
                <span
                  className="mt-1 size-1.5 rounded-full bg-blue-600 dark:bg-blue-400"
                  aria-hidden="true"
                />
                <span className="text-slate-700 dark:text-slate-300">
                  {item.title}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
