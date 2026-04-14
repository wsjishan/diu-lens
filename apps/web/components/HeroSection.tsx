import type { RegistrationHighlight } from '@/features/registration/constants';

type HeroSectionProps = {
  highlights: RegistrationHighlight[];
};

export function HeroSection({ highlights }: HeroSectionProps) {
  return (
    <section className="space-y-5 lg:pr-3">
      <div className="space-y-4">
        <h1 className="max-w-[15ch] text-[2.25rem] leading-none font-bold tracking-[-0.02em] text-slate-900 sm:text-[2.65rem] lg:text-[2.85rem]">
          <span className="bg-linear-to-r from-slate-900 to-blue-700 bg-clip-text text-transparent">
            Smart Identification
          </span>{' '}
          <span className="text-slate-900">for DIU Campus</span>
        </h1>
        <p
          id="how-it-works"
          className="max-w-[56ch] text-[0.96rem] leading-6 text-slate-700 sm:text-base"
        >
          Verify once and access DIU campus services without repeated
          verification steps.
        </p>
      </div>
      <div
        id="for-students"
        className="max-w-152 space-y-2"
      >
        <p className="text-[0.65rem] font-semibold tracking-widest text-slate-500/85 uppercase">
          Registration flow
        </p>
        <ol className="grid gap-y-2 text-sm text-slate-700 sm:grid-cols-[auto_auto] sm:items-center sm:gap-x-2.5 lg:flex lg:flex-wrap lg:items-center lg:gap-x-2.5 lg:gap-y-2">
          <li className="inline-flex items-center gap-1.5">
            <span className="inline-flex size-4.5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[0.63rem] font-medium text-blue-700">
              1
            </span>
            <span>Student ID check</span>
          </li>
          <span
            className="text-xs text-slate-300/80"
            aria-hidden="true"
          >
            →
          </span>
          <li className="inline-flex items-center gap-1.5">
            <span className="inline-flex size-4.5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[0.63rem] font-medium text-blue-700">
              2
            </span>
            <span>Basic information</span>
          </li>
          <span
            className="text-xs text-slate-300/80 sm:hidden lg:inline"
            aria-hidden="true"
          >
            →
          </span>
          <li className="inline-flex items-center gap-1.5 sm:col-span-2 lg:col-span-1">
            <span className="inline-flex size-4.5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[0.63rem] font-medium text-blue-700">
              3
            </span>
            <span>Face verification</span>
          </li>
        </ol>
        <ul
          id="features"
          className="mt-5 grid gap-1.5 text-[0.8rem] text-slate-600/85"
          aria-label="Platform highlights"
        >
          {highlights.map((item) => (
            <li
              key={item.title}
              className="inline-flex items-center gap-1.5"
            >
              <span
                className="size-1 rounded-full bg-blue-600/90"
                aria-hidden="true"
              />
              <span className="text-slate-600/85">{item.title}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
