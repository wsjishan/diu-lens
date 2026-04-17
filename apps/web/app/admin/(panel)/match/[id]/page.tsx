import { notFound } from 'next/navigation';
import { MatchDetailView } from '@/features/admin/MatchDetailView';
import { mockCandidates } from '@/features/admin/mock-data';

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const candidate = mockCandidates.find((item) => item.id === id);

  if (!candidate) {
    notFound();
  }

  return <MatchDetailView candidate={candidate} />;
}
