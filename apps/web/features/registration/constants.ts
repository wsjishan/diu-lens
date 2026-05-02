export type RegistrationHighlight = {
  title: string;
  description: string;
};

import type { RegistrationStepMeta } from '@/features/registration/types';

export const registrationHighlights: RegistrationHighlight[] = [
  {
    title: 'Secure identity registration',
    description: 'Use your DIU student ID to begin the verification process.',
  },
  {
    title: 'AI-powered face verification',
    description:
      'Ensures accurate identity matching using advanced biometric technology.',
  },
  {
    title: 'Privacy-first data handling',
    description:
      'Your biometric data is securely processed and protected under institutional standards.',
  },
];

export const registrationStepMeta: RegistrationStepMeta[] = [
  {
    id: 'student-id',
    label: 'Student ID',
    title: 'Check Registration Status',
  },
  {
    id: 'basic-info',
    label: 'Basic Info',
    title: 'Basic Information',
  },
  {
    id: 'face-prep',
    label: 'Face Prep',
    title: 'Face Verification',
  },
];

export const registrationPrepTips = [
  'Ensure good lighting',
  'Keep your face clearly visible',
  'Hold your device steady',
];
