'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { ProBadge } from '@/components/paywall/ProBadge';
import { apiGet, apiPost, apiPut, apiDelete, apiPatch } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import type { Opening, RectSegment, SurfaceExclusion } from '@/lib/surface';
import type { Room } from '@/lib/room-types';
import { DimensionsForm } from '@/components/dimensions/DimensionsForm';
import { FlowProgress } from '@/components/quote-flow/FlowProgress';
import { RoomSwitcher } from '@/components/rooms/RoomSwitcher';
import { AnalyzeButton } from '@/components/analysis/AnalyzeButton';
import { AnalysisResultPanel } from '@/components/analysis/AnalysisResultPanel';
import { ReferenceObjectPrompt } from '@/components/analysis/ReferenceObjectPrompt';
import { useAnalysis } from '@/hooks/useAnalysis';
import type { ReferenceType } from '@/hooks/useAnalysis';
import { Alert, Skeleton } from '@/components/ui';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'chiffreo_local_projects';

interface DimensionsData {
  length_cm: number;
  width_cm: number;
  height_cm: number;
  segments?: RectSegment[] | null;
  exclusions?: SurfaceExclusion[] | null;
  source?: 'manual' | 'scan' | 'import' | 'cv';
  length_cm_uncertainty?: number | null;
  width_cm_uncertainty?: number | null;
  height_cm_uncertainty?: number | null;
}

interface LocalProject {
  id: string;
  name: string;
  room_name: string;
  work_type: string;
  length_m?: number;
  width_m?: number;
  height_m?: number;
  openings?: Opening[];
  segments?: RectSegment[];
  exclusions?: SurfaceExclusion[];
  updated_at: string;
}

export default function DimensionsPage() {
  const { appUser, isGuest, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [rooms, setRooms] = useState<Room[]>([]);
  const [initialDims, setInitialDims] = useState<DimensionsData | null>(null);
  const [initialOpenings, setInitialOpenings] = useState<Opening[]>([]);
  const [initialExclusions, setInitialExclusions] = useState<SurfaceExclusion[]>([]);
  const [existingOpeningIds, setExistingOpeningIds] = useState<string[]>([]);
  const [projectName, setProjectName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [roomBusy, setRoomBusy] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [hasPhotos, setHasPhotos] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);

  const analysis = useAnalysis(projectId);
  const cvGate = useFeatureGate('cv_analysis');

  const roomParam = searchParams.get('room');
  const activeRoomId = useMemo(() => {
    if (rooms.length === 0) return null;
    if (roomParam && rooms.some((r) => r.id === roomParam)) return roomParam;
    return rooms[0].id;
  }, [rooms, roomParam]);
  const isDefaultRoom = rooms.length > 0 && activeRoomId === rooms[0].id;
  const isReadOnly = false;

  const seedFromRoom = useCallback((room: Room | undefined) => {
    if (room?.dimensions) {
      setInitialDims({
        length_cm: room.dimensions.length_cm,
        width_cm: room.dimensions.width_cm,
        height_cm: room.dimensions.height_cm,
        segments: room.dimensions.segments ?? null,
        exclusions: room.dimensions.exclusions ?? null,
        source: room.dimensions.source,
        length_cm_uncertainty: room.dimensions.length_cm_uncertainty,
        width_cm_uncertainty: room.dimensions.width_cm_uncertainty,
        height_cm_uncertainty: room.dimensions.height_cm_uncertainty,
      });
    } else {
      setInitialDims(null);
    }
    setInitialExclusions(room?.dimensions?.exclusions ?? []);
    const ops = room?.openings ?? [];
    setInitialOpenings(
      ops.map((o) => ({
        type: o.type,
        width_cm: o.width_cm,
        height_cm: o.height_cm,
        count: o.count,
      })),
    );
    setExistingOpeningIds(ops.map((o) => o.id));
    setShowManualForm(false);
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!appUser && !isGuest) {
      router.push('/login');
      return;
    }

    async function load() {
      try {
        if (appUser) {
          const [project, roomList] = await Promise.all([
            apiGet<{ name: string }>(`/projects/${projectId}`),
            apiGet<Room[]>(`/projects/${projectId}/rooms`),
          ]);
          setProjectName(project.name);
          setRooms(roomList);

          // Check if project has photos
          try {
            const photos = await apiGet<{ id: string }[]>(
              `/projects/${projectId}/photos`,
            );
            setHasPhotos(photos.length > 0);
          } catch {
            // Photos check is non-critical
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
                segments: project.segments ?? null,
                exclusions: project.exclusions ?? null,
              });
            }
            if (project.openings?.length) {
              setInitialOpenings(project.openings);
            }
            if (project.exclusions?.length) {
              setInitialExclusions(project.exclusions);
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

  // Seed the form once per selected room (logged-in). Guarded so that renaming a
  // room (which changes `rooms` but not the active id) never resets an edit.
  const seededRoomIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!appUser || !activeRoomId) return;
    if (seededRoomIdRef.current === activeRoomId) return;
    const room = rooms.find((r) => r.id === activeRoomId);
    if (!room) return;
    seededRoomIdRef.current = activeRoomId;
    seedFromRoom(room);
  }, [appUser, activeRoomId, rooms, seedFromRoom]);

  // Auto-trigger analysis from ?analyze=true query param (default room only)
  useEffect(() => {
    if (
      loaded &&
      hasPhotos &&
      cvGate.allowed &&
      searchParams.get('analyze') === 'true' &&
      analysis.status === 'idle' &&
      !initialDims &&
      isDefaultRoom
    ) {
      analysis.startAnalysis();
    }
  }, [
    loaded,
    hasPhotos,
    cvGate.allowed,
    searchParams,
    analysis,
    initialDims,
    isDefaultRoom,
  ]);

  const handleAcceptCvDimensions = useCallback(() => {
    if (analysis.dimensions) {
      setInitialDims({ ...analysis.dimensions, source: 'cv' });
      if (analysis.detectedOpenings.length > 0) {
        setInitialOpenings(
          analysis.detectedOpenings.map((o) => ({
            type: o.type,
            width_cm: o.width_cm,
            height_cm: o.height_cm,
            count: o.count,
          })),
        );
      }
      setShowManualForm(true);
    }
  }, [analysis.dimensions, analysis.detectedOpenings]);

  const handleManualFallback = useCallback(() => {
    setShowManualForm(true);
    analysis.reset();
  }, [analysis]);

  const handleRetryAnalysis = useCallback(async () => {
    analysis.reset();
    await analysis.startAnalysis();
  }, [analysis]);

  const handleRetryWithReference = useCallback(
    async (type: ReferenceType) => {
      analysis.reset();
      await analysis.startAnalysis({ type });
    },
    [analysis],
  );

  const goToRoom = useCallback(
    (roomId: string) => {
      router.replace(`/projects/${projectId}/dimensions?room=${roomId}`);
    },
    [projectId, router],
  );

  const handleAddRoom = useCallback(async () => {
    setRoomBusy(true);
    setError('');
    try {
      const room = await apiPost<Room>(`/projects/${projectId}/rooms`, {});
      setRooms((prev) => [...prev, room]);
      goToRoom(room.id);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible d’ajouter la pièce'));
    } finally {
      setRoomBusy(false);
    }
  }, [projectId, goToRoom]);

  const handleRenameRoom = useCallback(
    async (roomId: string, name: string) => {
      setRoomBusy(true);
      setError('');
      try {
        const updated = await apiPatch<Room>(
          `/projects/${projectId}/rooms/${roomId}`,
          { name },
        );
        // Preserve geometry (rename response carries no relations).
        setRooms((prev) =>
          prev.map((r) =>
            r.id === roomId
              ? { ...r, name: updated.name, sort_order: updated.sort_order }
              : r,
          ),
        );
      } catch (err: unknown) {
        setError(getErrorMessage(err, 'Impossible de renommer la pièce'));
      } finally {
        setRoomBusy(false);
      }
    },
    [projectId],
  );

  const handleDeleteRoom = useCallback(
    async (roomId: string) => {
      setRoomBusy(true);
      setError('');
      try {
        await apiDelete(`/projects/${projectId}/rooms/${roomId}`);
        const remaining = rooms.filter((r) => r.id !== roomId);
        setRooms(remaining);
        if (activeRoomId === roomId && remaining.length > 0) {
          goToRoom(remaining[0].id);
        }
      } catch (err: unknown) {
        setError(getErrorMessage(err, 'Impossible de supprimer la pièce'));
      } finally {
        setRoomBusy(false);
      }
    },
    [projectId, rooms, activeRoomId, goToRoom],
  );

  const handleSave = useCallback(
    async (
      lengthCm: number,
      widthCm: number,
      heightCm: number,
      openings: Opening[],
      segments: RectSegment[],
      exclusions: SurfaceExclusion[],
    ) => {
      setError('');
      setIsSaving(true);
      try {
        if (appUser) {
          const roomQ = activeRoomId ? `?room=${activeRoomId}` : '';
          // Save dimensions
          await apiPut(`/projects/${projectId}/dimensions${roomQ}`, {
            length_cm: lengthCm,
            width_cm: widthCm,
            height_cm: heightCm,
            segments: segments.length > 0 ? segments : undefined,
            exclusions: exclusions.length > 0 ? exclusions : undefined,
          });

          // Replace-all strategy: delete existing, then create new
          await Promise.all(
            existingOpeningIds.map((id) =>
              apiDelete(`/projects/${projectId}/openings/${id}`),
            ),
          );

          await Promise.all(
            openings.map((o) =>
              apiPost(`/projects/${projectId}/openings${roomQ}`, {
                type: o.type,
                width_cm: o.width_cm,
                height_cm: o.height_cm,
                count: o.count,
              }),
            ),
          );
        } else {
          const raw = localStorage.getItem(STORAGE_KEY);
          const projects: LocalProject[] = raw ? JSON.parse(raw) : [];
          const idx = projects.findIndex((p) => p.id === projectId);
          if (idx !== -1) {
            projects[idx].length_m = lengthCm / 100;
            projects[idx].width_m = widthCm / 100;
            projects[idx].height_m = heightCm / 100;
            projects[idx].openings = openings;
            projects[idx].segments = segments.length > 0 ? segments : undefined;
            projects[idx].exclusions = exclusions.length > 0 ? exclusions : undefined;
            projects[idx].updated_at = new Date().toISOString();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
          }
        }
        const nextQ = activeRoomId ? `?room=${activeRoomId}` : '';
        router.push(`/projects/${projectId}/work-selection${nextQ}`);
      } catch (err: unknown) {
        setError(getErrorMessage(err, 'Impossible de sauvegarder les dimensions'));
      } finally {
        setIsSaving(false);
      }
    },
    [appUser, projectId, router, existingOpeningIds, activeRoomId],
  );

  if (isLoading || !loaded) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-6 h-96 rounded-[2rem]" />
      </main>
    );
  }

  // Determine if we should show the analysis section (default room only)
  const canUseCv = cvGate.allowed;
  const showAnalysis =
    appUser && hasPhotos && !showManualForm && !initialDims && isDefaultRoom;
  const showResult =
    analysis.status === 'completed' && analysis.dimensions && !showManualForm;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <FlowProgress
        step="dimensions"
        projectId={projectId}
        projectName={projectName}
      />

      <h1 className="mb-6 text-2xl font-semibold text-stone-950 sm:text-3xl">
        Dimensions de la pièce
      </h1>

      {/* Sélecteur de pièces (connecté uniquement — l'invité reste mono-pièce) */}
      {appUser && rooms.length > 0 && activeRoomId && (
        <RoomSwitcher
          rooms={rooms}
          activeRoomId={activeRoomId}
          onSelect={goToRoom}
          onAdd={handleAddRoom}
          onRename={handleRenameRoom}
          onDelete={handleDeleteRoom}
          busy={roomBusy || isSaving}
          disabled={isReadOnly}
        />
      )}

      {error && (
        <Alert variant="error" className="mb-6">
          {error}
        </Alert>
      )}

      {/* CV Analysis Section */}
      {showAnalysis && canUseCv && (
        <div className="mb-6">
          {analysis.status === 'no_reference' ? (
            <ReferenceObjectPrompt
              onRetry={handleRetryAnalysis}
              onRetryWithReference={handleRetryWithReference}
              onManualFallback={handleManualFallback}
            />
          ) : (
            <AnalyzeButton
              status={analysis.status}
              progressPct={analysis.progressPct}
              hasPhotos={hasPhotos}
              onStart={analysis.startAnalysis}
              onManualFallback={handleManualFallback}
            />
          )}
        </div>
      )}

      {/* CV Analysis Gated (Pro feature) */}
      {showAnalysis && !canUseCv && (
        <div className="mb-6">
          <div className="rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-stone-950">
                    Analyse automatique
                  </h3>
                  <ProBadge />
                </div>
                <p className="mt-2 text-sm text-stone-600">
                  Détectez automatiquement les dimensions de votre pièce à partir de vos photos.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => cvGate.guardAction(() => {})}
                className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white opacity-75 hover:-translate-y-0.5"
              >
                Analyser les photos
              </button>
              <button
                type="button"
                onClick={handleManualFallback}
                className="rounded-full border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-700 hover:-translate-y-0.5 hover:bg-white"
              >
                Saisie manuelle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Result */}
      {showResult && analysis.dimensions && (
        <div className="mb-6">
          <AnalysisResultPanel
            lengthCm={analysis.dimensions.length_cm}
            widthCm={analysis.dimensions.width_cm}
            heightCm={analysis.dimensions.height_cm}
            confidence={analysis.confidence}
            lengthUncertaintyCm={analysis.dimensions.length_cm_uncertainty}
            widthUncertaintyCm={analysis.dimensions.width_cm_uncertainty}
            heightUncertaintyCm={analysis.dimensions.height_cm_uncertainty}
            openings={analysis.detectedOpenings}
            openingDetector={analysis.openingDetector}
            onAccept={handleAcceptCvDimensions}
            onEdit={handleManualFallback}
          />
        </div>
      )}

      {/* Manual Dimensions Form */}
      {(showManualForm || initialDims || !showAnalysis) && (
        <section className="rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
          <DimensionsForm
            key={activeRoomId ?? 'guest'}
            initialLengthCm={initialDims?.length_cm ?? 0}
            initialWidthCm={initialDims?.width_cm ?? 0}
            initialHeightCm={initialDims?.height_cm ?? 0}
            initialOpenings={initialOpenings}
            initialSegments={initialDims?.segments ?? undefined}
            initialExclusions={initialExclusions}
            sourceIsCv={initialDims?.source === 'cv'}
            lengthUncertaintyCm={initialDims?.length_cm_uncertainty}
            widthUncertaintyCm={initialDims?.width_cm_uncertainty}
            heightUncertaintyCm={initialDims?.height_cm_uncertainty}
            onSave={handleSave}
            isSaving={isSaving}
          />
        </section>
      )}
    </main>
  );
}
