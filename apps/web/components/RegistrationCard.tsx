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
  return (
    <aside className="w-full lg:justify-self-end">
      <Card className="surface-panel border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl text-slate-900">
            Start Registration
          </CardTitle>
          <CardDescription>
            Enter initial student details to prepare face enrollment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            aria-label="Student registration form"
          >
            {registrationFields.map((field) => (
              <div
                key={field.id}
                className="space-y-2"
              >
                <Label htmlFor={field.id}>{field.label}</Label>
                <Input
                  id={field.id}
                  name={field.id}
                  type={field.type ?? 'text'}
                  placeholder={field.placeholder}
                  autoComplete="off"
                />
              </div>
            ))}
            <Button
              type="button"
              size="lg"
              className="mt-2 w-full"
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
