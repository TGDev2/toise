'use client';

import { useAuth } from '@/contexts/AuthContext';
import { apiGet, apiPut } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { DimensionsForm } from '@/components/dimensions/DimensionsForm';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'estimate_local_projects';

interface DimensionsData {
  length_cm: number;
  width_cm: number;
  height_cm: number;
}

interface LocalProject {
  id: string;
  name: string;
  room_name: string;
  work_type: string;
  length_m?: number;
  width_m?: number;
  height_m?: number;
  updated_at: string;
}

export default function DimensionsPage() {
  const { appUser, isGuest, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [initialDims, setInitialDims] = useState<DimensionsData | null>(null);
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
          const project = await apiGet<{
            name: string;
            dimensions: DimensionsData | null;
          }>(`/projects/${projectId}`);
          setProjectName(project.name);
          if (project.dimensions) {
            setInitialDims(project.dimensions);
          }
        } else {
          const raw = localStorage.getItem(STORAGE_KEY);
          const projects: LocalProject[] = raw ? JSON.parse(raw) : [];
          const project = projects.find((p) => p.id === projectId);
          if (project) {
            setProjectName(project.name);
            if (project.length_m && project.width_m && project.height_m) {
              setInitialDims({
                length_cm: Math.round(project.length_m * 100),
                width_cm: Math.round(project.width_m * 100),
                height_cm: Math.round(project.height_m * 100),
              });
            }
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
    async (lengthCm: number, widthCm: number, heightCm: number) => {
      setError('');
      setIsSaving(true);
      try {
        if (appUser) {
          await apiPut(`/projects/${projectId}/dimensions`, {
            length_cm: lengthCm,
            width_cm: widthCm,
            height_cm: heightCm,
          });
        } else {
          const raw = localStorage.getItem(STORAGE_KEY);
          const projects: LocalProject[] = raw ? JSON.parse(raw) : [];
          const idx = projects.findIndex((p) => p.id === projectId);
          if (idx !== -1) {
            projects[idx].length_m = lengthCm / 100;
            projects[idx].width_m = widthCm / 100;
            projects[idx].height_m = heightCm / 100;
            projects[idx].updated_at = new Date().toISOString();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
          }
        }
        router.push('/dashboard');
      } catch (err: unknown) {
        setError(getErrorMessage(err, 'Impossible de sauvegarder les dimensions'));
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
          onClick={() => router.push('/dashboard')}
          className="text-sm text-stone-500 hover:text-stone-700"
        >
          &larr; Retour au dashboard
        </button>
        <h1 className="mt-2 text-3xl font-semibold text-stone-950">
          Dimensions de la piece
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

      <section className="rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
        <DimensionsForm
          initialLengthCm={initialDims?.length_cm ?? 0}
          initialWidthCm={initialDims?.width_cm ?? 0}
          initialHeightCm={initialDims?.height_cm ?? 0}
          onSave={handleSave}
          isSaving={isSaving}
        />
      </section>
    </main>
  );
}
