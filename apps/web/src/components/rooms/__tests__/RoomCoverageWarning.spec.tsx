import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoomCoverageWarning } from '../RoomCoverageWarning';
import type { Room } from '@/lib/room-types';

function makeRoom(id: string, name: string): Room {
  return {
    id,
    name,
    sort_order: 0,
    dimensions: null,
    openings: [],
    work_items: [],
  };
}

const PROJECT_ID = 'project-1';
const covered = makeRoom('room-covered', 'Salon');
const missingWork1 = makeRoom('room-2', 'Pièce 2');
const missingWork2 = makeRoom('room-3', 'Pièce 3');
const missingDimensions = makeRoom('room-4', 'Pièce 4');

describe('RoomCoverageWarning', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders nothing when every room is covered', () => {
    const { container } = render(
      <RoomCoverageWarning
        projectId={PROJECT_ID}
        coveredRooms={[covered]}
        roomsMissingWorkItems={[]}
        roomsMissingDimensions={[]}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('names every room measured without a work item, and what the estimate covers', () => {
    render(
      <RoomCoverageWarning
        projectId={PROJECT_ID}
        coveredRooms={[covered]}
        roomsMissingWorkItems={[missingWork1, missingWork2]}
        roomsMissingDimensions={[]}
      />,
    );
    expect(screen.getByText(/Pièce 2, Pièce 3/)).toBeVisible();
    expect(screen.getByText(/Ce chiffrage couvre : Salon\./)).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Choisir les ouvrages de Pièce 2' }),
    ).toHaveAttribute(
      'href',
      `/projects/${PROJECT_ID}/work-selection?room=room-2`,
    );
  });

  it('names every room with a work item but incomplete dimensions', () => {
    render(
      <RoomCoverageWarning
        projectId={PROJECT_ID}
        coveredRooms={[]}
        roomsMissingWorkItems={[]}
        roomsMissingDimensions={[missingDimensions]}
      />,
    );
    expect(
      screen.getByText(/dimensions incomplètes : Pièce 4\./),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Mesurer Pièce 4' }),
    ).toHaveAttribute('href', `/projects/${PROJECT_ID}/dimensions?room=room-4`);
  });

  it('stays dismissed on re-render after being dismissed, without hiding a new gap', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <RoomCoverageWarning
        projectId={PROJECT_ID}
        coveredRooms={[covered]}
        roomsMissingWorkItems={[missingWork1]}
        roomsMissingDimensions={[]}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Ignorer cet avertissement' }));
    expect(screen.queryByText(/Pièce 2/)).not.toBeInTheDocument();

    // Same missing room, same component instance: dismissal holds.
    rerender(
      <RoomCoverageWarning
        projectId={PROJECT_ID}
        coveredRooms={[covered]}
        roomsMissingWorkItems={[missingWork1]}
        roomsMissingDimensions={[]}
      />,
    );
    expect(screen.queryByText(/Pièce 2/)).not.toBeInTheDocument();

    // A newly uncovered room changes the missing-room set: warning returns.
    rerender(
      <RoomCoverageWarning
        projectId={PROJECT_ID}
        coveredRooms={[covered]}
        roomsMissingWorkItems={[missingWork1, missingWork2]}
        roomsMissingDimensions={[]}
      />,
    );
    expect(screen.getByText(/Pièce 2, Pièce 3/)).toBeVisible();
  });
});
