'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, ShieldCheck, ShieldUser } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ADMIN_ROLE_COOKIE } from '@/features/admin/role-shared';
import { AdminRole } from '@/features/admin/types';

function persistDemoRole(role: AdminRole) {
  document.cookie = `${ADMIN_ROLE_COOKIE}=${role}; path=/; max-age=604800; samesite=lax`;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);

    window.setTimeout(() => {
      persistDemoRole('normal');
      router.push('/admin/search');
    }, 700);
  };

  const handleRoleLogin = (role: AdminRole) => {
    setIsLoading(true);
    persistDemoRole(role);
    router.push(role === 'super' ? '/admin/dashboard' : '/admin/search');
  };

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(37,99,235,0.26),transparent_40%),radial-gradient(circle_at_85%_80%,rgba(14,116,144,0.22),transparent_42%)]" />

      <Card className="relative z-10 w-full max-w-md border border-border bg-card text-foreground backdrop-blur-2xl">
        <CardHeader className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-blue-300/80">DIU Lens</p>
          <CardTitle className="text-2xl text-foreground">Admin Login</CardTitle>
          <CardDescription className="text-muted-foreground">
            Demo-only access screen for the DIU Lens administration panel.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email or Username</Label>
              <Input
                id="admin-email"
                type="text"
                required
                placeholder="admin@diu.edu.bd"
                className="h-10 border-border bg-muted/40 text-foreground"
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
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-2 my-auto inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            <Button type="submit" className="h-10 w-full" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-3">
            <p className="text-xs font-medium tracking-wide text-muted-foreground">Demo Quick Login</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="h-9 border-border bg-transparent text-foreground hover:bg-muted"
                disabled={isLoading}
                onClick={() => handleRoleLogin('normal')}
              >
                <ShieldUser className="size-4" />
                Login as Normal Admin
              </Button>
              <Button
                type="button"
                className="h-9"
                disabled={isLoading}
                onClick={() => handleRoleLogin('super')}
              >
                <ShieldCheck className="size-4" />
                Login as Super Admin
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
