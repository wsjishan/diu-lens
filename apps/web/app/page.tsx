import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { HomeOnboardingSection } from '@/components/HomeOnboardingSection';

export default function Home() {
  return (
    <div className="landing-page relative flex min-h-screen flex-col overflow-x-hidden">
      <div
        aria-hidden="true"
        className="landing-radial pointer-events-none absolute inset-0 opacity-95"
      />
      <div
        aria-hidden="true"
        className="landing-grid-overlay pointer-events-none absolute inset-0 opacity-45 dark:opacity-72"
      />
      <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 px-4 py-3 sm:px-6 sm:py-4 lg:max-w-7xl lg:px-8 lg:py-6">
        <div className="landing-shell relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-3xl border lg:h-full">
          <div className="pointer-events-none absolute inset-0">
            <div className="ai-noise absolute inset-0 opacity-10 dark:opacity-8" />
            <div className="absolute -top-[8%] right-[-12%] h-[32rem] w-[32rem] rounded-full bg-blue-400/10 blur-3xl dark:bg-blue-500/14" />
          </div>
          <div className="relative z-10 shrink-0">
            <Header />
          </div>
          <main className="relative z-10 flex min-h-0 flex-1 items-center px-3 py-3 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
            <HomeOnboardingSection />
          </main>
          <div className="relative z-10 shrink-0">
            <Footer />
          </div>
        </div>
      </div>
    </div>
  );
}
