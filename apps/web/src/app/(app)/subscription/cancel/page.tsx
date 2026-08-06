'use client';

import { useRouter } from 'next/navigation';

export default function SubscriptionCancelPage() {
  const router = useRouter();

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-[2rem] border border-stone-200 bg-[var(--surface)] p-8 text-center shadow-[0_25px_80px_rgba(67,39,15,0.10)]">
        <div className="mb-4 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-stone-100">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-7 w-7 text-stone-500"
            >
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-stone-900">
          Souscription annulée
        </h1>
        <p className="mt-3 text-sm text-stone-600">
          Vous n&apos;avez pas été débité. Vous pouvez souscrire à tout moment
          depuis votre tableau de bord.
        </p>

        <button
          onClick={() => router.push('/dashboard')}
          className="mt-6 w-full rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-[var(--accent-strong)]"
        >
          Retour au tableau de bord
        </button>
      </div>
    </main>
  );
}
