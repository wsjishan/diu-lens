import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { HomeOnboardingSection } from '@/components/HomeOnboardingSection';

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[radial-gradient(circle_at_18%_18%,rgba(59,130,246,0.18),transparent_32%),radial-gradient(circle_at_82%_74%,rgba(96,165,250,0.16),transparent_36%)] from-slate-50 via-white to-sky-50 bg-gradient-to-br dark:bg-[radial-gradient(circle_at_18%_18%,rgba(59,130,246,0.12),transparent_32%),radial-gradient(circle_at_80%_78%,rgba(79,70,229,0.1),transparent_38%)] dark:from-[#0b1220] dark:via-[#0f172a] dark:to-[#0b1220]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(37,99,235,0.12),transparent_42%),radial-gradient(circle_at_85%_82%,rgba(15,23,42,0.1),transparent_48%)] dark:bg-[radial-gradient(circle_at_16%_14%,rgba(37,99,235,0.1),transparent_34%),radial-gradient(circle_at_78%_74%,rgba(30,64,175,0.08),transparent_46%)]" />
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
        <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 shadow-[0_20px_70px_-40px_rgba(15,23,42,0.45),0_8px_24px_-18px_rgba(15,23,42,0.28),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-sm dark:border-white/10 dark:bg-[#0f172a]/90 dark:shadow-[0_16px_40px_-26px_rgba(0,0,0,0.55)]">
          <div className="pointer-events-none absolute inset-0">
            <div className="ai-grid absolute inset-0 opacity-10 dark:opacity-10" />
            <div className="ai-noise absolute inset-0 opacity-20 dark:opacity-25" />
            <div className="ai-orbital absolute top-[-18%] right-[-12%] h-96 w-96 rounded-full opacity-70 blur-3xl dark:opacity-45" />
            <div className="ai-orbital absolute bottom-[-24%] left-[-18%] h-80 w-80 rounded-full opacity-55 blur-3xl [animation-delay:-7s] dark:opacity-35" />
          </div>
          <div className="relative z-10 shrink-0 px-4 pt-4 sm:px-6 sm:pt-5 lg:px-8 lg:pt-6">
            <Header />
          </div>
          <main className="relative z-10 flex min-h-0 flex-1 items-stretch px-4 pb-6 pt-2 sm:px-6 sm:pb-8 sm:pt-3 lg:px-8 lg:pb-10 lg:pt-4">
            <HomeOnboardingSection />
          </main>
          <div className="relative z-10 shrink-0 px-4 pb-4 sm:px-6 sm:pb-5 lg:px-8">
            <Footer />
          </div>
        </div>
      </div>
    </div>
  );
}
