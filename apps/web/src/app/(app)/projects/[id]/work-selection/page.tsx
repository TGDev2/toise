'use client';

import { useAuth } from '@/contexts/AuthContext';
import { apiGet, apiPost } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { readGuestDrafts, writeGuestDrafts } from '@/lib/guest-drafts';
import type {
  WorkTypeRef,
  WorkItemSelection,
  SavedWorkItem,
  WorkSelectionSuggestion,
  LastWorkSelectionItem,
} from '@/lib/work-types';
import type { Room } from '@/lib/room-types';
import { WorkSelectionForm } from '@/components/work-selection/WorkSelectionForm';
import { FlowProgress } from '@/components/quote-flow/FlowProgress';
import { RoomSwitcher } from '@/components/rooms/RoomSwitcher';
import { Alert, Skeleton } from '@/components/ui';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

export default function WorkSelectionPage() {
  const { appUser, isGuest, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [rooms, setRooms] = useState<Room[]>([]);
  const [workTypes, setWorkTypes] = useState<WorkTypeRef[]>([]);
  const [projectName, setProjectName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [lastProjectSelection, setLastProjectSelection] = useState<
    LastWorkSelectionItem[] | null
  >(null);

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
          // E4-4 : la reprise du dernier chantier part avec les trois autres
          // appels, jamais après — elle ne doit pas ajouter d'aller-retour à
          // l'écran qu'elle sert à raccourcir. Optionnelle par construction :
          // un échec laisse simplement la sélection vide.
          const [types, project, roomList, lastSelection] = await Promise.all([
            apiGet<WorkTypeRef[]>('/projects/work-types'),
            apiGet<{ name: string }>(`/projects/${projectId}`),
            apiGet<Room[]>(`/projects/${projectId}/rooms`),
            apiGet<LastWorkSelectionItem[]>(
              `/projects/${projectId}/work-items/last-selection`,
            ).catch(() => [] as LastWorkSelectionItem[]),
          ]);
          setWorkTypes(types);
          setProjectName(project.name);
          setRooms(roomList);
          setLastProjectSelection(lastSelection);
        } else {
          const project = readGuestDrafts().find((p) => p.id === projectId);
          if (project) {
            setProjectName(project.name);
          }
          // L'invité est mono-projet et mono-pièce : rien à reprendre.
          setLastProjectSelection([]);
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

  /*
    Sélection déjà enregistrée pour la pièce active.

    Dérivée de `rooms` plutôt que posée par un effet : un effet ne s'exécute
    qu'**après** le premier rendu, or `WorkSelectionForm` fige son état dans ses
    initialiseurs `useState` et ne se remonte qu'au changement de `key`. Le
    formulaire naissait donc systématiquement vide, y compris en revenant sur
    une pièce dont les travaux étaient enregistrés — ce que le parcours
    multi-pièces fait à chaque correction.
  */
  const initialSelections = useMemo<SavedWorkItem[]>(() => {
    if (!appUser || !activeRoomId) return [];
    return rooms.find((r) => r.id === activeRoomId)?.work_items ?? [];
  }, [appUser, activeRoomId, rooms]);

  const goToRoom = useCallback(
    (roomId: string) => {
      router.replace(`/projects/${projectId}/work-selection?room=${roomId}`);
    },
    [projectId, router],
  );

  /**
   * E4-4 — ce qu'on propose à une pièce encore vierge.
   *
   * La pièce précédente du **même** chantier passe avant le dernier chantier :
   * elle est plus proche, et elle ne coûte aucun appel — `GET /rooms` porte
   * déjà les `work_items` de toutes les pièces. La plus récemment ajoutée
   * (`sort_order` le plus élevé, hors pièce courante) fait foi.
   */
  const suggestion = useMemo<WorkSelectionSuggestion | undefined>(() => {
    const activeRoom = rooms.find((r) => r.id === activeRoomId);
    if (!activeRoom || (activeRoom.work_items?.length ?? 0) > 0) return undefined;

    const sibling = rooms
      .filter((r) => r.id !== activeRoomId && (r.work_items?.length ?? 0) > 0)
      .sort((a, b) => b.sort_order - a.sort_order)[0];

    if (sibling) {
      return {
        work_type_ids: sibling.work_items.map((w) => w.work_type.id),
        skill_level: sibling.work_items[0].skill_level,
        custom_params: Object.fromEntries(
          sibling.work_items
            .filter((w) => Object.keys(w.custom_params).length > 0)
            .map((w) => [w.work_type.id, w.custom_params]),
        ),
        source: 'room',
      };
    }

    if (!lastProjectSelection?.length) return undefined;
    return {
      work_type_ids: lastProjectSelection.map((w) => w.work_type_id),
      skill_level: lastProjectSelection[0].skill_level,
      custom_params: Object.fromEntries(
        lastProjectSelection
          .filter((w) => Object.keys(w.custom_params).length > 0)
          .map((w) => [w.work_type_id, w.custom_params]),
      ),
      source: 'project',
    };
  }, [rooms, activeRoomId, lastProjectSelection]);

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
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-6 h-96 rounded-[2rem]" />
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
        <Alert variant="error" className="mb-6">
          {error}
        </Alert>
      )}

      {workTypes.length > 0 && (
        <section className="rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
          <WorkSelectionForm
            key={activeRoomId ?? 'guest'}
            workTypes={workTypes}
            initialSelections={initialSelections}
            suggestion={suggestion}
            onSave={handleSave}
            isSaving={isSaving}
          />
        </section>
      )}
    </main>
  );
}
