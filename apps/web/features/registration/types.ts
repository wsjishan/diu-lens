export type RegistrationStepId =
  | 'student-id'
  | 'basic-info'
  | 'face-prep'
  | 'success';

export type RegistrationFormValues = {
  studentId: string;
  fullName: string;
  phoneNumber: string;
  universityEmail: string;
};

export type RegistrationStepMeta = {
  id: RegistrationStepId;
  label: string;
  title: string;
};

export type RegistrationFlowProps = {
  className?: string;
  onStepIndexChange?: (index: number) => void;
  onDone?: () => void;
};
