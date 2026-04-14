import type { RegistrationHighlight } from '@/features/registration/constants';

type HeroSectionProps = {
  highlights: RegistrationHighlight[];
};

export function HeroSection({ highlights }: HeroSectionProps) {
  return (
    <section className="space-y-5 lg:pr-3">
      <div className="space-y-4">
        <h1 className="max-w-[18ch] break-words text-3xl leading-tight font-bold tracking-[-0.02em] text-slate-900 dark:text-slate-50 sm:text-4xl lg:max-w-[15ch] lg:text-6xl">
          <span className="bg-linear-to-r from-slate-900 to-blue-700 bg-clip-text text-transparent dark:from-slate-100 dark:via-sky-300 dark:to-indigo-400 dark:[text-shadow:0_0_22px_rgba(56,189,248,0.24)]">
            Smart{' '}
            <span className="bg-linear-to-r from-blue-500 to-indigo-400 bg-clip-text text-transparent dark:from-sky-300 dark:to-indigo-300">
              Identification
            </span>
          </span>{' '}
          <span className="text-slate-900 dark:text-slate-200">
            for DIU Campus
          </span>
        </h1>
        <p
          id="how-it-works"
          className="max-w-[56ch] text-sm leading-6 text-slate-700 dark:text-slate-300 sm:text-base"
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
        <ol className="grid gap-y-2 text-sm text-slate-700 dark:text-slate-300 sm:grid-cols-[auto_auto] sm:items-center sm:gap-x-2.5 lg:flex lg:flex-wrap lg:items-center lg:gap-x-2.5 lg:gap-y-2">
          <li className="inline-flex items-center gap-1.5">
            <span className="inline-flex size-4.5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[0.63rem] font-medium text-blue-700 dark:bg-sky-500/16 dark:text-sky-300 dark:ring-1 dark:ring-sky-300/25">
              1
            </span>
            <span>Student ID check</span>
          </li>
          <span
            className="text-xs text-slate-300/80 dark:text-slate-600"
            aria-hidden="true"
          >
            →
          </span>
          <li className="inline-flex items-center gap-1.5">
            <span className="inline-flex size-4.5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[0.63rem] font-medium text-blue-700 dark:bg-sky-500/16 dark:text-sky-300 dark:ring-1 dark:ring-sky-300/25">
              2
            </span>
            <span>Basic information</span>
          </li>
          <span
            className="text-xs text-slate-300/80 dark:text-slate-600 sm:hidden lg:inline"
            aria-hidden="true"
          >
            →
          </span>
          <li className="inline-flex items-center gap-1.5 sm:col-span-2 lg:col-span-1">
            <span className="inline-flex size-4.5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[0.63rem] font-medium text-blue-700 dark:bg-sky-500/16 dark:text-sky-300 dark:ring-1 dark:ring-sky-300/25">
              3
            </span>
            <span>Face verification</span>
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
                className="size-1 rounded-full bg-blue-600/90 dark:bg-sky-400 dark:shadow-[0_0_10px_rgba(56,189,248,0.65)]"
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
