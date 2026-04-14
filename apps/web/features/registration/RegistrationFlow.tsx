'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';

import { registrationStepMeta } from '@/features/registration/constants';
import { RegistrationShell } from '@/features/registration/RegistrationShell';
import { BasicInfoStep } from '@/features/registration/steps/BasicInfoStep';
import { StudentIdStep } from '@/features/registration/steps/StudentIdStep';
import { SuccessStep } from '@/features/registration/steps/SuccessStep';
import { VerificationFlow } from '@/features/registration/verification/VerificationFlow';
import type {
  RegistrationFlowProps,
  RegistrationFormValues,
} from '@/features/registration/types';

const transition = {
  duration: 0.24,
  ease: [0.2, 0.7, 0.2, 1] as [number, number, number, number],
};

function formatStudentId(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 9);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 5) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

const initialValues: RegistrationFormValues = {
  studentId: '',
  fullName: '',
  phoneNumber: '',
  universityEmail: '',
};

export function RegistrationFlow({
  className,
  onStepIndexChange,
  onDone,
}: RegistrationFlowProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [values, setValues] = useState<RegistrationFormValues>(initialValues);

  useEffect(() => {
    onStepIndexChange?.(activeStep);
  }, [activeStep, onStepIndexChange]);

  const renderedStep = useMemo(() => {
    if (activeStep === 0) {
      return (
        <StudentIdStep
          studentId={values.studentId}
          onStudentIdChange={(value) =>
            setValues((current) => ({
              ...current,
              studentId: formatStudentId(value),
            }))
          }
          onContinue={() => setActiveStep(1)}
        />
      );
    }

    if (activeStep === 1) {
      return (
        <BasicInfoStep
          values={values}
          onFieldChange={(field, value) =>
            setValues((current) => ({ ...current, [field]: value }))
          }
          onBack={() => setActiveStep(0)}
          onContinue={() => setActiveStep(2)}
        />
      );
    }

    if (activeStep === 2) {
      return <VerificationFlow onComplete={() => setActiveStep(3)} />;
    }

    return <SuccessStep onDone={onDone} />;
  }, [activeStep, onDone, values]);

  return (
    <RegistrationShell
      className={className}
      activeIndex={activeStep}
      steps={registrationStepMeta}
    >
      <div className="flex min-h-76 flex-col sm:min-h-80">
        <AnimatePresence
          mode="wait"
          initial={false}
        >
          <motion.div
            key={activeStep}
            className="flex h-full flex-col"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={transition}
          >
            {renderedStep}
          </motion.div>
        </AnimatePresence>
      </div>
    </RegistrationShell>
  );
}
