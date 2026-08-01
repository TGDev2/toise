export interface RoomLogDimensionsSnapshot {
  length_cm: number;
  width_cm: number;
  height_cm: number;
  source: string;
  segments_json: unknown[] | null;
}

export interface RoomLogMaterialSnapshot {
  material_id: string;
  material_name: string;
  material_category: string;
  work_type_label: string;
  pose_type: string;
  real_unit_price: number | null;
  store_name: string | null;
}

export interface RoomLogEntry {
  id: string;
  user_id: string;
  project_id: string | null;
  project_name: string;
  room_id: string | null;
  room_name: string;
  dimensions_snapshot: RoomLogDimensionsSnapshot;
  materials_snapshot: RoomLogMaterialSnapshot[];
  recorded_at: string;
  created_at: string;
}

export interface RoomLogGroup {
  room_name: string;
  entries: RoomLogEntry[];
}

/**
 * Regroupe les entrées par nom de pièce, chaque groupe trié par date
 * décroissante, et les groupes eux-mêmes triés par entrée la plus récente
 * en tête.
 */
export function groupEntriesByRoom(entries: RoomLogEntry[]): RoomLogGroup[] {
  const byRoom = new Map<string, RoomLogEntry[]>();

  for (const entry of entries) {
    const group = byRoom.get(entry.room_name) ?? [];
    group.push(entry);
    byRoom.set(entry.room_name, group);
  }

  const groups = Array.from(byRoom.entries()).map(([room_name, groupEntries]) => ({
    room_name,
    entries: [...groupEntries].sort(
      (a, b) => Date.parse(b.recorded_at) - Date.parse(a.recorded_at),
    ),
  }));

  return groups.sort(
    (a, b) =>
      Date.parse(b.entries[0].recorded_at) - Date.parse(a.entries[0].recorded_at),
  );
}
