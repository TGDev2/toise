import { renderHook, waitFor } from '@testing-library/react';
import { useReferrals } from '../useReferrals';
import { apiGet } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  apiGet: jest.fn(),
}));

const mockAuth: { appUser: { id: string } | null } = {
  appUser: { id: 'user-1' },
};
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

const mockedApiGet = apiGet as jest.MockedFunction<typeof apiGet>;

describe('useReferrals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.appUser = { id: 'user-1' };
  });

  it('loads referral stats for the current user on mount', async () => {
    mockedApiGet.mockResolvedValue({
      code: 'ABCD2345',
      share_url: 'https://chiffreo.fr/register?ref=ABCD2345',
      referred_count: 3,
      converted_count: 1,
      months_offered: 1,
    });

    const { result } = renderHook(() => useReferrals());

    await waitFor(() => {
      expect(result.current.data?.code).toBe('ABCD2345');
    });
    expect(mockedApiGet).toHaveBeenCalledWith('/referrals/me');
    expect(result.current.error).toBe('');
  });

  it('exposes an error message when the request fails', async () => {
    mockedApiGet.mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useReferrals());

    await waitFor(() => {
      expect(result.current.error).not.toBe('');
    });
    expect(result.current.data).toBeNull();
  });

  it('does not fetch when there is no authenticated user', async () => {
    mockAuth.appUser = null;

    renderHook(() => useReferrals());

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockedApiGet).not.toHaveBeenCalled();
  });
});
