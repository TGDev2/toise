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

  it('does not render the site tracking entry point for non-contractor users', () => {
    render(<ProjectCard project={baseProject} onDelete={onDelete} />);
    expect(screen.queryByText('Suivi de chantier')).not.toBeInTheDocument();
  });

  it('navigates to site tracking for contractor users', () => {
    mockAuth.appUser = { subscription_tier: 'contractor_standard' };
    render(<ProjectCard project={baseProject} onDelete={onDelete} />);
    fireEvent.click(screen.getByText('Suivi de chantier'));
    expect(mockPush).toHaveBeenCalledWith('/projects/test-uuid/site-tracking');
  });
});
