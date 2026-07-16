import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-[2rem] border border-stone-200 bg-white p-8 text-center shadow-[0_25px_80px_rgba(67,39,15,0.10)]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
          Erreur 404
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-stone-950">
          Page introuvable
        </h1>
        <p className="mt-3 text-sm text-stone-600">
          La page que vous cherchez n&apos;existe pas ou a été déplacée.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[var(--accent-strong)]"
        >
          Retour au tableau de bord
        </Link>
      </div>
    </main>
  );
}
