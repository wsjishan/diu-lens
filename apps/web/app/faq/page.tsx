'use client';

import { useState } from 'react';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';

const faqs = [
  {
    question: 'Why should I register in DIU Lens?',
    answer:
      'Verify your identity once and access campus services without repeated verification.',
  },
  {
    question: 'Is my facial data secure?',
    answer:
      'Yes. Your data is securely stored and used only for identity verification within DIU systems.',
  },
  {
    question: 'How long does registration take?',
    answer: 'The process takes less than 2 minutes.',
  },
  {
    question: 'Do I need to register multiple times?',
    answer: 'No. Registration is a one-time process.',
  },
  {
    question: 'What if my face is not recognized?',
    answer: 'You can retry the verification. Multiple angles improve accuracy.',
  },
  {
    question: 'Is this required for DIU students?',
    answer:
      'DIU Lens is designed to become the standard identification system across campus.',
  },
];

export default function FaqPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    setOpenIndex((current) => (current === index ? null : index));
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-linear-to-br from-white via-blue-50 to-white dark:bg-linear-to-br dark:from-[#0b1220] dark:via-[#0f172a] dark:to-[#0b1220]">
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 px-4 py-3 sm:px-6 sm:py-4 lg:px-8 lg:py-3">
        <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-50/95 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_8px_16px_-14px_rgba(15,23,42,0.24)] dark:border-white/10 dark:bg-[#0f172a] dark:shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
          <div className="relative z-10 shrink-0">
            <Header />
          </div>

          <main className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-4">
            <section className="w-full max-w-4xl space-y-4" aria-label="FAQ">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 sm:text-3xl">
                Frequently Asked Questions
              </h1>

              <div className="space-y-3">
                {faqs.map((faq, index) => (
                  <article
                    key={faq.question}
                    className="rounded-xl border border-border bg-card p-4 shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => toggle(index)}
                      className="flex w-full cursor-pointer items-center justify-between gap-3 text-left"
                      aria-expanded={openIndex === index}
                    >
                      <h2 className="text-base font-semibold text-foreground">
                        {faq.question}
                      </h2>
                      <span
                        className={`text-muted-foreground transition-transform duration-200 ${openIndex === index ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                      >
                        ↓
                      </span>
                    </button>
                    {openIndex === index && (
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {faq.answer}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          </main>

          <div className="relative z-10 shrink-0">
            <Footer />
          </div>
        </div>
      </div>
    </div>
  );
}
