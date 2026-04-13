import { FeatureList } from '@/components/FeatureList';
import type { RegistrationHighlight } from '@/features/registration/constants';

type HeroSectionProps = {
  highlights: RegistrationHighlight[];
};

export function HeroSection({ highlights }: HeroSectionProps) {
  return (
    <section className="space-y-8">
      <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium tracking-wide text-primary uppercase">
        DIU Lens Platform
      </div>
      <div className="space-y-5">
        <h1 className="max-w-xl text-4xl leading-tight font-semibold text-slate-900 sm:text-5xl">
          AI-powered student face registration built for campus scale.
        </h1>
        <p className="max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
          Start with a clean registration workflow that supports accurate
          identification and maintainable operations across the university.
        </p>
      </div>
      <FeatureList items={highlights} />
    </section>
  );
}
