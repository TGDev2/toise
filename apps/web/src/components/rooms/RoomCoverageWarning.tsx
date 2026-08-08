'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { Room } from '@/lib/room-types';

interface RoomCoverageWarningProps {
  projectId: string;
  coveredRooms: Room[];
  roomsMissingWorkItems: Room[];
  roomsMissingDimensions: Room[];
}

const DISMISS_KEY_PREFIX = 'chiffreo_room_coverage_dismissed_';

/**
 * E2-5 — clé empreinte sur le projet ET l'ensemble courant des pièces
 * manquantes. Un dismiss ne doit couvrir que *cette* situation : si une
 * nouvelle pièce devient non couverte plus tard, elle doit être signalée,
 * pas absorbée par un dismiss déjà posé (ce serait reproduire en silence le
 * défaut que ce bandeau corrige).
 */
function dismissKey(projectId: string, missingRoomIds: string[]): string {
  const fingerprint = [...missingRoomIds].sort().join(',');
  return `${DISMISS_KEY_PREFIX}${projectId}_${fingerprint}`;
}

function pluralize(count: number, singular: string, plural: string): string {
  return count > 1 ? plural : singular;
}

export function RoomCoverageWarning({
  projectId,
  coveredRooms,
  roomsMissingWorkItems,
  roomsMissingDimensions,
}: RoomCoverageWarningProps) {
  const missingRoomIds = [
    ...roomsMissingWorkItems.map((r) => r.id),
    ...roomsMissingDimensions.map((r) => r.id),
  ];
  const key = dismissKey(projectId, missingRoomIds);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(key) === '1');
  }, [key]);

  const dismiss = useCallback(() => {
    localStorage.setItem(key, '1');
    setDismissed(true);
  }, [key]);

  if (missingRoomIds.length === 0 || dismissed) return null;

  const missingWorkItemsSentence = roomsMissingWorkItems.length
    ? `${roomsMissingWorkItems.length} ${pluralize(roomsMissingWorkItems.length, 'pièce mesurée', 'pièces mesurées')} sans ouvrage : ${roomsMissingWorkItems.map((r) => r.name).join(', ')}.`
    : null;

  const missingDimensionsSentence = roomsMissingDimensions.length
    ? `${roomsMissingDimensions.length} ${pluralize(roomsMissingDimensions.length, 'pièce', 'pièces')} avec ouvrage mais aux dimensions incomplètes : ${roomsMissingDimensions.map((r) => r.name).join(', ')}.`
    : null;

  const coverageSentence = coveredRooms.length
    ? `Ce chiffrage couvre : ${coveredRooms.map((r) => r.name).join(', ')}.`
    : 'Ce chiffrage ne couvre aucune pièce pour le moment.';

  return (
    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-amber-900">
          Ce chantier compte des pièces non prises en compte
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Ignorer cet avertissement"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-amber-700 hover:bg-amber-100"
        >
          &times;
        </button>
      </div>

      {missingWorkItemsSentence && (
        <div className="mt-2 text-sm text-amber-800">
          <p>{missingWorkItemsSentence}</p>
          <p className="mt-1 flex flex-wrap gap-x-3">
            {roomsMissingWorkItems.map((room) => (
              <Link
                key={room.id}
                href={`/projects/${projectId}/work-selection?room=${room.id}`}
                className="font-medium text-amber-900 underline hover:text-amber-950"
              >
                Choisir les ouvrages de {room.name}
              </Link>
            ))}
          </p>
        </div>
      )}

      {missingDimensionsSentence && (
        <div className="mt-2 text-sm text-amber-800">
          <p>{missingDimensionsSentence}</p>
          <p className="mt-1 flex flex-wrap gap-x-3">
            {roomsMissingDimensions.map((room) => (
              <Link
                key={room.id}
                href={`/projects/${projectId}/dimensions?room=${room.id}`}
                className="font-medium text-amber-900 underline hover:text-amber-950"
              >
                Mesurer {room.name}
              </Link>
            ))}
          </p>
        </div>
      )}

      <p className="mt-2 text-xs text-amber-700">{coverageSentence}</p>
    </div>
  );
}
