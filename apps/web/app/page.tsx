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
        className="landing-grid-overlay pointer-events-none absolute inset-0 max-[639px]:opacity-[0.44]"
      />
      <div
        aria-hidden="true"
        className="landing-glow-top-left pointer-events-none absolute inset-0 max-[639px]:opacity-[0.38]"
      />
      <div
        aria-hidden="true"
        className="landing-glow-bottom-right pointer-events-none absolute inset-0 max-[639px]:opacity-[0.33]"
      />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1280px] flex-col px-4 pb-5 pt-5 max-[639px]:pb-5 max-[639px]:pt-3 sm:px-6 sm:pb-6 sm:pt-6 lg:px-11 lg:pb-8 lg:pt-8 xl:px-12">
        <Header />
        <main className="flex flex-1 items-start py-5 max-[639px]:py-2.5 sm:items-center sm:py-7 lg:py-8">
          <HomeOnboardingSection />
        </main>
        <Footer />
      </div>
    </div>
  );
}
