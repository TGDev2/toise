import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectCard } from '../ProjectCard';
import type { ProjectSummary } from '@/lib/project-types';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockAuth: { appUser: { subscription_tier: string } | null } = {
  appUser: null,
};
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

const baseProject: ProjectSummary = {
  id: 'test-uuid',
  name: 'Rénovation salon',
  room_name: 'Salon',
  work_type: 'painting',
  status: 'draft',
  dimensions: null,
  created_at: '2026-03-27T00:00:00.000Z',
  updated_at: '2026-03-27T00:00:00.000Z',
};

describe('ProjectCard', () => {
  const onDelete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.appUser = null;
  });

  it('renders project name and room', () => {
    render(<ProjectCard project={baseProject} onDelete={onDelete} />);
    expect(screen.getByText('Rénovation salon')).toBeInTheDocument();
    expect(screen.getByText(/Salon/)).toBeInTheDocument();
  });

  it('renders work type label', () => {
    render(<ProjectCard project={baseProject} onDelete={onDelete} />);
    expect(screen.getByText('Peinture')).toBeInTheDocument();
  });

  it('renders status badge', () => {
    render(<ProjectCard project={baseProject} onDelete={onDelete} />);
    expect(screen.getByText('Brouillon')).toBeInTheDocument();
  });

  it('renders dimensions when present', () => {
    const project: ProjectSummary = {
      ...baseProject,
      dimensions: { length_cm: 500, width_cm: 400, height_cm: 250 },
    };
    render(<ProjectCard project={project} onDelete={onDelete} />);
    expect(screen.getByText('5.00 m')).toBeInTheDocument();
    expect(screen.getByText('4.00 m')).toBeInTheDocument();
    expect(screen.getByText('2.50 m')).toBeInTheDocument();
  });

  it('navigates to dimensions for draft projects', () => {
    render(<ProjectCard project={baseProject} onDelete={onDelete} />);
    fireEvent.click(screen.getByText('Définir les dimensions'));
    expect(mockPush).toHaveBeenCalledWith('/projects/test-uuid/dimensions');
  });

  it('navigates to estimate for estimated projects', () => {
    const project: ProjectSummary = { ...baseProject, status: 'estimated' };
    render(<ProjectCard project={project} onDelete={onDelete} />);
    fireEvent.click(screen.getByText('Voir les résultats'));
    expect(mockPush).toHaveBeenCalledWith('/projects/test-uuid/estimate');
  });

  it('navigates to estimate for completed projects', () => {
    const project: ProjectSummary = { ...baseProject, status: 'completed' };
    render(<ProjectCard project={project} onDelete={onDelete} />);
    fireEvent.click(screen.getByText('Voir les résultats'));
    expect(mockPush).toHaveBeenCalledWith('/projects/test-uuid/estimate');
  });

  it('calls onDelete with project id', () => {
    render(<ProjectCard project={baseProject} onDelete={onDelete} />);
    fireEvent.click(screen.getByText('Supprimer'));
    expect(onDelete).toHaveBeenCalledWith('test-uuid');
  });

  /**
   * L'entrée « Suivi de chantier » n'existe plus (E4-3). Elle menait à une page
   * dont le premier effet est d'ouvrir le paywall de `site_tracking`, gate
   * gelée : `min_tier` valant le palier payant, un abonné se voyait proposer
   * de souscrire au palier qu'il détenait déjà.
   *
   * L'assertion porte sur le palier qui l'affichait — le seul cas où son
   * absence est une information. Testée pour un compte sans palier, elle
   * survivrait, muette, au rétablissement du bouton.
   */
  it('n’affiche plus l’entrée « Suivi de chantier », pas même à un abonné', () => {
    mockAuth.appUser = { subscription_tier: 'contractor_essentiel' };
    render(<ProjectCard project={baseProject} onDelete={onDelete} />);
    expect(screen.queryByText('Suivi de chantier')).not.toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
