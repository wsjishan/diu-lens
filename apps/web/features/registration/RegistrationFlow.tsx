'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { registrationStepMeta } from '@/features/registration/constants';
import {
  GENERIC_ENROLLMENT_ERROR,
  GENERIC_REGISTRATION_COMPLETION_ERROR,
  submitEnrollment,
  submitEnrollmentCompletion,
} from '@/features/registration/api';
import { RegistrationShell } from '@/features/registration/RegistrationShell';
import { BasicInfoStep } from '@/features/registration/steps/BasicInfoStep';
import { StudentIdStep } from '@/features/registration/steps/StudentIdStep';
import { SuccessStep } from '@/features/registration/steps/SuccessStep';
import { VerificationFlow } from '@/features/registration/verification/VerificationFlow';
import type { VerificationCompletionSummary } from '@/features/registration/verification/types';
import type {
  RegistrationFlowProps,
  RegistrationFormValues,
} from '@/features/registration/types';
import { cn } from '@/lib/utils';

const transition = {
  duration: 0.24,
  ease: [0.2, 0.7, 0.2, 1] as [number, number, number, number],
};

function toFriendlyVerificationMessage(message: string | null | undefined) {
  if (!message) {
    return GENERIC_REGISTRATION_COMPLETION_ERROR;
  }

  const normalized = message.toLowerCase();
  if (normalized.includes('face_not_detected')) {
    return 'Face could not be detected in one or more captures. Retake with your full face centered.';
  }
  if (normalized.includes('image_blurry')) {
    return 'One or more captures are blurry. Hold steady and retake.';
  }
  if (normalized.includes('invalid_brightness')) {
    return 'Lighting quality is not acceptable. Improve lighting and retake.';
  }
  if (normalized.includes('face_off_center')) {
    return 'One or more captures are off-center. Align your face and retake.';
  }
  if (normalized.includes('image quality checks failed')) {
    return 'Some captures did not pass quality checks. Please retake the guided shots.';
  }

  return message;
}

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
  const [isSubmittingBasicInfo, setIsSubmittingBasicInfo] = useState(false);
  const [basicInfoError, setBasicInfoError] = useState<string | null>(null);
  const [isCompletingRegistration, setIsCompletingRegistration] =
    useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(
    null
  );
  const toErrorMessage = useCallback((error: unknown, fallback: string) => {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    return fallback;
  }, []);

  const handleBasicInfoContinue = useCallback(async () => {
    if (isSubmittingBasicInfo) {
      return;
    }

    const fullName = values.fullName.trim();
    const phoneNumber = values.phoneNumber.trim();
    const universityEmail = values.universityEmail.trim();

    if (!fullName || !phoneNumber || !universityEmail) {
      setBasicInfoError(GENERIC_ENROLLMENT_ERROR);
      return;
    }

    setBasicInfoError(null);
    setIsSubmittingBasicInfo(true);

    try {
      const result = await submitEnrollment({
        student_id: values.studentId,
        full_name: fullName,
        phone: phoneNumber,
        university_email: universityEmail,
      });

      if (!result.success) {
        setBasicInfoError(result.message || GENERIC_ENROLLMENT_ERROR);
        return;
      }

      setVerificationError(null);
      setActiveStep(2);
    } catch (error) {
      console.error('[registration] basic info submit failed', error);
      setBasicInfoError(toErrorMessage(error, GENERIC_ENROLLMENT_ERROR));
    } finally {
      setIsSubmittingBasicInfo(false);
    }
  }, [
    isSubmittingBasicInfo,
    toErrorMessage,
    values.fullName,
    values.phoneNumber,
    values.studentId,
    values.universityEmail,
  ]);

  const handleVerificationComplete = useCallback(
    async (summary: VerificationCompletionSummary) => {
      if (isCompletingRegistration) {
        return;
      }

      setVerificationError(null);
      setIsCompletingRegistration(true);
      console.log('[verification] completion submit start', {
        student_id: values.studentId,
      });

      try {
        const result = await submitEnrollmentCompletion(
          {
            student_id: values.studentId,
            full_name: values.fullName.trim(),
            phone: values.phoneNumber.trim(),
            university_email: values.universityEmail.trim(),
            verification_completed: summary.verificationCompleted,
            total_required_shots: summary.totalRequiredShots,
            total_accepted_shots: summary.totalAcceptedShots,
            angles: summary.angles.map((entry) => ({
              angle: entry.angle,
              accepted_shots: entry.acceptedShots,
              required_shots: entry.requiredShots,
            })),
          },
          summary.capturesByAngle
        );

        if (!result.success) {
          console.warn('[verification] completion submit rejected', result);
          setVerificationError(toFriendlyVerificationMessage(result.message));
          return;
        }

        console.log('[verification] completion submit succeeded', result);
        setActiveStep(3);
      } catch (error) {
        console.error('[verification] completion submit failed', error);
        setVerificationError(
          toErrorMessage(error, GENERIC_REGISTRATION_COMPLETION_ERROR)
        );
      } finally {
        setIsCompletingRegistration(false);
      }
    },
    [
      isCompletingRegistration,
      toErrorMessage,
      values.fullName,
      values.phoneNumber,
      values.studentId,
      values.universityEmail,
    ]
  );

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
          onFieldChange={(field, value) => {
            setBasicInfoError(null);
            setValues((current) => ({ ...current, [field]: value }));
          }}
          onBack={() => {
            setBasicInfoError(null);
            setActiveStep(0);
          }}
          onContinue={handleBasicInfoContinue}
          isSubmitting={isSubmittingBasicInfo}
          errorMessage={basicInfoError}
        />
      );
    }

    if (activeStep === 2) {
      return (
        <VerificationFlow
          studentId={values.studentId}
          onComplete={handleVerificationComplete}
          isSubmittingCompletion={isCompletingRegistration}
          completionErrorMessage={verificationError}
        />
      );
    }

    return <SuccessStep onDone={onDone} />;
  }, [
    activeStep,
    basicInfoError,
    handleVerificationComplete,
    handleBasicInfoContinue,
    isCompletingRegistration,
    isSubmittingBasicInfo,
    onDone,
    verificationError,
    values,
  ]);

  const isVerificationStep = activeStep === 2;

  const stepContent = (
    <div className="flex min-h-0 flex-col">
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
  );

  if (isVerificationStep) {
    return (
      <section
        className={cn(
          'flex h-[min(600px,calc(100dvh-9.75rem))] max-h-[600px] w-full flex-col',
          className
        )}
      >
        {stepContent}
      </section>
    );
  }

  return (
    <RegistrationShell
      className={className}
      activeIndex={activeStep}
      steps={registrationStepMeta}
    >
      {stepContent}
    </RegistrationShell>
  );
}
