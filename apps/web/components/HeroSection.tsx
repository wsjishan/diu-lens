const heroSteps = [
  { id: 1, label: 'Student ID check', active: true },
  { id: 2, label: 'Basic information', active: false },
  { id: 3, label: 'Face verification', active: false },
] as const;

export function HeroSection() {
  return (
    <section className="space-y-4 text-left lg:space-y-[1.65rem]">
      <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-300/45 bg-blue-50/65 px-3 py-1.5 text-[0.56rem] font-semibold tracking-[0.13em] text-blue-900 uppercase shadow-[0_0_20px_rgba(30,64,175,0.11)] backdrop-blur-sm dark:border-blue-300/35 dark:bg-[#0c1c3c]/70 dark:text-slate-300 dark:shadow-[0_0_22px_rgba(30,64,175,0.17)] sm:gap-2 sm:px-3.5 sm:text-[0.62rem] sm:tracking-[0.15em]">
        <span className="inline-flex size-2 rounded-full bg-sky-500 shadow-[0_0_12px_rgba(56,189,248,0.8)] dark:bg-sky-400" />
        AI identity layer online
      </div>

      <div className="space-y-[0.8rem] lg:space-y-[1.125rem]">
        <h1 className="landing-text-primary max-w-[10.8ch] text-[1.72rem] leading-[1] font-semibold tracking-[-0.028em] sm:max-w-[12.5ch] sm:text-[2.55rem] lg:max-w-[10.1ch] lg:text-[4.08rem]">
          Smart{' '}
          <span className="bg-linear-to-r from-[#164eaf] via-[#2871d8] to-[#3c92ff] bg-clip-text text-transparent dark:from-[#ecf2ff] dark:via-[#98c6ff] dark:to-[#5ea7ff]">
            Identification
          </span>
          <br />
          for DIU Campus
        </h1>

        <p
          id="how-it-works"
          className="landing-text-secondary max-w-[19.75rem] text-[0.8rem] leading-[1.52] sm:max-w-[26rem] sm:text-[0.91rem] lg:max-w-[28.5rem] lg:text-[0.94rem]"
        >
          Verify once and access DIU campus services without repeated
          verification steps. Secure identity registration, AI-powered face
          verification, Privacy-first data handling.
        </p>
      </div>

      <div id="for-students" className="pt-0.5">
        <ol className="flex flex-col gap-2.5 sm:grid sm:grid-cols-3 sm:gap-3 lg:max-w-[31.25rem]">
          {heroSteps.map((item, index, arr) => (
            <li key={item.id} className="relative flex items-center gap-2.5 sm:flex-col sm:items-start sm:gap-2 sm:text-left">
              <div className="relative w-auto sm:w-full">
                {index < arr.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="absolute left-[0.85rem] top-[1.45rem] h-4 w-px bg-linear-to-b from-blue-300/56 to-slate-500/26 sm:hidden"
                  />
                ) : null}
                {index < arr.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="absolute left-[1.95rem] right-1 top-1/2 hidden h-px -translate-y-1/2 bg-linear-to-r from-blue-300/56 to-slate-500/26 sm:block sm:left-[2.45rem] lg:left-[3.05rem]"
                  />
                ) : null}
                <span
                  className={item.active
                    ? 'relative z-10 inline-flex size-[1.7rem] items-center justify-center rounded-full bg-linear-to-b from-[#2f8dff] to-[#1a67e5] text-[0.78rem] font-semibold text-white shadow-[0_0_20px_rgba(37,99,235,0.55)] ring-1 ring-blue-200/76 sm:size-[1.95rem] sm:text-[0.86rem] lg:size-[2.375rem] lg:text-[0.98rem]'
                    : 'relative z-10 inline-flex size-[1.7rem] items-center justify-center rounded-full border border-slate-300/76 bg-slate-100/78 text-[0.76rem] font-medium text-slate-600 dark:border-slate-400/43 dark:bg-[#192844]/62 dark:text-slate-300 sm:size-[1.95rem] sm:text-[0.8rem] lg:size-[2.375rem] lg:text-[0.93rem]'}
                >
                  {item.id}
                </span>
              </div>
              <span className="landing-text-secondary text-[0.74rem] leading-tight sm:text-[0.72rem] lg:text-[0.9rem]">
                {item.label}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function MobileHeroIntro() {
  return (
    <section className="space-y-3.5">
      <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-300/40 bg-blue-50/60 px-2.5 py-1 text-[0.5rem] font-semibold tracking-[0.11em] text-blue-900 uppercase shadow-[0_0_14px_rgba(30,64,175,0.08)] dark:border-blue-300/28 dark:bg-[#0c1c3c]/58 dark:text-slate-300">
        <span className="inline-flex size-1.5 rounded-full bg-sky-500 dark:bg-sky-400" />
        AI identity layer online
      </div>

      <div className="space-y-2">
        <h1 className="landing-text-primary max-w-[14ch] text-[1.68rem] leading-[1.02] font-semibold tracking-[-0.022em]">
          Smart{' '}
          <span className="bg-linear-to-r from-[#164eaf] via-[#2871d8] to-[#3c92ff] bg-clip-text text-transparent dark:from-[#ecf2ff] dark:via-[#98c6ff] dark:to-[#5ea7ff]">
            Identification
          </span>{' '}
          for DIU Campus
        </h1>

        <p
          id="how-it-works"
          className="landing-text-secondary max-w-[30ch] text-[0.76rem] leading-[1.4]"
        >
          Verify once and access DIU campus services without repeated
          verification steps. Secure identity registration, AI-powered face
          verification, Privacy-first data handling.
        </p>
      </div>
    </section>
  );
}

export function MobileOnboardingStepper() {
  return (
    <section id="for-students" aria-label="Registration flow steps" className="px-0.5">
      <ol className="space-y-2">
        {heroSteps.map((item, index, arr) => (
          <li key={item.id} className="relative flex items-center gap-2">
            {index < arr.length - 1 ? (
              <span
                aria-hidden="true"
                className="absolute left-[0.375rem] top-[1rem] h-[1.1rem] w-px bg-linear-to-b from-blue-300/42 to-slate-400/24"
              />
            ) : null}
            <span
              className={item.active
                ? 'relative z-10 inline-flex size-3 items-center justify-center rounded-full bg-[#1a67e5] ring-2 ring-blue-200/58 dark:ring-blue-200/26'
                : 'relative z-10 inline-flex size-3 items-center justify-center rounded-full border border-slate-300/72 bg-slate-100/68 dark:border-slate-500/38 dark:bg-[#1a2742]/58'}
            />
            <span className="landing-text-secondary text-[0.72rem] leading-none">{item.label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
