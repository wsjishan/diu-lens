'use client';

import { GuidedEnrollmentCapture } from '@/features/registration/capture/GuidedEnrollmentCapture';
import type { VerificationCompletionSummary } from '@/features/registration/verification/types';

type VerificationFlowProps = {
  studentId: string;
  onComplete: (summary: VerificationCompletionSummary) => void | Promise<void>;
  isSubmittingCompletion?: boolean;
  completionErrorMessage?: string | null;
};

export function VerificationFlow({
  studentId,
  onComplete,
  isSubmittingCompletion = false,
  completionErrorMessage,
}: VerificationFlowProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <GuidedEnrollmentCapture
        studentId={studentId}
        onComplete={onComplete}
        isSubmittingCompletion={isSubmittingCompletion}
        completionErrorMessage={completionErrorMessage}
      />
    </div>
  );
}
