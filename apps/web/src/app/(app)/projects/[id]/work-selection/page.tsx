'use client';

import { useAuth } from '@/contexts/AuthContext';
import { apiGet, apiPost } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import type {
  WorkTypeRef,
  WorkItemSelection,
  SavedWorkItem,
} from '@/lib/work-types';
import { WorkSelectionForm } from '@/components/work-selection/WorkSelectionForm';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'estimate_local_projects';

interface LocalProject {
  id: string;
  name: string;
  room_name: string;
  work_type?: string;
  work_items?: WorkItemSelection[];
  updated_at: string;
}

export default function WorkSelectionPage() {
  const { appUser, isGuest, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [workTypes, setWorkTypes] = useState<WorkTypeRef[]>([]);
  const [initialSelections, setInitialSelections] = useState<SavedWorkItem[]>(
    [],
  );
  const [projectName, setProjectName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!appUser && !isGuest) {
      router.push('/login');
      return;
    }

    async function load() {
      try {
        if (appUser) {
          const [types, project, items] = await Promise.all([
            apiGet<WorkTypeRef[]>('/projects/work-types'),
            apiGet<{ name: string }>(`/projects/${projectId}`),
            apiGet<SavedWorkItem[]>(`/projects/${projectId}/work-items`),
          ]);
          setWorkTypes(types);
          setProjectName(project.name);
          setInitialSelections(items);
        } else {
          // Guest mode: use hardcoded work types from local référence
          // In guest mode we don't have the API, so we use a minimal set
          const raw = localStorage.getItem(STORAGE_KEY);
          const projects: LocalProject[] = raw ? JSON.parse(raw) : [];
          const project = projects.find((p) => p.id === projectId);
          if (project) {
            setProjectName(project.name);
          }
          // For guest mode, we still need work types from the API
          // but since guest users have an anonymous Firebase account,
          // the API should work
          try {
            const types = await apiGet<WorkTypeRef[]>('/projects/work-types');
            setWorkTypes(types);
          } catch {
            // Fallback: can't load work types in guest mode without API
            setError(
              'Impossible de charger les types de travaux. Veuillez vous connecter.',
            );
          }
        }
      } catch (err: unknown) {
        setError(getErrorMessage(err, 'Impossible de charger le projet'));
      } finally {
        setLoaded(true);
      }
    }

    load();
  }, [appUser, isGuest, isLoading, projectId, router]);

  const handleSave = useCallback(
    async (items: WorkItemSelection[]) => {
      setError('');
      setIsSaving(true);
      try {
        if (appUser) {
          await apiPost(`/projects/${projectId}/work-items`, { items });
        } else {
          // Guest mode: save to localStorage
          const raw = localStorage.getItem(STORAGE_KEY);
          const projects: LocalProject[] = raw ? JSON.parse(raw) : [];
          const idx = projects.findIndex((p) => p.id === projectId);
          if (idx !== -1) {
            projects[idx].work_items = items;
            projects[idx].updated_at = new Date().toISOString();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
          }
        }
        router.push(`/projects/${projectId}/estimate`);
      } catch (err: unknown) {
        setError(
          getErrorMessage(err, 'Impossible de sauvegarder les travaux'),
        );
      } finally {
        setIsSaving(false);
      }
    },
    [appUser, projectId, router],
  );

  if (isLoading || !loaded) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Chargement...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <button
          type="button"
          onClick={() => router.push(`/projects/${projectId}/dimensions`)}
          className="text-sm text-stone-500 hover:text-stone-700"
        >
          &larr; Retour aux dimensions
        </button>
        <h1 className="mt-2 text-3xl font-semibold text-stone-950">
          Selection des travaux
        </h1>
        {projectName && (
          <p className="mt-1 text-sm text-stone-500">{projectName}</p>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {workTypes.length > 0 && (
        <section className="rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
          <WorkSelectionForm
            workTypes={workTypes}
            initialSelections={initialSelections}
            onSave={handleSave}
            isSaving={isSaving}
          />
        </section>
      )}
    </main>
  );
}
