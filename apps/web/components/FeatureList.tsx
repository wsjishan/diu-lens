import { CheckCircle2 } from 'lucide-react';

import type { RegistrationHighlight } from '@/features/registration/constants';

type FeatureListProps = {
  items: RegistrationHighlight[];
};

export function FeatureList({ items }: FeatureListProps) {
  return (
    <ul
      className="space-y-4"
      aria-label="Platform highlights"
    >
      {items.map((item) => (
        <li
          key={item.title}
          className="flex items-start gap-3"
        >
          <CheckCircle2
            className="mt-0.5 size-5 text-primary"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <p className="font-medium text-foreground">{item.title}</p>
            <p className="text-sm leading-6 text-muted-foreground">
              {item.description}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
