'use client';

import { Circle, CircleCheck, IdCard, ScanFace, UserRound } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const heroSteps = [
  {
    id: 1,
    label: 'Student ID check',
    description: 'Verify institutional identity',
    headline: 'Use your DIU student ID',
    body: 'Start with your institutional ID to validate identity ownership.',
    accent: 'Face ID verification',
    Icon: IdCard,
  },
  {
    id: 2,
    label: 'Basic information',
    description: 'Confirm profile details',
    headline: 'Confirm your profile details',
    body: 'Provide name, phone, and university email before biometric capture.',
    accent: 'Profile details',
    Icon: UserRound,
  },
  {
    id: 3,
    label: 'Face verification',
    description: 'Setup biometric access',
    headline: 'Complete face verification',
    body: 'Capture guided face angles to finish biometric onboarding securely.',
    accent: 'Biometric setup',
    Icon: ScanFace,
  },
] as const;

const mobileNavSteps = [
  { label: 'ID Check', Icon: IdCard },
  { label: 'Basic Info', Icon: UserRound },
  { label: 'Face Prep', Icon: ScanFace },
  { label: 'Complete', Icon: CircleCheck },
] as const;

type HeroSectionProps = {
  activeStep?: number;
};

export function HeroSection({ activeStep = 0 }: HeroSectionProps) {
  const heroStepIndex = Math.max(0, Math.min(activeStep, heroSteps.length - 1));
  const currentHeroStep = heroSteps[heroStepIndex];

  return (
    <section className="space-y-4 text-left lg:space-y-[1.65rem]">
      <AnimatePresence
        mode="wait"
        initial={false}
      >
        <motion.div
          key={`hero-accent-${currentHeroStep.id}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
          className="inline-flex items-center gap-2 rounded-full border border-blue-300/45 bg-blue-50/65 px-3.5 py-1.5 text-[0.62rem] font-semibold tracking-[0.15em] text-blue-900 uppercase shadow-[0_0_20px_rgba(30,64,175,0.11)] backdrop-blur-sm dark:border-blue-300/35 dark:bg-[#0c1c3c]/70 dark:text-slate-300 dark:shadow-[0_0_22px_rgba(30,64,175,0.17)]"
        >
          <span className="inline-flex size-2 rounded-full bg-sky-500 shadow-[0_0_12px_rgba(56,189,248,0.8)] dark:bg-sky-400" />
          {currentHeroStep.accent}
        </motion.div>
      </AnimatePresence>

      <div className="space-y-[0.8rem] lg:space-y-[1.125rem]">
        <h1 className="landing-text-primary max-w-[12.5ch] text-[2.55rem] leading-[1] font-semibold tracking-[-0.028em] lg:max-w-[10.1ch] lg:text-[4.08rem]">
          Smart{' '}
          <span className="bg-linear-to-r from-[#164eaf] via-[#2871d8] to-[#3c92ff] bg-clip-text text-transparent dark:from-[#ecf2ff] dark:via-[#98c6ff] dark:to-[#5ea7ff]">
            Identification
          </span>
          <br />
          for DIU Campus
        </h1>

        <AnimatePresence
          mode="wait"
          initial={false}
        >
          <motion.div
            key={`hero-context-${currentHeroStep.id}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.24, ease: [0.2, 0.7, 0.2, 1] }}
            className="space-y-2 rounded-xl border border-slate-200/65 bg-white/45 p-3.5 dark:border-white/10 dark:bg-slate-900/36"
          >
            <p className="landing-text-primary text-[0.9rem] font-semibold lg:text-[0.96rem]">
              {currentHeroStep.headline}
            </p>
            <p
              id="how-it-works"
              className="landing-text-secondary max-w-[26rem] text-[0.86rem] leading-[1.5] lg:max-w-[28.5rem] lg:text-[0.91rem]"
            >
              {currentHeroStep.body}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div
        id="for-students"
        className="pt-0.5"
      >
        <ol className="grid grid-cols-3 gap-3 lg:max-w-[31.25rem]">
          {heroSteps.map((item, index, arr) => (
            <li
              key={item.id}
              className="relative flex flex-col items-start gap-2 text-left"
            >
              <div className="relative w-full">
                {index < arr.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="absolute left-[2.45rem] right-1 top-1/2 h-px -translate-y-1/2 bg-linear-to-r from-blue-300/56 to-slate-500/26 lg:left-[3.05rem]"
                  />
                ) : null}
                <span
                  className={
                    index === heroStepIndex
                      ? 'relative z-10 inline-flex size-[1.95rem] items-center justify-center rounded-full bg-linear-to-b from-[#2f8dff] to-[#1a67e5] text-[0.86rem] font-semibold text-white shadow-[0_0_20px_rgba(37,99,235,0.55)] ring-1 ring-blue-200/76 lg:size-[2.375rem] lg:text-[0.98rem]'
                      : index < heroStepIndex
                        ? 'relative z-10 inline-flex size-[1.95rem] items-center justify-center rounded-full bg-linear-to-b from-[#206bcf] to-[#1a5ec6] text-[0.86rem] font-semibold text-white shadow-[0_0_16px_rgba(37,99,235,0.32)] ring-1 ring-blue-200/55 lg:size-[2.375rem] lg:text-[0.98rem]'
                        : 'relative z-10 inline-flex size-[1.95rem] items-center justify-center rounded-full border border-slate-300/76 bg-slate-100/78 text-[0.8rem] font-medium text-slate-600 dark:border-slate-400/43 dark:bg-[#192844]/62 dark:text-slate-300 lg:size-[2.375rem] lg:text-[0.93rem]'
                  }
                >
                  {item.id}
                </span>
              </div>
              <span className="landing-text-secondary text-[0.72rem] leading-tight lg:text-[0.9rem]">
                {item.label}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

type MobileOnboardingStepperProps = {
  activeIndex: number;
};

export function MobileHeroIntro() {
  return (
    <section className="space-y-4 text-center">
      <div className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-[#1d4266]/76 bg-[#102644]/72 px-2.5 py-[0.31rem] text-[0.47rem] font-bold tracking-[0.11em] text-[#b7cce5] uppercase shadow-[0_0_14px_rgba(71,154,255,0.14)]">
        <span className="inline-flex size-1.5 rounded-full bg-[#67b7ff] shadow-[0_0_8px_rgba(96,181,255,0.72)]" />
        AI identity layer online
      </div>

      <div className="space-y-3">
        <h1 className="mx-auto max-w-[11.3ch] text-[2.03rem] leading-[1.2] font-bold tracking-[-0.01em] text-[#d8e9ff]">
          Smart
          <br />
          Identification
          <br />
          <span className="text-[#4fa3ff]">for DIU Campus</span>
        </h1>

        <p className="mx-auto max-w-[30ch] text-[0.76rem] leading-[1.54] text-[#aebfd3]">
          Verify your identity once to securely access campus services,
          examination halls, and automated registration systems.
        </p>
      </div>
    </section>
  );
}

export function MobileOnboardingStepper({
  activeIndex,
}: MobileOnboardingStepperProps) {
  const heroStepIndex = Math.max(
    0,
    Math.min(activeIndex, heroSteps.length - 1)
  );

  return (
    <section
      aria-label="Registration flow steps"
      className="mx-auto w-full"
    >
      <p className="text-[1.09rem] leading-none font-bold tracking-[-0.01em] text-[#c5d5e9]">
        Registration Flow
      </p>
      <ol className="mt-4 space-y-3.5">
        {heroSteps.map((item, index, arr) => (
          <li
            key={item.id}
            className="relative flex min-w-0 items-start gap-3"
          >
            {index < arr.length - 1 ? (
              <span
                aria-hidden="true"
                className="absolute left-[0.85rem] top-[1.64rem] h-[1.78rem] w-px bg-[#2a4260]"
              />
            ) : null}
            <span
              className={
                index <= heroStepIndex
                  ? 'relative z-10 inline-flex size-[1.7rem] shrink-0 items-center justify-center rounded-full border border-[#5eb2ff] bg-[#08213f] text-[#55aaff] shadow-[0_0_16px_rgba(64,157,255,0.3)]'
                  : 'relative z-10 inline-flex size-[1.7rem] shrink-0 items-center justify-center rounded-full border border-[#2e435d] bg-[#0a1829] text-[#53687f]'
              }
            >
              <item.Icon
                className="size-[0.87rem]"
                aria-hidden="true"
              />
            </span>
            <div className="min-w-0 pt-[0.04rem]">
              <p
                className={
                  index <= heroStepIndex
                    ? 'text-[0.74rem] leading-none font-bold text-[#4fa3ff]'
                    : 'text-[0.74rem] leading-none font-semibold text-[#708397]'
                }
              >
                {item.label}
              </p>
              <p className="mt-1 text-[0.59rem] leading-none text-[#718296]">
                {item.description}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function MobileBottomStepper({
  activeIndex,
}: MobileOnboardingStepperProps) {
  return (
    <nav
      aria-label="Registration progress"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[#102742]/90 bg-[#06111f]/94 px-3.5 pb-[max(0.3rem,env(safe-area-inset-bottom))] pt-[0.5rem] shadow-[0_-12px_28px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:hidden"
    >
      <div className="mx-auto max-w-[17rem]">
        <ol className="grid grid-cols-4 gap-1">
          {mobileNavSteps.map((item, index) => (
            <li key={item.label}>
              <div
                className={
                  index <= activeIndex
                    ? 'flex flex-col items-center gap-1 text-[#4fa3ff]'
                    : 'flex flex-col items-center gap-1 text-[#43566c]'
                }
              >
                <span
                  className={
                    index <= activeIndex
                      ? 'inline-flex size-[1.64rem] items-center justify-center rounded-full bg-[#0d2848] shadow-[0_0_14px_rgba(70,155,255,0.34)]'
                      : 'inline-flex size-[1.64rem] items-center justify-center rounded-full'
                  }
                >
                  {index <= activeIndex ? (
                    <item.Icon
                      className="size-[0.92rem]"
                      aria-hidden="true"
                    />
                  ) : (
                    <Circle
                      className="size-[0.92rem]"
                      aria-hidden="true"
                    />
                  )}
                </span>
                <span className="text-center text-[0.47rem] leading-none font-bold tracking-[0.04em] uppercase">
                  {item.label}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}
