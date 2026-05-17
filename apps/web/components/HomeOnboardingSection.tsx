'use client';

import { useState } from 'react';
import {
  Clock3,
  Fingerprint,
  IdCard,
  LockKeyhole,
  ScanFace,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';

import { HeroSection } from '@/components/HeroSection';
import { RegistrationCard } from '@/components/RegistrationCard';
import { cn } from '@/lib/utils';

const benefits = [
  {
    title: 'Secure Campus Identity',
    description:
      'Connect student records with a trusted biometric identity layer for DIU services.',
    Icon: ShieldCheck,
    accent: 'text-emerald-500 dark:text-emerald-300',
  },
  {
    title: 'AI-Powered Verification',
    description:
      'Guided face checks help validate identity with a fast, modern capture flow.',
    Icon: Sparkles,
    accent: 'text-sky-500 dark:text-sky-300',
  },
  {
    title: 'Anti-Impersonation Protection',
    description:
      'Reduce identity misuse with enrollment designed around ownership and presence.',
    Icon: LockKeyhole,
    accent: 'text-indigo-500 dark:text-indigo-300',
  },
  {
    title: 'Faster Authentication',
    description:
      'Prepare students for quicker access across campus workflows and checkpoints.',
    Icon: Clock3,
    accent: 'text-cyan-500 dark:text-cyan-300',
  },
  {
    title: 'Trusted Biometric Identity',
    description:
      'Build a reusable identity foundation for academic, administrative, and security use cases.',
    Icon: Fingerprint,
    accent: 'text-blue-500 dark:text-blue-300',
  },
] as const;

const workflowSteps = [
  {
    title: 'Student ID Check',
    description:
      'Start by validating the institutional ID that anchors the student profile.',
    Icon: IdCard,
  },
  {
    title: 'Basic Information',
    description:
      'Confirm essential contact and profile details before biometric capture.',
    Icon: UserRound,
  },
  {
    title: 'Face Verification',
    description:
      'Complete guided face capture to create the secure biometric enrollment.',
    Icon: ScanFace,
  },
] as const;

export function HomeOnboardingSection() {
  const [activeStep, setActiveStep] = useState(0);
  const isVerificationStep = activeStep === 2;

  return (
    <>
      <HeroSection />
      <BenefitsSection />
      <HowItWorksSection />

      <section
        id="start-verification"
        className="relative scroll-mt-8 py-12 sm:py-14 lg:py-16"
      >
        <div
          aria-hidden="true"
          className="landing-card-spotlight pointer-events-none absolute left-1/2 top-[54%] h-[28rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        />

        <div className="relative mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1fr)] lg:items-center lg:gap-12">
          <div
            className={cn(
              'mx-auto max-w-[33rem] text-center transition-all duration-300 ease-out lg:mx-0 lg:text-left',
              activeStep > 0 && !isVerificationStep
                ? 'lg:opacity-80'
                : 'lg:opacity-100'
            )}
          >
            <p className="landing-text-muted text-sm font-semibold uppercase">
              Begin Verification
            </p>
            <h2 className="landing-text-primary mt-3 text-[2rem] leading-tight font-semibold sm:text-[2.25rem] lg:text-[2.65rem]">
              Enter the DIU Lens onboarding experience.
            </h2>
            <p className="landing-text-secondary mt-4 text-[0.96rem] leading-7">
              The product workflow starts here. Follow the guided steps to
              validate your student ID, confirm your details, and complete face
              verification.
            </p>
          </div>

          <div className="relative mx-auto flex w-full max-w-[27rem] justify-center drop-shadow-[0_28px_55px_rgba(37,99,235,0.08)] md:max-w-[31rem] lg:mx-0 lg:max-w-none lg:justify-end dark:drop-shadow-[0_30px_70px_rgba(2,6,23,0.32)]">
            <RegistrationCard onStepIndexChange={setActiveStep} />
          </div>
        </div>
      </section>
    </>
  );
}

function BenefitsSection() {
  return (
    <section className="py-9 sm:py-11 lg:py-12">
      <div className="mx-auto max-w-2xl text-center">
        <p className="landing-text-muted text-xs font-semibold uppercase sm:text-sm">
          Trusted Identity Layer
        </p>
        <h2 className="landing-text-primary mt-3 text-[1.9rem] leading-tight font-semibold sm:text-3xl lg:text-[2.6rem]">
          Built for secure, modern campus verification.
        </h2>
        <p className="landing-text-secondary mt-4 text-[0.95rem] leading-7 sm:text-base">
          DIU Lens brings identity assurance, biometric enrollment, and faster
          access into one focused student verification experience.
        </p>
      </div>

      <div className="mt-7 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:mt-9 lg:grid-cols-5">
        {benefits.map((benefit) => (
          <article
            key={benefit.title}
            className="landing-card-surface rounded-2xl border p-5 lg:min-h-[13.25rem]"
          >
            <div className="flex size-9 items-center justify-center rounded-xl border border-slate-200/70 bg-white/65 shadow-[0_12px_24px_-20px_rgba(15,23,42,0.5)] dark:border-white/10 dark:bg-white/7">
              <benefit.Icon
                className={cn('size-[1.125rem]', benefit.accent)}
                aria-hidden="true"
              />
            </div>
            <h3 className="landing-text-primary mt-4 text-[0.95rem] leading-6 font-semibold">
              {benefit.title}
            </h3>
            <p className="landing-text-secondary mt-2.5 text-[0.86rem] leading-6">
              {benefit.description}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section className="py-9 sm:py-11 lg:py-12">
      <div className="mx-auto max-w-2xl text-center">
        <p className="landing-text-muted text-xs font-semibold uppercase sm:text-sm">
          How It Works
        </p>
        <h2 className="landing-text-primary mt-3 text-[1.9rem] leading-tight font-semibold sm:text-3xl lg:text-[2.6rem]">
          A clear path before the form begins.
        </h2>
      </div>

      <ol className="mx-auto mt-7 grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-3 lg:mt-9">
        {workflowSteps.map((step, index) => (
          <li
            key={step.title}
            className="landing-card-surface relative rounded-2xl border p-5"
          >
            {index < workflowSteps.length - 1 ? (
              <span
                aria-hidden="true"
                className="absolute left-[calc(100%-0.4rem)] top-10 hidden h-px w-7 bg-linear-to-r from-blue-300/45 to-transparent md:block"
              />
            ) : null}
            <div className="flex items-center gap-4">
              <span className="flex size-10 items-center justify-center rounded-xl bg-slate-950 text-white shadow-[0_16px_28px_-22px_rgba(15,23,42,0.7)] dark:bg-white dark:text-slate-950">
                <step.Icon
                  className="size-[1.125rem]"
                  aria-hidden="true"
                />
              </span>
              <span className="landing-text-muted text-[0.82rem] font-semibold">
                Step {index + 1}
              </span>
            </div>
            <h3 className="landing-text-primary mt-5 text-lg font-semibold">
              {step.title}
            </h3>
            <p className="landing-text-secondary mt-2.5 text-[0.88rem] leading-6">
              {step.description}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
