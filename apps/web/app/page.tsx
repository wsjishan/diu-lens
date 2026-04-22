import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { HomeOnboardingSection } from '@/components/HomeOnboardingSection';

export default function Home() {
  return (
    <div className="landing-page relative min-h-screen overflow-hidden">
      <div aria-hidden="true" className="landing-vignette pointer-events-none absolute inset-0" />
      <div aria-hidden="true" className="landing-grid-overlay pointer-events-none absolute inset-0" />
      <div aria-hidden="true" className="landing-glow-top-left pointer-events-none absolute inset-0" />
      <div aria-hidden="true" className="landing-glow-bottom-right pointer-events-none absolute inset-0" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1320px] flex-col px-6 pb-7 pt-7 sm:px-8 sm:pb-8 sm:pt-8 lg:px-12 lg:pb-10 lg:pt-10 xl:px-14">
        <Header />
        <main className="flex flex-1 items-center py-8 lg:py-10">
          <HomeOnboardingSection />
        </main>
        <Footer />
      </div>
    </div>
  );
}
