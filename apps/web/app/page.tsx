import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { HomeOnboardingSection } from '@/components/HomeOnboardingSection';

export default function Home() {
  return (
    <div className="landing-page relative min-h-screen overflow-hidden">
      <div
        aria-hidden="true"
        className="landing-vignette pointer-events-none absolute inset-0"
      />
      <div
        aria-hidden="true"
        className="landing-grid-overlay pointer-events-none absolute inset-0"
      />
      <div
        aria-hidden="true"
        className="landing-glow-top-left pointer-events-none absolute inset-0"
      />
      <div
        aria-hidden="true"
        className="landing-glow-bottom-right pointer-events-none absolute inset-0"
      />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1280px] flex-col px-5 pb-6 pt-4 sm:px-6 sm:pb-7 sm:pt-5 lg:px-10 lg:pb-8 lg:pt-6 xl:px-12">
        <Header />
        <main className="flex-1">
          <HomeOnboardingSection />
        </main>
        <Footer />
      </div>
    </div>
  );
}
