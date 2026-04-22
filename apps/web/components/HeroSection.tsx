import type { RegistrationHighlight } from '@/features/registration/constants';

type HeroSectionProps = {
  highlights: RegistrationHighlight[];
};

export function HeroSection({ highlights }: HeroSectionProps) {
  return (
    <section className="space-y-6 text-left sm:space-y-7 lg:space-y-9 lg:pr-2">
      <div className="ai-float inline-flex items-center gap-2 rounded-full border border-blue-200/75 bg-white/56 px-3 py-1.5 text-[0.65rem] font-semibold tracking-[0.16em] text-blue-700 uppercase shadow-[0_12px_24px_-20px_rgba(37,99,235,0.56)] dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-300 dark:shadow-[0_10px_24px_rgba(0,0,0,0.24)]">
        <span className="ai-pulse-ring inline-flex size-2 rounded-full bg-sky-400" />
        AI Identity Layer Online
      </div>
      <div className="space-y-4 sm:space-y-6">
        <h1 className="max-w-[16ch] text-3xl leading-[1.07] font-semibold tracking-[-0.03em] sm:max-w-[18ch] sm:text-4xl md:text-[2.45rem] lg:max-w-[13.5ch] lg:text-[3.2rem]">
          <span className="block bg-linear-to-r from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-transparent dark:from-slate-100 dark:via-slate-200 dark:to-slate-300">
            Smart{' '}
            <span className="bg-linear-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
              Identification
            </span>
          </span>
          <span className="landing-text-primary mt-1 block">for DIU Campus</span>
        </h1>
        <p
          id="how-it-works"
          className="landing-text-secondary max-w-lg text-[0.92rem] leading-6 sm:text-[0.98rem] sm:leading-7"
        >
          Complete onboarding once, then move across campus services with secure
          identity access and fewer verification interruptions.
        </p>
      </div>
      <div
        id="for-students"
        className="max-w-3xl space-y-4"
      >
        <p className="landing-text-muted text-[0.65rem] font-semibold tracking-[0.16em] uppercase">
          Registration flow
        </p>
        <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-2.5">
          <li className="relative flex items-center gap-2.5 rounded-xl border border-blue-200/70 bg-white/65 px-3 py-2 shadow-[0_8px_20px_-20px_rgba(37,99,235,0.7)] dark:border-blue-300/18 dark:bg-slate-900/46">
            <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[0.63rem] font-semibold text-white shadow-[0_0_0_3px_rgba(37,99,235,0.2)] dark:bg-blue-400 dark:text-slate-950 dark:shadow-[0_0_0_3px_rgba(59,130,246,0.2)]">
              1
            </span>
            <span className="landing-text-primary text-[0.8rem] font-semibold">
              Student ID check
            </span>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 -right-2 hidden h-px w-4 -translate-y-1/2 bg-linear-to-r from-blue-400/55 to-transparent sm:block"
            />
          </li>
          <li className="relative flex items-center gap-2.5 rounded-xl border border-slate-200/70 bg-white/58 px-3 py-2 dark:border-white/12 dark:bg-slate-900/40">
            <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-blue-200/70 bg-blue-100/90 text-[0.63rem] font-semibold text-blue-700 dark:border-white/12 dark:bg-blue-500/18 dark:text-slate-200">
              2
            </span>
            <span className="landing-text-secondary text-[0.8rem] font-medium">
              Basic information
            </span>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 -right-2 hidden h-px w-4 -translate-y-1/2 bg-linear-to-r from-blue-400/45 to-transparent sm:block"
            />
          </li>
          <li className="flex items-center gap-2.5 rounded-xl border border-slate-200/70 bg-white/58 px-3 py-2 dark:border-white/12 dark:bg-slate-900/40">
            <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-blue-200/70 bg-blue-100/90 text-[0.63rem] font-semibold text-blue-700 dark:border-white/12 dark:bg-blue-500/18 dark:text-slate-200">
              3
            </span>
            <span className="landing-text-secondary text-[0.8rem] font-medium">
              Face verification
            </span>
          </li>
        </ol>
        <ul
          id="features"
          className="landing-text-muted mt-4 grid gap-1.5 text-[0.8rem]"
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
              <span>{item.title}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
