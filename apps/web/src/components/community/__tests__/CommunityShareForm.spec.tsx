import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CommunityShareForm } from '../CommunityShareForm';
import { apiPost } from '@/lib/api';
import type { BudgetSummary } from '@/lib/shopping-list-types';

jest.mock('@/lib/api', () => ({
  apiPost: jest.fn(),
}));

const mockApiPost = apiPost as jest.MockedFunction<typeof apiPost>;

function makeSummary(overrides: Partial<BudgetSummary> = {}): BudgetSummary {
  return {
    total_real_cost: 91,
    total_brute_cost: 100,
    savings_amount: 9,
    savings_percent: 9,
    items_priced: 1,
    items_total: 1,
    is_complete: true,
    by_category: [],
    computed_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText(/Titre de la publication/i), {
    target: { value: 'Rénovation salle de bain' },
  });
  fireEvent.change(screen.getByLabelText(/Durée du projet/i), {
    target: { value: '5' },
  });
  fireEvent.click(
    screen.getByRole('checkbox', { name: /J'accepte/i }),
  );
}

describe('CommunityShareForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiPost.mockResolvedValue({ id: 'entry-1' } as never);
  });

  // COM-1 : le coût réel vient désormais de la liste d'achats finalisée, plus
  // d'un input manuel — ce test garde la régression de resurgir.
  it('does not render manual material or cost inputs', () => {
    render(
      <CommunityShareForm
        projectId="project-1"
        photos={[]}
        budgetSummary={makeSummary()}
        onSuccess={jest.fn()}
      />,
    );

    expect(screen.queryByText(/Ajouter un matériau/i)).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/Coût total \(EUR\)/i),
    ).not.toBeInTheDocument();
  });

  it('renders the real cost from the finalized budget summary, read-only', () => {
    render(
      <CommunityShareForm
        projectId="project-1"
        photos={[]}
        budgetSummary={makeSummary({ total_real_cost: 123.45 })}
        onSuccess={jest.fn()}
      />,
    );

    expect(screen.getByText(/123\.45 EUR/)).toBeInTheDocument();
  });

  it('submits without materials_list/total_cost_cents in the payload', async () => {
    const onSuccess = jest.fn();
    render(
      <CommunityShareForm
        projectId="project-1"
        photos={[]}
        budgetSummary={makeSummary()}
        onSuccess={onSuccess}
      />,
    );

    fillRequiredFields();
    fireEvent.click(screen.getByRole('button', { name: /Soumettre/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());

    expect(mockApiPost).toHaveBeenCalledWith(
      '/community',
      expect.objectContaining({
        project_id: 'project-1',
        title: 'Rénovation salle de bain',
        duration_days: 5,
      }),
    );
    const [, body] = mockApiPost.mock.calls[0];
    expect(body).not.toHaveProperty('materials_list');
    expect(body).not.toHaveProperty('total_cost_cents');
  });

  it('blocks submission without GDPR consent', () => {
    render(
      <CommunityShareForm
        projectId="project-1"
        photos={[]}
        budgetSummary={makeSummary()}
        onSuccess={jest.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Titre de la publication/i), {
      target: { value: 'Rénovation salle de bain' },
    });
    fireEvent.change(screen.getByLabelText(/Durée du projet/i), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Soumettre/i }));

    expect(mockApiPost).not.toHaveBeenCalled();
  });
});
