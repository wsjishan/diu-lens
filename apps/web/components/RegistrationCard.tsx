'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { registrationFields } from '@/features/registration/constants';

export function RegistrationCard() {
  const router = useRouter();
  const [studentId, setStudentId] = useState('');

  const formatStudentId = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 9);

    if (digits.length <= 3) {
      return digits;
    }

    if (digits.length <= 5) {
      return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    }

    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    router.push('/register');
  };

  return (
    <aside className="w-full lg:justify-self-end lg:self-center lg:pl-2">
      <Card className="rounded-2xl border border-slate-200/95 bg-white shadow-[0_20px_32px_-26px_rgba(15,23,42,0.52),0_10px_18px_-16px_rgba(15,23,42,0.34),inset_0_1px_0_0_rgba(255,255,255,0.92)]">
        <CardHeader className="space-y-2 px-6 pt-6 pb-1 sm:px-7">
          <CardTitle className="text-xl font-semibold tracking-tight text-slate-900">
            Check Registration Status
          </CardTitle>
          <CardDescription className="text-sm leading-6 text-slate-600">
            Enter your student ID to continue with DIU Lens.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-5 sm:px-7">
          <form
            className="space-y-4"
            aria-label="Student registration form"
            onSubmit={handleSubmit}
          >
            {registrationFields.map((field) => (
              <div
                key={field.id}
                className="space-y-2"
              >
                <Label
                  htmlFor={field.id}
                  className="text-[0.82rem] font-semibold tracking-[0.02em] text-slate-700"
                >
                  {field.label}
                </Label>
                <Input
                  id={field.id}
                  name={field.id}
                  type={field.type ?? 'text'}
                  placeholder="e.g. 221-15-0001"
                  autoComplete="off"
                  inputMode="numeric"
                  value={studentId}
                  onChange={(event) =>
                    setStudentId(formatStudentId(event.target.value))
                  }
                  className="h-11 rounded-lg border-slate-300/90 bg-white/60 px-3.5 text-sm text-slate-900 backdrop-blur-[2px] placeholder:text-slate-500/90 focus-visible:border-blue-600 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-blue-100/80"
                  required
                />
              </div>
            ))}
            <Button
              type="submit"
              className="mt-1 h-11 w-full gap-2 rounded-lg bg-linear-to-r from-blue-900 via-blue-800 to-blue-700 text-sm font-semibold tracking-tight text-white shadow-[0_10px_16px_-10px_rgba(15,23,42,0.45),0_6px_12px_-10px_rgba(37,99,235,0.45),inset_0_1px_0_0_rgba(255,255,255,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_22px_-10px_rgba(15,23,42,0.5),0_10px_18px_-12px_rgba(37,99,235,0.5),inset_0_1px_0_0_rgba(255,255,255,0.28)] active:translate-y-0 active:shadow-[0_8px_14px_-10px_rgba(15,23,42,0.38),0_4px_10px_-9px_rgba(37,99,235,0.4),inset_0_1px_0_0_rgba(255,255,255,0.2)] focus-visible:ring-4 focus-visible:ring-blue-300/70"
            >
              Continue
              <ArrowRight
                className="size-4"
                aria-hidden="true"
              />
            </Button>
          </form>
        </CardContent>
      </Card>
    </aside>
  );
}
