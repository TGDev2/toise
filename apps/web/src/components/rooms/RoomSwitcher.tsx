'use client';

import { useState } from 'react';

export interface RoomSwitcherRoom {
  id: string;
  name: string;
}

interface RoomSwitcherProps {
  rooms: RoomSwitcherRoom[];
  activeRoomId: string;
  onSelect: (roomId: string) => void;
  /** CRUD optionnel : absent → mode sélection seule (ex. étape work-selection). */
  onAdd?: () => void;
  onRename?: (roomId: string, name: string) => void;
  onDelete?: (roomId: string) => void;
  busy?: boolean;
  disabled?: boolean;
}

export function RoomSwitcher({
  rooms,
  activeRoomId,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  busy = false,
  disabled = false,
}: RoomSwitcherProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const startRename = (room: RoomSwitcherRoom) => {
    setConfirmDeleteId(null);
    setEditingId(room.id);
    setEditValue(room.name);
  };

  const commitRename = () => {
    if (editingId && onRename) {
      const trimmed = editValue.trim();
      if (trimmed) onRename(editingId, trimmed);
    }
    setEditingId(null);
  };

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-medium text-stone-500">Pièces :</span>

        {rooms.map((room) => {
          const isActive = room.id === activeRoomId;

          if (editingId === room.id) {
            return (
              <input
                key={room.id}
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setEditingId(null);
                }}
                maxLength={255}
                aria-label="Nom de la pièce"
                className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-900 focus:border-stone-500 focus:outline-none"
              />
            );
          }

          return (
            <div
              key={room.id}
              className={`inline-flex items-center gap-1 rounded-full border px-1 py-0.5 text-sm transition-colors ${
                isActive
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(room.id)}
                disabled={busy}
                className="rounded-full px-3 py-1 font-medium disabled:opacity-50"
              >
                {room.name}
              </button>

              {isActive && !disabled && onRename && (
                <button
                  type="button"
                  onClick={() => startRename(room)}
                  disabled={busy}
                  title="Renommer la pièce"
                  aria-label={`Renommer ${room.name}`}
                  className="rounded-full p-1 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                    <path d="m2.695 12.477 1.83-.363 6.945-6.945-1.467-1.467-6.945 6.945-.363 1.83ZM12.79 3.665l.53-.53a1.037 1.037 0 0 0-1.467-1.467l-.53.53 1.467 1.467Z" />
                  </svg>
                </button>
              )}
              {isActive && !disabled && onDelete && rooms.length > 1 && (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(room.id)}
                  disabled={busy}
                  title="Supprimer la pièce"
                  aria-label={`Supprimer ${room.name}`}
                  className="rounded-full p-1 text-stone-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                    <path d="M5 3.5V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v.5h2.25a.75.75 0 0 1 0 1.5h-.32l-.6 8.4A1.75 1.75 0 0 1 10.79 14H5.21a1.75 1.75 0 0 1-1.74-1.6l-.6-8.4h-.32a.75.75 0 0 1 0-1.5H5Z" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}

        {!disabled && onAdd && (
          <button
            type="button"
            onClick={onAdd}
            disabled={busy}
            className="rounded-full border border-dashed border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-500 hover:border-stone-400 hover:text-stone-700 disabled:opacity-50"
          >
            + Ajouter une pièce
          </button>
        )}
      </div>

      {confirmDeleteId && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span>Supprimer cette pièce et toute sa géométrie ?</span>
          <button
            type="button"
            onClick={() => {
              onDelete?.(confirmDeleteId);
              setConfirmDeleteId(null);
            }}
            disabled={busy}
            className="rounded-full bg-red-600 px-3 py-1 font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Supprimer
          </button>
          <button
            type="button"
            onClick={() => setConfirmDeleteId(null)}
            className="rounded-full px-3 py-1 font-medium text-red-700 hover:bg-red-100"
          >
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}
