'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAdminAuth } from '@/features/admin/auth/AdminAuthContext';

export default function AdminLoginPage() {
  const router = useRouter();
  const { status, login, isLoggingIn } = useAdminAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getNextPath = () => {
    if (typeof window === 'undefined') {
      return '/admin/enrollments';
    }

    const next = new URLSearchParams(window.location.search).get('next');
    return next || '/admin/enrollments';
  };

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(getNextPath());
    }
  }, [status, router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const result = await login(email.trim(), password);

    if (!result.success) {
      setError(result.message || 'Invalid email or password.');
      return;
    }

    router.replace(getNextPath());
  };

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(37,99,235,0.26),transparent_40%),radial-gradient(circle_at_85%_80%,rgba(14,116,144,0.22),transparent_42%)]" />

      <Card className="relative z-10 w-full max-w-md border border-border bg-card text-foreground backdrop-blur-2xl">
        <CardHeader className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-blue-300/80">DIU Lens</p>
          <CardTitle className="text-2xl text-foreground">Admin Login</CardTitle>
          <CardDescription className="text-muted-foreground">
            Sign in with an admin or super admin account to manage enrollments.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email</Label>
              <Input
                id="admin-email"
                type="email"
                required
                placeholder="admin@diu.edu.bd"
                className="h-10 border-border bg-muted/40 text-foreground"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <div className="relative">
                <Input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter your password"
                  className="h-10 border-border bg-muted/40 pr-10 text-foreground"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-2 my-auto inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error ? (
              <p className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <Button type="submit" className="h-10 w-full" disabled={isLoggingIn || status === 'loading'}>
              {isLoggingIn ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
