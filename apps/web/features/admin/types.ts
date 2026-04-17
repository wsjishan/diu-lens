export type AdminRole = 'normal' | 'super';

export type MatchCandidate = {
  id: string;
  studentId: string;
  fullName: string;
  department: string;
  confidence: number;
  studentImage: string;
  notes: string;
};

export type ActivityItem = {
  id: string;
  adminName: string;
  action: string;
  timestamp: string;
  searchId: string;
  status: 'match_found' | 'review_needed' | 'no_match';
  summary: string;
};

export type AdminRecord = {
  id: string;
  name: string;
  email: string;
  role: 'Normal Admin' | 'Super Admin';
  status: 'Active' | 'Disabled' | 'Pending';
  lastLogin: string;
};
