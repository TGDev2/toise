import { render, screen } from '@testing-library/react';
import { CommunityWorkTypeFilter } from '../CommunityWorkTypeFilter';

describe('CommunityWorkTypeFilter', () => {
  // COM-2 : les filtres deviennent des liens crawlables (`/community?work_type=...`)
  // au lieu d'un état client, pour que chaque vue filtrée soit une URL réelle.
  it('renders a link per work type plus a link back to the unfiltered gallery', () => {
    render(<CommunityWorkTypeFilter selected={null} />);

    expect(screen.getByRole('link', { name: 'Tous' })).toHaveAttribute(
      'href',
      '/community',
    );
    expect(screen.getByRole('link', { name: 'Carrelage' })).toHaveAttribute(
      'href',
      '/community?work_type=tiling',
    );
  });

  it('highlights the selected work type', () => {
    render(<CommunityWorkTypeFilter selected="tiling" />);

    expect(screen.getByRole('link', { name: 'Carrelage' }).className).toContain(
      'bg-stone-900',
    );
    expect(screen.getByRole('link', { name: 'Tous' }).className).not.toContain(
      'bg-stone-900',
    );
  });

  it('highlights "Tous" when no work type is selected', () => {
    render(<CommunityWorkTypeFilter selected={null} />);

    expect(screen.getByRole('link', { name: 'Tous' }).className).toContain(
      'bg-stone-900',
    );
  });
});
