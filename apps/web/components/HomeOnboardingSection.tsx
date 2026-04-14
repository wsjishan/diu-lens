'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

import { HeroSection } from '@/components/HeroSection';
import { RegistrationCard } from '@/components/RegistrationCard';
import { registrationHighlights } from '@/features/registration/constants';

export function HomeOnboardingSection() {
  const [activeStep, setActiveStep] = useState(0);
  const focused = activeStep > 0;

  return (
    <section className="grid w-full grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
      <motion.div
        initial={false}
        animate={{
          opacity: focused ? 0.46 : 1,
          scale: focused ? 0.98 : 1,
          y: focused ? -10 : 0,
        }}
        transition={{ duration: 0.26, ease: [0.2, 0.7, 0.2, 1] }}
        className="origin-top space-y-5 lg:pr-2"
      >
        <HeroSection highlights={registrationHighlights} />
      </motion.div>
      <motion.div
        initial={false}
        animate={{
          x: focused ? -10 : 0,
          scale: focused ? 1.01 : 1,
        }}
        transition={{ duration: 0.26, ease: [0.2, 0.7, 0.2, 1] }}
      >
        <RegistrationCard onStepIndexChange={setActiveStep} />
      </motion.div>
    </section>
  );
}
