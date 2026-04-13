import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { HeroSection } from '@/components/HeroSection';
import { RegistrationCard } from '@/components/RegistrationCard';
import { registrationHighlights } from '@/features/registration/constants';

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(6,95,70,0.10),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(2,132,199,0.12),transparent_45%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-6 sm:px-10 lg:px-12">
        <Header />
        <main className="flex flex-1 items-center py-10 sm:py-12">
          <section className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <HeroSection highlights={registrationHighlights} />
            <RegistrationCard />
          </section>
        </main>
        <Footer />
      </div>
    </div>
  );
}
