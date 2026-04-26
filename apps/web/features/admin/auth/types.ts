export type AdminUser = {
  id: number;
  email: string;
  full_name: string;
  role: 'admin' | 'super_admin' | string;
  is_active: boolean;
};

export type EnrollmentStatus =
  | 'pending'
  | 'uploaded'
  | 'validated'
  | 'failed'
  | 'processing'
  | 'processed'
  | 'approved'
  | 'rejected'
  | 'reset';

export type EnrollmentRecord = {
  student_id: string;
  full_name: string;
  university_email: string;
  phone: string;
  status: EnrollmentStatus;
  verification_completed: boolean;
  created_at: string | null;
  updated_at: string | null;
  rejection_reason: string | null;
  validation_passed: boolean | null;
  total_required_shots: number | null;
  total_accepted_shots: number | null;
  active_embeddings_count: number;
  has_active_embeddings: boolean;
  processing_state:
    | 'processed'
    | 'needs_processing'
    | 'processing_failed'
    | 'not_applicable';
  last_processing_passed: boolean | null;
  last_processing_message: string | null;
};
