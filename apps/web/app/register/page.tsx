import { RegistrationFlow } from '@/features/registration/RegistrationFlow';

export default function RegisterPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
      <section className="w-full">
        <RegistrationFlow />
      </section>
    </main>
  );
}
