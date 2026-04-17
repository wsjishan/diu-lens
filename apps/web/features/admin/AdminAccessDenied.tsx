import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AdminAccessDenied() {
  return (
    <section className="mx-auto grid max-w-2xl gap-5 rounded-2xl border border-amber-200/20 bg-card p-8 text-center shadow-[0_24px_60px_-35px_rgba(245,158,11,0.42)]">
      <span className="mx-auto rounded-full border border-amber-300/40 bg-amber-400/10 p-3 text-amber-200">
        <ShieldAlert className="size-7" />
      </span>
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Super Admin Access Required</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This area is available in demo mode for Super Admin only.
        </p>
      </div>
      <div className="flex justify-center gap-3">
        <Button asChild variant="outline" className="border-border bg-transparent text-foreground hover:bg-muted">
          <Link href="/admin/search">Go to Search</Link>
        </Button>
        <Button asChild>
          <Link href="/admin/login">Switch Role</Link>
        </Button>
      </div>
    </section>
  );
}
