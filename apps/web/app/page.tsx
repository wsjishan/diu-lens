import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { HeroSection } from '@/components/HeroSection';
import { RegistrationCard } from '@/components/RegistrationCard';
import { registrationHighlights } from '@/features/registration/constants';

export default function Home() {
  return (
    <div className="relative h-screen overflow-hidden bg-slate-100 dark:bg-[#0a1221]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(37,99,235,0.14),transparent_42%),radial-gradient(circle_at_85%_82%,rgba(15,23,42,0.1),transparent_48%)] dark:bg-[radial-gradient(circle_at_16%_14%,rgba(56,189,248,0.16),transparent_36%),radial-gradient(circle_at_78%_74%,rgba(99,102,241,0.12),transparent_48%),linear-gradient(180deg,rgba(15,23,42,0.38)_0%,rgba(7,11,24,0.62)_100%)]" />
      <div className="mx-auto flex h-screen w-full max-w-6xl flex-col px-5 py-4 sm:px-8 lg:px-10">
        <div className="relative flex h-full flex-col rounded-2xl border border-slate-200/90 bg-slate-50/95 px-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_8px_16px_-14px_rgba(15,23,42,0.24)] dark:border-slate-700/45 dark:bg-slate-900/70 dark:shadow-[inset_0_1px_0_0_rgba(148,163,184,0.12),0_12px_24px_-18px_rgba(2,6,23,0.7)] sm:px-7 lg:px-8">
          <Header />
          <main className="flex min-h-0 flex-1 items-center py-3.5 sm:py-4.5">
            <section className="grid w-full gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-7">
              <HeroSection highlights={registrationHighlights} />
              <RegistrationCard />
            </section>
          </main>
          <Footer />
        </div>
      </div>
    </div>
  );
}
