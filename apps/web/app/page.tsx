import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { HeroSection } from '@/components/HeroSection';
import { RegistrationCard } from '@/components/RegistrationCard';
import { registrationHighlights } from '@/features/registration/constants';

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(59,130,246,0.08),transparent_42%),radial-gradient(circle_at_82%_78%,rgba(15,23,42,0.06),transparent_46%)]" />
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-6 sm:px-10 lg:px-12">
        <div className="relative flex min-h-full flex-col rounded-2xl border border-slate-200/90 bg-slate-50/95 px-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_10px_18px_-16px_rgba(15,23,42,0.25)] sm:px-8 lg:px-10">
          <Header />
          <main className="flex flex-1 items-center py-9 sm:py-11">
            <section className="grid w-full gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-9">
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
