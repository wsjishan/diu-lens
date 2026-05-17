import { ArrowDown, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function HeroSection() {
  return (
    <section className="mx-auto flex min-h-[34rem] w-full max-w-[46rem] flex-col items-center justify-center px-0 py-10 text-center sm:min-h-[35rem] sm:py-12 lg:min-h-[37rem] lg:py-14">
      <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/24 bg-white/42 px-3 py-1.5 text-[0.6rem] font-semibold text-slate-700 uppercase shadow-[0_0_14px_rgba(30,64,175,0.055)] backdrop-blur-sm dark:border-blue-300/16 dark:bg-white/[0.045] dark:text-slate-300 dark:shadow-none">
        <span className="inline-flex size-2 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(56,189,248,0.5)] dark:bg-sky-400" />
        Face ID Verification
      </div>

      <div className="mt-5 space-y-3.5 sm:mt-6 sm:space-y-4">
        <h1 className="landing-text-primary mx-auto max-w-[12.5ch] text-[2.42rem] leading-[1.06] font-semibold sm:max-w-[13ch] sm:text-[3.2rem] lg:max-w-[13.5ch] lg:text-[4.15rem]">
          Smart{' '}
          <span className="bg-linear-to-r from-[#1d4f9d] via-[#2f6bcc] to-[#5a9ef1] bg-clip-text text-transparent dark:from-[#e6efff] dark:via-[#b3d4ff] dark:to-[#7fb8ff]">
            Identification
          </span>{' '}
          for DIU Campus
        </h1>

        <p className="landing-text-secondary mx-auto max-w-[34rem] text-[0.94rem] leading-7 text-slate-600/90 dark:text-slate-300/85 sm:text-[0.98rem]">
          Secure your campus identity with AI-powered facial verification
          designed for faster access, safer authentication, and trusted
          biometric validation across campus systems.
        </p>
      </div>

      <div className="mt-6 flex flex-col items-center gap-3">
        <Button
          asChild
          className="landing-button-bg landing-cta h-10 rounded-xl px-5 text-[0.9rem] text-white sm:h-[2.625rem] sm:px-6"
        >
          <a href="#start-verification">
            Start Verification
            <ArrowDown
              className="size-4"
              aria-hidden="true"
            />
          </a>
        </Button>

        <p className="landing-text-muted inline-flex items-center gap-2 text-[0.82rem]">
          <ShieldCheck
            className="size-3.5 text-emerald-500 dark:text-emerald-300"
            aria-hidden="true"
          />
          Trusted biometric onboarding for DIU students
        </p>
      </div>
    </section>
  );
}
