import { FeatureList } from '@/components/FeatureList';
import type { RegistrationHighlight } from '@/features/registration/constants';

type HeroSectionProps = {
  highlights: RegistrationHighlight[];
};

export function HeroSection({ highlights }: HeroSectionProps) {
  return (
    <section className="space-y-4.5 pt-1 lg:pr-3">
      <div className="space-y-3">
        <h1 className="max-w-[15ch] text-[2.5rem] leading-[1.03] font-bold tracking-[-0.02em] text-slate-900 sm:text-5xl lg:text-[3.2rem]">
          <span className="bg-gradient-to-r from-slate-900 to-blue-700 bg-clip-text text-transparent">
            Smart Identification
          </span>{' '}
          <span className="text-slate-900">for DIU Campus</span>
        </h1>
        <p className="max-w-[56ch] text-base leading-7 text-slate-700 sm:text-[1.05rem]">
          Register your identity securely for official campus verification
          through DIU Lens.
        </p>
      </div>
      <FeatureList items={highlights} />
    </section>
  );
}
