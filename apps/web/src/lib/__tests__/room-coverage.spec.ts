import { computeRoomCoverage } from '../room-coverage';
import type { Room } from '../room-types';

function makeRoom(overrides: Partial<Room>): Room {
  return {
    id: 'room-1',
    name: 'Pièce 1',
    sort_order: 0,
    dimensions: null,
    openings: [],
    work_items: [],
    ...overrides,
  };
}

const SOME_DIMENSIONS = { length_cm: 400, width_cm: 300, height_cm: 250 };
const SOME_WORK_ITEM = [{ id: 'wi-1' }] as unknown as Room['work_items'];

describe('computeRoomCoverage', () => {
  it('classifies a room with dimensions and a work item as covered', () => {
    const room = makeRoom({ dimensions: SOME_DIMENSIONS, work_items: SOME_WORK_ITEM });
    const coverage = computeRoomCoverage([room]);
    expect(coverage.coveredRooms).toEqual([room]);
    expect(coverage.roomsMissingWorkItems).toEqual([]);
    expect(coverage.roomsMissingDimensions).toEqual([]);
  });

  it('classifies a room with dimensions but no work item as missing work items', () => {
    const room = makeRoom({ dimensions: SOME_DIMENSIONS, work_items: [] });
    const coverage = computeRoomCoverage([room]);
    expect(coverage.roomsMissingWorkItems).toEqual([room]);
    expect(coverage.coveredRooms).toEqual([]);
    expect(coverage.roomsMissingDimensions).toEqual([]);
  });

  it('classifies a room with a work item but no dimensions as missing dimensions', () => {
    const room = makeRoom({ dimensions: null, work_items: SOME_WORK_ITEM });
    const coverage = computeRoomCoverage([room]);
    expect(coverage.roomsMissingDimensions).toEqual([room]);
    expect(coverage.coveredRooms).toEqual([]);
    expect(coverage.roomsMissingWorkItems).toEqual([]);
  });

  it('ignores a freshly created room with neither dimensions nor work items', () => {
    const room = makeRoom({ dimensions: null, work_items: [] });
    const coverage = computeRoomCoverage([room]);
    expect(coverage.coveredRooms).toEqual([]);
    expect(coverage.roomsMissingWorkItems).toEqual([]);
    expect(coverage.roomsMissingDimensions).toEqual([]);
  });

  it('classifies each room of a mixed project independently', () => {
    const covered = makeRoom({
      id: 'room-covered',
      dimensions: SOME_DIMENSIONS,
      work_items: SOME_WORK_ITEM,
    });
    const missingWork = makeRoom({
      id: 'room-missing-work',
      dimensions: SOME_DIMENSIONS,
      work_items: [],
    });
    const missingDimensions = makeRoom({
      id: 'room-missing-dimensions',
      dimensions: null,
      work_items: SOME_WORK_ITEM,
    });
    const coverage = computeRoomCoverage([covered, missingWork, missingDimensions]);
    expect(coverage.coveredRooms).toEqual([covered]);
    expect(coverage.roomsMissingWorkItems).toEqual([missingWork]);
    expect(coverage.roomsMissingDimensions).toEqual([missingDimensions]);
  });

  it('returns empty buckets for an empty project', () => {
    expect(computeRoomCoverage([])).toEqual({
      coveredRooms: [],
      roomsMissingWorkItems: [],
      roomsMissingDimensions: [],
    });
  });
});
