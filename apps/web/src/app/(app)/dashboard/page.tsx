'use client';

import { GuestPromptModal } from '@/components/auth/GuestPromptModal';
import { useAuth } from '@/contexts/AuthContext';
import { getErrorMessage } from '@/lib/errors';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type WorkType = 'painting' | 'tiling' | 'flooring' | 'partition';

interface ProjectDraft {
  id: string;
  name: string;
  room_name: string;
  work_type: WorkType;
  length_m: number;
  width_m: number;
  height_m: number;
  updated_at: string;
}

const STORAGE_KEY = 'estimate_local_projects';
const WORK_TYPES: Array<{ value: WorkType; label: string }> = [
  { value: 'painting', label: 'Peinture' },
  { value: 'tiling', label: 'Carrelage' },
  { value: 'flooring', label: 'Parquet' },
  { value: 'partition', label: 'Cloison' },
];

function readStoredProjects(): ProjectDraft[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const rawProjects = localStorage.getItem(STORAGE_KEY);
  if (!rawProjects) {
    return [];
  }

  try {
    const parsedProjects = JSON.parse(rawProjects);
    return Array.isArray(parsedProjects) ? parsedProjects : [];
  } catch {
    return [];
  }
}

function persistProjects(projects: ProjectDraft[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

function formatProjectDate(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function DashboardPage() {
  const { appUser, isGuest, isLoading, logout, deleteAccount } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectDraft[]>([]);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [form, setForm] = useState({
    name: 'Renovation salon',
    room_name: 'Salon',
    work_type: 'painting' as WorkType,
    length_m: '5',
    width_m: '4',
    height_m: '2.5',
  });

  useEffect(() => {
    if (!isLoading && !appUser && !isGuest) {
      router.push('/login');
    }
  }, [appUser, isGuest, isLoading, router]);

  useEffect(() => {
    setProjects(readStoredProjects());
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const handleDeleteAccount = async () => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm('Supprimer definitivement votre compte et vos donnees ?')
    ) {
      return;
    }

    setError('');
    setIsDeleting(true);

    try {
      await deleteAccount();
      router.push('/login');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de supprimer le compte'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateDraft = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const length = Number.parseFloat(form.length_m);
    const width = Number.parseFloat(form.width_m);
    const height = Number.parseFloat(form.height_m);

    if ([length, width, height].some((value) => Number.isNaN(value) || value <= 0)) {
      setError('Renseignez des dimensions superieures a zero.');
      return;
    }

    const project: ProjectDraft = {
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}`,
      name: form.name.trim(),
      room_name: form.room_name.trim(),
      work_type: form.work_type,
      length_m: length,
      width_m: width,
      height_m: height,
      updated_at: new Date().toISOString(),
    };

    const nextProjects = [project, ...projects];
    persistProjects(nextProjects);
    setProjects(nextProjects);
    setIsComposerOpen(false);
    setForm({
      name: 'Renovation salon',
      room_name: 'Salon',
      work_type: 'painting',
      length_m: '5',
      width_m: '4',
      height_m: '2.5',
    });

    if (isGuest) {
      setFeedback(
        'Projet brouillon cree. Creez maintenant un compte pour le sauvegarder durablement.',
      );
      setShowGuestPrompt(true);
      return;
    }

    setFeedback('Projet brouillon enregistre dans votre dashboard.');
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Chargement...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 rounded-[2rem] border border-stone-200 bg-[var(--surface)] p-6 shadow-[0_25px_80px_rgba(67,39,15,0.10)] lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
            Dashboard
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-stone-950">
            Mes projets
          </h1>
          {isGuest && (
            <p className="mt-3 text-sm text-amber-700">
              Mode invite - vous pouvez preparer un projet, puis creer votre
              compte au moment de la sauvegarde.
            </p>
          )}
          {appUser && (
            <p className="mt-3 text-sm text-stone-500">{appUser.email}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setIsComposerOpen((currentValue) => !currentValue)}
            className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-[var(--accent-strong)]"
          >
            {isComposerOpen ? 'Fermer le formulaire' : 'Creer un projet'}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-700 hover:-translate-y-0.5 hover:bg-white"
          >
            {isGuest ? 'Quitter le mode invite' : 'Deconnexion'}
          </button>
          {appUser && (
            <button
              type="button"
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="rounded-full border border-red-200 px-5 py-2.5 text-sm font-semibold text-red-700 hover:-translate-y-0.5 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDeleting ? 'Suppression...' : 'Supprimer mon compte'}
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
          {feedback}
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {isComposerOpen && (
        <section className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
          <h2 className="text-xl font-semibold text-stone-950">
            Preparer un brouillon de projet
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            Le visiteur peut avancer sans compte jusqu&apos;a l&apos;etape de
            sauvegarde.
          </p>

          <form onSubmit={handleCreateDraft} className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-stone-700">
                Nom du projet
              </span>
              <input
                required
                value={form.name}
                onChange={(event) =>
                  setForm((currentForm) => ({
                    ...currentForm,
                    name: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm text-stone-900 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-stone-700">
                Piece concernee
              </span>
              <input
                required
                value={form.room_name}
                onChange={(event) =>
                  setForm((currentForm) => ({
                    ...currentForm,
                    room_name: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm text-stone-900 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-stone-700">
                Type de travaux
              </span>
              <select
                value={form.work_type}
                onChange={(event) =>
                  setForm((currentForm) => ({
                    ...currentForm,
                    work_type: event.target.value as WorkType,
                  }))
                }
                className="w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm text-stone-900 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              >
                {WORK_TYPES.map((workType) => (
                  <option key={workType.value} value={workType.value}>
                    {workType.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-4 sm:grid-cols-3 md:col-span-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-stone-700">
                  Longueur (m)
                </span>
                <input
                  required
                  min="0.1"
                  step="0.1"
                  type="number"
                  value={form.length_m}
                  onChange={(event) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      length_m: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm text-stone-900 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-stone-700">
                  Largeur (m)
                </span>
                <input
                  required
                  min="0.1"
                  step="0.1"
                  type="number"
                  value={form.width_m}
                  onChange={(event) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      width_m: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm text-stone-900 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-stone-700">
                  Hauteur (m)
                </span>
                <input
                  required
                  min="0.1"
                  step="0.1"
                  type="number"
                  value={form.height_m}
                  onChange={(event) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      height_m: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm text-stone-900 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
              </label>
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-stone-800"
              >
                Continuer jusqu&apos;a la sauvegarde
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        {projects.map((project) => (
          <article
            key={project.id}
            className="rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                  {WORK_TYPES.find((workType) => workType.value === project.work_type)
                    ?.label ?? 'Projet'}
                </p>
                <h2 className="mt-2 text-xl font-semibold text-stone-950">
                  {project.name}
                </h2>
                <p className="mt-1 text-sm text-stone-600">
                  Piece : {project.room_name}
                </p>
              </div>
              <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
                {formatProjectDate(project.updated_at)}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3 text-sm text-stone-700">
              <div className="rounded-2xl bg-stone-50 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  Longueur
                </p>
                <p className="mt-2 font-semibold">{project.length_m} m</p>
              </div>
              <div className="rounded-2xl bg-stone-50 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  Largeur
                </p>
                <p className="mt-2 font-semibold">{project.width_m} m</p>
              </div>
              <div className="rounded-2xl bg-stone-50 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  Hauteur
                </p>
                <p className="mt-2 font-semibold">{project.height_m} m</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              {isGuest ? (
                <button
                  type="button"
                  onClick={() => setShowGuestPrompt(true)}
                  className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-[var(--accent-strong)]"
                >
                  Sauvegarder dans mon compte
                </button>
              ) : (
                <span className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800">
                  Disponible dans votre dashboard sur cet appareil
                </span>
              )}
            </div>
          </article>
        ))}
      </section>

      {!projects.length && !isComposerOpen && (
        <section className="mt-6 rounded-[2rem] border-2 border-dashed border-stone-300 bg-white/60 p-12 text-center">
          <h2 className="text-2xl font-semibold text-stone-950">
            Aucun projet pour le moment
          </h2>
          <p className="mt-3 text-sm text-stone-600">
            Creez un premier brouillon pour couvrir le parcours visiteur,
            sauvegarde et conversion vers un compte.
          </p>
          <button
            type="button"
            onClick={() => setIsComposerOpen(true)}
            className="mt-6 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-[var(--accent-strong)]"
          >
            Creer mon premier projet
          </button>
        </section>
      )}

      <GuestPromptModal
        isOpen={showGuestPrompt}
        onClose={() => setShowGuestPrompt(false)}
        onSuccess={() => {
          setShowGuestPrompt(false);
          setFeedback(
            "Compte cree. Si vous avez choisi l'inscription par email, verifiez votre boite de reception.",
          );
        }}
      />
    </main>
  );
}
