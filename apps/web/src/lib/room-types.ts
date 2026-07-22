import type { RectSegment, SurfaceExclusion } from './surface';
import type { SavedWorkItem } from './work-types';

export interface RoomOpening {
  id: string;
  type: 'door' | 'window';
  width_cm: number;
  height_cm: number;
  count: number;
}

export interface RoomDimensions {
  length_cm: number;
  width_cm: number;
  height_cm: number;
  segments?: RectSegment[] | null;
  exclusions?: SurfaceExclusion[] | null;
  source?: 'manual' | 'scan' | 'import' | 'cv';
  confidence_score?: 'high' | 'medium' | 'low';
  /** Incertitude de mesure (cm), CV-5. Non nulle uniquement si source='cv'. */
  length_cm_uncertainty?: number | null;
  width_cm_uncertainty?: number | null;
  height_cm_uncertainty?: number | null;
}

/** Pièce d'un projet (ENG-2). Renvoyée par GET /projects/:id/rooms. */
export interface Room {
  id: string;
  name: string;
  sort_order: number;
  dimensions: RoomDimensions | null;
  openings: RoomOpening[];
  work_items: SavedWorkItem[];
}
