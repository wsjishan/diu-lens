export type RegistrationHighlight = {
  title: string;
  description: string;
};

export type RegistrationField = {
  id: string;
  label: string;
  placeholder: string;
  type?: 'text' | 'email';
};

export const registrationHighlights: RegistrationHighlight[] = [
  {
    title: 'Fast onboarding',
    description:
      'Register student identities in a guided flow tailored for large intakes.',
  },
  {
    title: 'Reliable matching',
    description:
      'Prepare a consistent data baseline for downstream AI face identification.',
  },
  {
    title: 'Campus-ready scale',
    description:
      'Designed to support thousands of registrations across departments.',
  },
];

export const registrationFields: RegistrationField[] = [
  {
    id: 'student-id',
    label: 'Student ID',
    placeholder: 'e.g. 221-15-0001',
    type: 'text',
  },
  {
    id: 'full-name',
    label: 'Full Name',
    placeholder: 'e.g. Nusrat Jahan',
    type: 'text',
  },
  {
    id: 'email',
    label: 'University Email',
    placeholder: 'e.g. student@diu.edu.bd',
    type: 'email',
  },
  {
    id: 'department',
    label: 'Department',
    placeholder: 'e.g. Computer Science and Engineering',
    type: 'text',
  },
];
