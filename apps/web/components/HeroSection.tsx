export function HeroSection() {
  return (
    <section className="space-y-7 text-left lg:space-y-9">
      <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/45 bg-blue-50/65 px-4 py-1.5 text-[0.66rem] font-semibold tracking-[0.16em] text-blue-900 uppercase shadow-[0_0_24px_rgba(30,64,175,0.12)] backdrop-blur-sm dark:border-blue-300/35 dark:bg-[#0c1c3c]/70 dark:text-slate-300 dark:shadow-[0_0_24px_rgba(30,64,175,0.2)]">
        <span className="inline-flex size-2 rounded-full bg-sky-500 shadow-[0_0_12px_rgba(56,189,248,0.8)] dark:bg-sky-400" />
        AI identity layer online
      </div>

      <div className="space-y-5 lg:space-y-6">
        <h1 className="landing-text-primary max-w-[13ch] text-[3rem] leading-[0.98] font-semibold tracking-[-0.035em] sm:text-[3.8rem] lg:max-w-[10.4ch] lg:text-[5.2rem]">
          Smart{' '}
          <span className="bg-linear-to-r from-[#164eaf] via-[#2871d8] to-[#3c92ff] bg-clip-text text-transparent dark:from-[#ecf2ff] dark:via-[#98c6ff] dark:to-[#5ea7ff]">
            Identification
          </span>
          <br />
          for DIU Campus
        </h1>

        <p
          id="how-it-works"
          className="landing-text-secondary max-w-[35rem] text-[1.06rem] leading-[1.48] lg:text-[1.02rem]"
        >
          Verify once and access DIU campus services without repeated
          verification steps. Secure identity registration, AI-powered face
          verification, Privacy-first data handling.
        </p>
      </div>

      <div id="for-students" className="pt-2">
        <ol className="grid grid-cols-3 gap-4 lg:max-w-[35.5rem]">
          {[
            { id: 1, label: 'Student ID check', active: true },
            { id: 2, label: 'Basic information', active: false },
            { id: 3, label: 'Face verification', active: false },
          ].map((item, index, arr) => (
            <li key={item.id} className="relative flex flex-col items-start gap-3">
              <div className="relative w-full">
                {index < arr.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="absolute left-[2.55rem] right-2 top-1/2 h-px -translate-y-1/2 bg-linear-to-r from-blue-300/60 to-slate-500/30 sm:left-[3rem] lg:left-[3.35rem]"
                  />
                ) : null}
                <span
                  className={item.active
                    ? 'relative z-10 inline-flex size-8 items-center justify-center rounded-full bg-linear-to-b from-[#2f8dff] to-[#1a67e5] text-[0.95rem] font-semibold text-white shadow-[0_0_28px_rgba(37,99,235,0.65)] ring-1 ring-blue-200/80 sm:size-10 sm:text-[1.06rem] lg:size-11 lg:text-[1.18rem]'
                    : 'relative z-10 inline-flex size-8 items-center justify-center rounded-full border border-slate-300/80 bg-slate-100/80 text-[0.92rem] font-medium text-slate-600 dark:border-slate-400/45 dark:bg-[#192844]/65 dark:text-slate-300 sm:size-10 sm:text-[1rem] lg:size-11 lg:text-[1.1rem]'}
                >
                  {item.id}
                </span>
              </div>
              <span className="landing-text-secondary text-[0.75rem] leading-tight sm:text-[0.9rem] lg:text-[1.09rem]">
                {item.label}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
