import type { Room } from './room-types';

/**
 * ENG-2 — un devis se construit à partir de `estimableRooms` côté API
 * (dimensions ET au moins un ouvrage). Cette fonction reflète le même
 * prédicat côté web, à partir de la même source (`GET /projects/:id/rooms`),
 * pour que les écrans du tunnel puissent signaler ce que l'API ignorera
 * silencieusement.
 */
export interface RoomCoverage {
  /** Dimensions renseignées ET au moins un ouvrage : entre dans le chiffrage. */
  coveredRooms: Room[];
  /** Dimensions renseignées, aucun ouvrage : ignorée par le chiffrage. */
  roomsMissingWorkItems: Room[];
  /** Au moins un ouvrage, dimensions absentes : ignorée par le chiffrage. */
  roomsMissingDimensions: Room[];
}

export function computeRoomCoverage(rooms: Room[]): RoomCoverage {
  const coveredRooms: Room[] = [];
  const roomsMissingWorkItems: Room[] = [];
  const roomsMissingDimensions: Room[] = [];

  for (const room of rooms) {
    const hasDimensions = room.dimensions != null;
    const hasWorkItems = room.work_items.length > 0;

    if (hasDimensions && hasWorkItems) {
      coveredRooms.push(room);
    } else if (hasDimensions && !hasWorkItems) {
      roomsMissingWorkItems.push(room);
    } else if (!hasDimensions && hasWorkItems) {
      roomsMissingDimensions.push(room);
    }
    // Ni dimensions ni ouvrage : pièce fraîchement créée, rien à signaler.
  }

  return { coveredRooms, roomsMissingWorkItems, roomsMissingDimensions };
}
