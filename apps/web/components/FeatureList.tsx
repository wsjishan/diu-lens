import { CheckCircle2 } from 'lucide-react';

import type { RegistrationHighlight } from '@/features/registration/constants';

type FeatureListProps = {
  items: RegistrationHighlight[];
};

export function FeatureList({ items }: FeatureListProps) {
  return (
    <ul
      id="features"
      className="space-y-4"
      aria-label="Platform highlights"
    >
      {items.map((item) => (
        <li
          key={item.title}
          className="flex items-start gap-2.5"
        >
          <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-blue-200 bg-blue-50 text-blue-700">
            <CheckCircle2
              className="size-4"
              aria-hidden="true"
            />
          </span>
          <div className="space-y-0.5 pt-0.5">
            <p className="text-[1.02rem] font-semibold text-slate-800">
              {item.title}
            </p>
            <p className="text-sm leading-6 text-slate-600/85">
              {item.description}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
