import { CheckCircle2 } from 'lucide-react';

import type { RegistrationHighlight } from '@/features/registration/constants';

type FeatureListProps = {
  items: RegistrationHighlight[];
};

export function FeatureList({ items }: FeatureListProps) {
  return (
    <ul
      className="space-y-3"
      aria-label="Platform highlights"
    >
      {items.map((item) => (
        <li
          key={item.title}
          className="flex items-start gap-3"
        >
          <span className="mt-0.5 grid size-5.5 shrink-0 place-items-center rounded-md border border-slate-200/90 bg-slate-100/95 text-slate-500">
            <CheckCircle2
              className="size-3.5"
              aria-hidden="true"
            />
          </span>
          <div className="space-y-1 pt-0.5">
            <p className="text-sm font-bold text-slate-800">{item.title}</p>
            <p className="text-[0.79rem] leading-[1.22rem] text-slate-600">
              {item.description}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
