import { render, screen } from '@testing-library/react';
import { PhotoUploadPanel } from '../PhotoUploadPanel';
import type { PhotoEntry } from '@/hooks/usePhotoUpload';

const noop = () => {};

const mockReadyPhoto: PhotoEntry = {
  localId: 'photo-1',
  file: null,
  previewUrl: null,
  progress: 100,
  status: 'ready',
  error: null,
  serverPhoto: {
    id: 'server-1',
    original_filename: 'room.jpg',
    mime_type: 'image/jpeg',
    size_bytes: 1024000,
    status: 'ready',
    sort_order: 0,
    url: '/photos/file/proj/server-1',
    thumbnail_url: '/photos/file/proj/server-1/thumbnail',
    created_at: '2026-03-29T00:00:00Z',
  },
  retryCount: 0,
};

const mockUploadingPhoto: PhotoEntry = {
  localId: 'photo-2',
  file: new File(['data'], 'test.jpg', { type: 'image/jpeg' }),
  previewUrl: 'blob:test',
  progress: 45,
  status: 'uploading',
  error: null,
  serverPhoto: null,
  retryCount: 0,
};

const mockErrorPhoto: PhotoEntry = {
  localId: 'photo-3',
  file: new File(['data'], 'bad.bmp', { type: 'image/bmp' }),
  previewUrl: null,
  progress: 0,
  status: 'error',
  error: 'Format non supporte. Formats acceptes : JPEG, PNG, HEIC',
  serverPhoto: null,
  retryCount: 1,
};

describe('PhotoUploadPanel', () => {
  it('renders title and instructions', () => {
    render(
      <PhotoUploadPanel
        photos={[]}
        canAddMore={true}
        readyCount={0}
        maxPhotos={5}
        onFiles={noop}
        onRemove={noop}
        onRetry={noop}
      />,
    );

    expect(screen.getByText('Photos de la pièce')).toBeInTheDocument();
    expect(screen.getByText(/Photographiez les coins opposés/)).toBeInTheDocument();
  });

  it('shows photo count', () => {
    render(
      <PhotoUploadPanel
        photos={[mockReadyPhoto]}
        canAddMore={true}
        readyCount={1}
        maxPhotos={5}
        onFiles={noop}
        onRemove={noop}
        onRetry={noop}
      />,
    );

    expect(screen.getByText('1/5 photo')).toBeInTheDocument();
  });

  it('shows maximum reached when canAddMore is false', () => {
    render(
      <PhotoUploadPanel
        photos={[mockReadyPhoto]}
        canAddMore={false}
        readyCount={5}
        maxPhotos={5}
        onFiles={noop}
        onRemove={noop}
        onRetry={noop}
      />,
    );

    expect(screen.getByText('Nombre maximum atteint')).toBeInTheDocument();
  });

  it('renders photo items', () => {
    render(
      <PhotoUploadPanel
        photos={[mockReadyPhoto, mockUploadingPhoto, mockErrorPhoto]}
        canAddMore={true}
        readyCount={1}
        maxPhotos={5}
        onFiles={noop}
        onRemove={noop}
        onRetry={noop}
      />,
    );

    expect(screen.getByText('room.jpg')).toBeInTheDocument();
    expect(screen.getByText('test.jpg')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
  });

  it('renders error messages', () => {
    render(
      <PhotoUploadPanel
        photos={[mockErrorPhoto]}
        canAddMore={true}
        readyCount={0}
        maxPhotos={5}
        onFiles={noop}
        onRemove={noop}
        onRetry={noop}
      />,
    );

    expect(
      screen.getByText('Format non supporte. Formats acceptes : JPEG, PNG, HEIC'),
    ).toBeInTheDocument();
    expect(screen.getByText('Réessayer')).toBeInTheDocument();
  });

  it('hides dropzone when canAddMore is false', () => {
    render(
      <PhotoUploadPanel
        photos={[mockReadyPhoto]}
        canAddMore={false}
        readyCount={5}
        maxPhotos={5}
        onFiles={noop}
        onRemove={noop}
        onRetry={noop}
      />,
    );

    expect(
      screen.queryByText('Prendre ou ajouter des photos'),
    ).not.toBeInTheDocument();
  });
});
