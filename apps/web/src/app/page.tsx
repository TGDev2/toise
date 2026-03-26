'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getErrorMessage } from '@/lib/errors';

const highlights = [
  'Commencez un projet sans compte et convertissez-le au moment de la sauvegarde.',
  'Connectez-vous avec un email, Google ou Apple selon votre preference.',
  'Retrouvez vos brouillons et gerez votre compte depuis un dashboard unique.',
];

export default function HomePage() {
  const { appUser, isGuest, isLoading, startGuestSession } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStartProject = async () => {
    setError('');

    if (appUser || isGuest) {
      router.push('/dashboard');
      return;
    }

    setLoading(true);
    try {
      await startGuestSession();
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de demarrer le mode invite'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-1 items-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[2rem] border border-amber-950/10 bg-[var(--surface)] p-8 shadow-[0_25px_80px_rgba(67,39,15,0.10)] sm:p-10">
          <div className="inline-flex items-center rounded-full border border-emerald-900/10 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-900">
            EstiMate MVP
          </div>

          <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight text-stone-950 sm:text-5xl">
            Demarrez un projet de renovation sans friction, puis sauvegardez-le
            avec le mode d&apos;authentification de votre choix.
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-700">
            Cette version couvre l&apos;inscription email, Google et Apple, le
            mode invite et le parcours de mot de passe oublie. Le visiteur peut
            preparer un brouillon avant la creation de compte.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleStartProject}
              disabled={loading || isLoading}
              className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Demarrage...' : 'Commencer un projet'}
            </button>
            <Link
              href={appUser || isGuest ? '/dashboard' : '/login'}
              className="rounded-full border border-stone-300 px-6 py-3 text-center text-sm font-semibold text-stone-800 hover:-translate-y-0.5 hover:border-stone-500 hover:bg-white"
            >
              {appUser || isGuest ? 'Ouvrir mon dashboard' : 'Se connecter'}
            </Link>
            {!appUser && !isGuest && (
              <Link
                href="/register"
                className="rounded-full border border-transparent px-6 py-3 text-center text-sm font-semibold text-stone-700 hover:text-stone-950"
              >
                Creer un compte
              </Link>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <ul className="mt-10 grid gap-3 text-sm text-stone-700 sm:grid-cols-3">
            {highlights.map((item) => (
              <li
                key={item}
                className="rounded-2xl border border-stone-200/80 bg-white/80 p-4"
              >
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-[2rem] bg-stone-950 p-8 text-stone-50 shadow-[0_25px_80px_rgba(26,15,7,0.28)] sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200/80">
            Parcours couverts
          </p>
          <div className="mt-6 space-y-5">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-semibold text-white">1. Mode invite</p>
              <p className="mt-2 text-sm leading-7 text-stone-300">
                Un visiteur peut ouvrir un brouillon de projet avant de choisir
                comment il souhaite s&apos;identifier.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-semibold text-white">
                2. Conversion a la sauvegarde
              </p>
              <p className="mt-2 text-sm leading-7 text-stone-300">
                Au moment de sauvegarder, un ecran leger propose email, Google
                ou Apple pour transformer le brouillon en compte.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-semibold text-white">
                3. Verification et reset
              </p>
              <p className="mt-2 text-sm leading-7 text-stone-300">
                Les inscriptions email declenchent un email de verification et
                les comptes non verifies sont refuses a la connexion classique.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
