import { renderHook, act, waitFor } from '@testing-library/react';
import { usePhotoUpload } from '../usePhotoUpload';
import { apiUpload, ApiError } from '@/lib/api';

jest.mock('@/lib/api', () => {
  class MockApiError extends Error {
    code: string | null;
    details: Record<string, unknown>;
    constructor(
      message: string,
      code: string | null = null,
      details: Record<string, unknown> = {},
    ) {
      super(message);
      this.name = 'ApiError';
      this.code = code;
      this.details = details;
    }
  }
  return {
    apiUpload: jest.fn(),
    apiDelete: jest.fn(),
    ApiError: MockApiError,
  };
});

jest.mock('browser-image-compression', () => ({
  __esModule: true,
  default: jest.fn((file: File) => Promise.resolve(file)),
}));

const mockedApiUpload = apiUpload as jest.MockedFunction<typeof apiUpload>;

function makeFile(name = 'photo.jpg') {
  return new File(['data'], name, { type: 'image/jpeg' });
}

describe('usePhotoUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.URL.createObjectURL = jest.fn(() => 'blob:mock');
    global.URL.revokeObjectURL = jest.fn();
  });

  it('fails immediately without retrying on a deterministic 400 rejection (BACKLOG CV-4)', async () => {
    mockedApiUpload.mockRejectedValue(
      new ApiError('Photo trop floue.', 'Bad Request', {
        statusCode: 400,
        message: 'Photo trop floue.',
        error: 'Bad Request',
      }),
    );

    const { result } = renderHook(() => usePhotoUpload('project-1'));

    act(() => {
      result.current.addFiles([makeFile()]);
    });

    await waitFor(() => {
      expect(result.current.photos[0]?.status).toBe('error');
    });

    expect(mockedApiUpload).toHaveBeenCalledTimes(1);
    expect(result.current.photos[0].error).toBe('Photo trop floue.');
  });

  it('retries up to MAX_RETRIES on a network error', async () => {
    mockedApiUpload.mockRejectedValue(
      new ApiError('Erreur réseau', 'NETWORK_ERROR'),
    );

    const { result } = renderHook(() => usePhotoUpload('project-1'));

    act(() => {
      result.current.addFiles([makeFile()]);
    });

    await waitFor(() => {
      expect(result.current.photos[0]?.status).toBe('error');
    });

    expect(mockedApiUpload).toHaveBeenCalledTimes(3);
  });

  it('retries on a transient 5xx server error', async () => {
    mockedApiUpload.mockRejectedValue(
      new ApiError('Internal server error', null, {
        statusCode: 500,
        message: 'Internal server error',
      }),
    );

    const { result } = renderHook(() => usePhotoUpload('project-1'));

    act(() => {
      result.current.addFiles([makeFile()]);
    });

    await waitFor(() => {
      expect(result.current.photos[0]?.status).toBe('error');
    });

    expect(mockedApiUpload).toHaveBeenCalledTimes(3);
  });

  it('marks the photo ready on a successful upload', async () => {
    mockedApiUpload.mockResolvedValue({
      id: 'server-1',
      original_filename: 'photo.jpg',
      mime_type: 'image/jpeg',
      size_bytes: 4,
      status: 'ready',
      sort_order: 0,
      url: '/photos/file/proj/server-1',
      thumbnail_url: null,
      created_at: '2026-07-22T00:00:00Z',
    });

    const { result } = renderHook(() => usePhotoUpload('project-1'));

    act(() => {
      result.current.addFiles([makeFile()]);
    });

    await waitFor(() => {
      expect(result.current.photos[0]?.status).toBe('ready');
    });

    expect(mockedApiUpload).toHaveBeenCalledTimes(1);
  });
});
