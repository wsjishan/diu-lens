export type RegistrationHighlight = {
  title: string;
  description: string;
};

export type RegistrationField = {
  id: string;
  label: string;
  placeholder: string;
  type?: 'text';
};

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

export const registrationFields: RegistrationField[] = [
  {
    id: 'student-id',
    label: 'Student ID',
    placeholder: 'e.g. 221-15-0001',
    type: 'text',
  },
];
