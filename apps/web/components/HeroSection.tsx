import type { RegistrationHighlight } from '@/features/registration/constants';

type HeroSectionProps = {
  highlights: RegistrationHighlight[];
};

export function HeroSection({ highlights }: HeroSectionProps) {
  return (
    <section className="space-y-5 lg:pr-3">
      <div className="ai-float inline-flex items-center gap-2 rounded-full border border-blue-200/70 bg-white/75 px-3 py-1.5 text-[0.68rem] font-semibold tracking-[0.16em] text-blue-700 uppercase shadow-[0_10px_24px_-20px_rgba(37,99,235,0.7)] backdrop-blur-sm dark:border-white/10 dark:bg-[#0b1220] dark:text-slate-300 dark:shadow-[0_10px_24px_rgba(0,0,0,0.28)]">
        <span className="ai-pulse-ring inline-flex size-2 rounded-full bg-sky-400" />
        AI Identity Layer Online
      </div>
      <div className="space-y-4">
        <h1 className="max-w-[18ch] wrap-break-word text-3xl leading-tight font-bold tracking-[-0.02em] text-slate-900 dark:text-white sm:text-4xl lg:max-w-[15ch] lg:text-6xl">
          <span className="bg-linear-to-r from-slate-900 to-blue-700 bg-clip-text text-transparent dark:from-slate-100 dark:to-blue-300">
            Smart{' '}
            <span className="bg-linear-to-r from-blue-500 to-indigo-400 bg-clip-text text-transparent dark:from-blue-300 dark:to-blue-200">
              Identification
            </span>
          </span>{' '}
          <span className="text-slate-900 dark:text-white">for DIU Campus</span>
        </h1>
        <p
          id="how-it-works"
          className="max-w-md text-sm leading-6 text-slate-700 dark:text-slate-300 sm:text-base"
        >
          Verify once and access DIU campus services without repeated
          verification steps.
        </p>
      </div>
      <div
        id="for-students"
        className="max-w-152 space-y-2"
      >
        <p className="text-[0.65rem] font-semibold tracking-widest text-slate-500/85 uppercase dark:text-slate-400">
          Registration flow
        </p>
        <ol className="ai-flow-track flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-300 sm:grid sm:grid-cols-[auto_auto] sm:items-center sm:gap-x-2.5 lg:flex lg:flex-wrap lg:flex-row lg:items-center lg:gap-x-2.5 lg:gap-y-2">
          <li className="ai-flow-step inline-flex items-center gap-1.5">
            <span className="ai-flow-node inline-flex size-4.5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[0.63rem] font-medium text-blue-700 dark:bg-blue-500/18 dark:text-slate-200 dark:ring-1 dark:ring-white/10">
              1
            </span>
            <span className="ai-flow-label">Student ID check</span>
          </li>
          <span
            className="ai-flow-arrow hidden text-xs text-slate-300/80 dark:text-slate-600 sm:inline"
            aria-hidden="true"
          >
            →
          </span>
          <li className="ai-flow-step inline-flex items-center gap-1.5">
            <span className="ai-flow-node inline-flex size-4.5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[0.63rem] font-medium text-blue-700 dark:bg-blue-500/18 dark:text-slate-200 dark:ring-1 dark:ring-white/10">
              2
            </span>
            <span className="ai-flow-label">Basic information</span>
          </li>
          <span
            className="ai-flow-arrow hidden text-xs text-slate-300/80 dark:text-slate-600 lg:inline"
            aria-hidden="true"
          >
            →
          </span>
          <li className="ai-flow-step inline-flex items-center gap-1.5 sm:col-span-2 lg:col-span-1">
            <span className="ai-flow-node inline-flex size-4.5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[0.63rem] font-medium text-blue-700 dark:bg-blue-500/18 dark:text-slate-200 dark:ring-1 dark:ring-white/10">
              3
            </span>
            <span className="ai-flow-label">Face verification</span>
          </li>
        </ol>
        <ul
          id="features"
          className="mt-5 grid gap-1.5 text-[0.8rem] text-slate-600/85 dark:text-slate-400"
          aria-label="Platform highlights"
        >
          {highlights.map((item) => (
            <li
              key={item.title}
              className="inline-flex items-center gap-1.5"
            >
              <span
                className="size-1 rounded-full bg-blue-600/90 dark:bg-blue-400"
                aria-hidden="true"
              />
              <span className="text-slate-600/85 dark:text-slate-400">
                {item.title}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
