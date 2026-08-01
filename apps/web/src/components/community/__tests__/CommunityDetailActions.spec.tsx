import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { CommunityDetailActions } from '../CommunityDetailActions';
import { apiDelete, apiGet } from '@/lib/api';
import type { CommunityProjectDetail } from '@/lib/community-types';

jest.mock('@/lib/api', () => ({
  apiGet: jest.fn(),
  apiDelete: jest.fn(),
}));

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

const mockApiGet = apiGet as jest.MockedFunction<typeof apiGet>;
const mockApiDelete = apiDelete as jest.MockedFunction<typeof apiDelete>;

function makeDetail(
  overrides: Partial<CommunityProjectDetail> = {},
): CommunityProjectDetail {
  return {
    id: 'project-1',
    title: 'Carrelage salle de bain',
    work_type: 'tiling',
    description: null,
    purchase_list: null,
    budget_summary: null,
    total_cost_cents: 85000,
    duration_days: 4,
    length_cm: 400,
    width_cm: 200,
    height_cm: null,
    before_photo_ids: [],
    after_photo_ids: [],
    likes_count: 3,
    comments_count: 0,
    user_display_name: 'g***',
    published_at: '2026-07-01T00:00:00.000Z',
    has_liked: false,
    is_owner: false,
    ...overrides,
  };
}

describe('CommunityDetailActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.appUser = null;
  });

  it('shows a non-interactive count pill before personalization resolves', () => {
    mockApiGet.mockReturnValue(new Promise(() => {})); // never resolves
    render(
      <CommunityDetailActions
        communityProjectId="project-1"
        initialLikesCount={3}
      />,
    );

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('mounts the like button with the resolved liked state once personalization loads', async () => {
    mockApiGet.mockResolvedValue(makeDetail({ has_liked: true, likes_count: 5 }));
    render(
      <CommunityDetailActions
        communityProjectId="project-1"
        initialLikesCount={3}
      />,
    );

    await waitFor(() => expect(screen.getByText('5')).toBeInTheDocument());
    expect(mockApiGet).toHaveBeenCalledWith('/community/project-1');
  });

  it('does not render the withdraw button for a non-owner', async () => {
    mockApiGet.mockResolvedValue(makeDetail({ is_owner: false }));
    render(
      <CommunityDetailActions
        communityProjectId="project-1"
        initialLikesCount={3}
      />,
    );

    await waitFor(() => expect(mockApiGet).toHaveBeenCalled());
    expect(
      screen.queryByRole('button', { name: /Retirer de la galerie/i }),
    ).not.toBeInTheDocument();
  });

  it('renders the withdraw button once personalization resolves the viewer as owner', async () => {
    mockApiGet.mockResolvedValue(makeDetail({ is_owner: true }));
    render(
      <CommunityDetailActions
        communityProjectId="project-1"
        initialLikesCount={3}
      />,
    );

    expect(
      await screen.findByRole('button', { name: /Retirer de la galerie/i }),
    ).toBeInTheDocument();
  });

  it('withdraws the project and redirects to the gallery on confirm', async () => {
    mockApiGet.mockResolvedValue(makeDetail({ is_owner: true }));
    mockApiDelete.mockResolvedValue(undefined);
    render(
      <CommunityDetailActions
        communityProjectId="project-1"
        initialLikesCount={3}
      />,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: /Retirer de la galerie/i }),
    );
    fireEvent.click(screen.getByRole('button', { name: /^Retirer$/i }));

    await waitFor(() =>
      expect(mockApiDelete).toHaveBeenCalledWith('/community/project-1'),
    );
    expect(mockPush).toHaveBeenCalledWith('/community');
  });
});
