import { groupEntriesByRoom } from '../logbook-types';
import type { RoomLogEntry } from '../logbook-types';

function makeEntry(overrides: Partial<RoomLogEntry> = {}): RoomLogEntry {
  return {
    id: 'entry-1',
    user_id: 'user-1',
    project_id: 'project-1',
    project_name: 'Rénovation salon',
    room_id: 'room-1',
    room_name: 'Salon',
    dimensions_snapshot: {
      length_cm: 400,
      width_cm: 300,
      height_cm: 250,
      source: 'manual',
      segments_json: null,
    },
    materials_snapshot: [],
    recorded_at: '2026-01-01T00:00:00.000Z',
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('groupEntriesByRoom', () => {
  it('regroupe les entrées par nom de pièce', () => {
    const entries = [
      makeEntry({ id: 'a', room_name: 'Salon' }),
      makeEntry({ id: 'b', room_name: 'Cuisine' }),
      makeEntry({ id: 'c', room_name: 'Salon' }),
    ];

    const groups = groupEntriesByRoom(entries);

    expect(groups.map((g) => g.room_name).sort()).toEqual(['Cuisine', 'Salon']);
    expect(groups.find((g) => g.room_name === 'Salon')?.entries).toHaveLength(2);
  });

  it('trie les entrées de chaque pièce par date décroissante', () => {
    const entries = [
      makeEntry({ id: 'old', room_name: 'Salon', recorded_at: '2026-01-01T00:00:00.000Z' }),
      makeEntry({ id: 'new', room_name: 'Salon', recorded_at: '2026-06-01T00:00:00.000Z' }),
    ];

    const [group] = groupEntriesByRoom(entries);

    expect(group.entries.map((e) => e.id)).toEqual(['new', 'old']);
  });

  it('trie les groupes par entrée la plus récente en tête', () => {
    const entries = [
      makeEntry({ id: 'a', room_name: 'Cuisine', recorded_at: '2026-05-01T00:00:00.000Z' }),
      makeEntry({ id: 'b', room_name: 'Salon', recorded_at: '2026-06-01T00:00:00.000Z' }),
    ];

    const groups = groupEntriesByRoom(entries);

    expect(groups.map((g) => g.room_name)).toEqual(['Salon', 'Cuisine']);
  });
});
