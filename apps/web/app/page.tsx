import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { HomeOnboardingSection } from '@/components/HomeOnboardingSection';

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-linear-to-br from-white via-blue-50 to-white lg:h-screen lg:overflow-hidden dark:bg-linear-to-br dark:from-[#0b1220] dark:via-[#0f172a] dark:to-[#0b1220]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(37,99,235,0.14),transparent_42%),radial-gradient(circle_at_85%_82%,rgba(15,23,42,0.1),transparent_48%)] dark:bg-[radial-gradient(circle_at_16%_14%,rgba(37,99,235,0.12),transparent_34%),radial-gradient(circle_at_78%_74%,rgba(30,64,175,0.1),transparent_46%),linear-gradient(180deg,rgba(11,18,32,0.55)_0%,rgba(15,23,42,0.72)_100%)]" />
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 px-4 py-3 sm:px-6 sm:py-4 lg:px-8 lg:py-3">
        <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-50/95 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_8px_16px_-14px_rgba(15,23,42,0.24)] dark:border dark:border-white/10 dark:bg-[#0f172a] dark:shadow-[0_10px_30px_rgba(0,0,0,0.4)] lg:h-full">
          <div className="pointer-events-none absolute inset-0">
            <div className="ai-grid absolute inset-0 opacity-14 dark:opacity-14" />
            <div className="ai-noise absolute inset-0 opacity-30 dark:opacity-30" />
            <div className="ai-orbital absolute top-[-18%] right-[-10%] h-104 w-104 rounded-full opacity-75 blur-2xl dark:opacity-45" />
            <div className="ai-orbital absolute bottom-[-26%] left-[-14%] h-88 w-88 rounded-full opacity-65 blur-2xl [animation-delay:-7s] dark:opacity-35" />
            <div className="ai-scan-beam absolute inset-x-0 top-0 h-24 opacity-35 dark:opacity-16" />
          </div>
          <div className="relative z-10 shrink-0">
            <Header />
          </div>
          <main className="relative z-10 flex min-h-0 flex-1 items-start px-4 py-3 sm:px-6 sm:py-4 lg:items-center lg:px-8 lg:py-4">
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
