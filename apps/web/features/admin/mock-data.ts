import { ActivityItem, AdminRecord, MatchCandidate } from '@/features/admin/types';

export const dashboardStats = [
  {
    label: 'Registered Students',
    value: '8,420',
    hint: '+154 this month',
  },
  {
    label: 'Total Admins',
    value: '17',
    hint: '12 active sessions',
  },
  {
    label: 'Searches Today',
    value: '236',
    hint: 'avg 89% confidence',
  },
  {
    label: 'System Status',
    value: 'Healthy',
    hint: 'All services operational',
  },
];

export const quickActions = [
  {
    title: 'Start New Match',
    description: 'Open search workspace and upload a query image.',
    href: '/admin/search',
  },
  {
    title: 'Review Latest Results',
    description: 'Inspect the most recent candidate list from search runs.',
    href: '/admin/results',
  },
  {
    title: 'Manage Admin Access',
    description: 'Add or update staff access permissions and roles.',
    href: '/admin/admins',
  },
];

export const recentActivity: ActivityItem[] = [
  {
    id: 'LOG-7812',
    adminName: 'Farhan Kabir',
    action: 'Face Search Completed',
    timestamp: 'Apr 17, 2026 10:14 AM',
    searchId: 'SRC-00914',
    status: 'match_found',
    summary: 'Top hit confidence 96.2% in CSE department.',
  },
  {
    id: 'LOG-7813',
    adminName: 'Nabila Sultana',
    action: 'Candidate Reviewed',
    timestamp: 'Apr 17, 2026 10:28 AM',
    searchId: 'SRC-00915',
    status: 'review_needed',
    summary: 'Manual check requested due to low light image quality.',
  },
  {
    id: 'LOG-7814',
    adminName: 'Farhan Kabir',
    action: 'Face Search Completed',
    timestamp: 'Apr 17, 2026 10:42 AM',
    searchId: 'SRC-00916',
    status: 'no_match',
    summary: 'No high-confidence candidate in top 20 records.',
  },
  {
    id: 'LOG-7815',
    adminName: 'Raihan Ahmed',
    action: 'Admin Role Updated',
    timestamp: 'Apr 17, 2026 11:05 AM',
    searchId: 'N/A',
    status: 'review_needed',
    summary: 'Promoted user to Super Admin for shift oversight.',
  },
];

export const mockCandidates: MatchCandidate[] = [
  {
    id: 'STU-230014',
    studentId: '221-15-5142',
    fullName: 'Ariana Tanjim',
    department: 'Computer Science & Engineering',
    confidence: 97.4,
    studentImage:
      'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=800&q=80',
    notes: 'High confidence from frontal face and balanced lighting.',
  },
  {
    id: 'STU-230052',
    studentId: '222-15-9310',
    fullName: 'Nadim Hasan',
    department: 'Software Engineering',
    confidence: 93.1,
    studentImage:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80',
    notes: 'Strong geometric match with slight angle variance.',
  },
  {
    id: 'STU-230091',
    studentId: '221-15-8844',
    fullName: 'Tania Rahman',
    department: 'Electrical & Electronic Engineering',
    confidence: 88.7,
    studentImage:
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=80',
    notes: 'Moderate confidence, verify with additional source image.',
  },
];

export const mockAdmins: AdminRecord[] = [
  {
    id: 'ADM-01',
    name: 'Raihan Ahmed',
    email: 'raihan@diu.edu.bd',
    role: 'Super Admin',
    status: 'Active',
    lastLogin: 'Apr 17, 2026 10:55 AM',
  },
  {
    id: 'ADM-02',
    name: 'Farhan Kabir',
    email: 'farhan.k@diu.edu.bd',
    role: 'Normal Admin',
    status: 'Active',
    lastLogin: 'Apr 17, 2026 10:41 AM',
  },
  {
    id: 'ADM-03',
    name: 'Nabila Sultana',
    email: 'nabila.s@diu.edu.bd',
    role: 'Normal Admin',
    status: 'Pending',
    lastLogin: 'Apr 16, 2026 06:18 PM',
  },
  {
    id: 'ADM-04',
    name: 'Tanvir Hossain',
    email: 'tanvir.h@diu.edu.bd',
    role: 'Normal Admin',
    status: 'Disabled',
    lastLogin: 'Apr 12, 2026 08:22 AM',
  },
];
