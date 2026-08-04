'use client';

import { useAuth } from '@/contexts/AuthContext';
import { apiGet, apiPost } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { readGuestDrafts, writeGuestDrafts } from '@/lib/guest-drafts';
import type {
  WorkTypeRef,
  WorkItemSelection,
  SavedWorkItem,
} from '@/lib/work-types';
import type { Room } from '@/lib/room-types';
import { WorkSelectionForm } from '@/components/work-selection/WorkSelectionForm';
import { FlowProgress } from '@/components/quote-flow/FlowProgress';
import { RoomSwitcher } from '@/components/rooms/RoomSwitcher';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export default function WorkSelectionPage() {
  const { appUser, isGuest, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [rooms, setRooms] = useState<Room[]>([]);
  const [workTypes, setWorkTypes] = useState<WorkTypeRef[]>([]);
  const [initialSelections, setInitialSelections] = useState<SavedWorkItem[]>(
    [],
  );
  const [projectName, setProjectName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  const roomParam = searchParams.get('room');
  const activeRoomId = useMemo(() => {
    if (rooms.length === 0) return null;
    if (roomParam && rooms.some((r) => r.id === roomParam)) return roomParam;
    return rooms[0].id;
  }, [rooms, roomParam]);

  useEffect(() => {
    if (isLoading) return;
    if (!appUser && !isGuest) {
      router.push('/login');
      return;
    }

    async function load() {
      try {
        if (appUser) {
          const [types, project, roomList] = await Promise.all([
            apiGet<WorkTypeRef[]>('/projects/work-types'),
            apiGet<{ name: string }>(`/projects/${projectId}`),
            apiGet<Room[]>(`/projects/${projectId}/rooms`),
          ]);
          setWorkTypes(types);
          setProjectName(project.name);
          setRooms(roomList);
        } else {
          const project = readGuestDrafts().find((p) => p.id === projectId);
          if (project) {
            setProjectName(project.name);
          }
          try {
            const types = await apiGet<WorkTypeRef[]>('/projects/work-types');
            setWorkTypes(types);
          } catch {
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

  // Seed the selection from the active room's work items (once per room).
  const seededRoomIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!appUser || !activeRoomId) return;
    if (seededRoomIdRef.current === activeRoomId) return;
    const room = rooms.find((r) => r.id === activeRoomId);
    if (!room) return;
    seededRoomIdRef.current = activeRoomId;
    setInitialSelections(room.work_items ?? []);
  }, [appUser, activeRoomId, rooms]);

  const goToRoom = useCallback(
    (roomId: string) => {
      router.replace(`/projects/${projectId}/work-selection?room=${roomId}`);
    },
    [projectId, router],
  );

  const handleSave = useCallback(
    async (items: WorkItemSelection[]) => {
      setError('');
      setIsSaving(true);
      try {
        if (appUser) {
          const roomQ = activeRoomId ? `?room=${activeRoomId}` : '';
          await apiPost(`/projects/${projectId}/work-items${roomQ}`, { items });
        } else {
          const projects = readGuestDrafts();
          const idx = projects.findIndex((p) => p.id === projectId);
          if (idx !== -1) {
            projects[idx].work_items = items;
            projects[idx].updated_at = new Date().toISOString();
            writeGuestDrafts(projects);
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
    [appUser, projectId, router, activeRoomId],
  );

  if (isLoading || !loaded) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Chargement...</p>
      </main>
    );
  }

  const backHref = activeRoomId
    ? `/projects/${projectId}/dimensions?room=${activeRoomId}`
    : `/projects/${projectId}/dimensions`;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <FlowProgress
        step="work"
        projectId={projectId}
        backHref={backHref}
        projectName={projectName}
      />

      <h1 className="mb-6 text-2xl font-semibold text-stone-950 sm:text-3xl">
        Selection des travaux
      </h1>

      {/* Sélecteur de pièces (sélection seule ; ajout/suppression à l'étape dimensions) */}
      {appUser && rooms.length > 0 && activeRoomId && (
        <RoomSwitcher
          rooms={rooms}
          activeRoomId={activeRoomId}
          onSelect={goToRoom}
          busy={isSaving}
        />
      )}

      {error && (
        <div className="mb-6 rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {workTypes.length > 0 && (
        <section className="rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
          <WorkSelectionForm
            key={activeRoomId ?? 'guest'}
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
