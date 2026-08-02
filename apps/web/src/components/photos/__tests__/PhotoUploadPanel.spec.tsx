import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PhotoUploadPanel } from '../PhotoUploadPanel';
import { apiObjectUrl } from '@/lib/api';
import type { PhotoEntry } from '@/hooks/usePhotoUpload';

jest.mock('@/lib/api', () => ({ apiObjectUrl: jest.fn() }));

const mockedObjectUrl = apiObjectUrl as jest.MockedFunction<typeof apiObjectUrl>;

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
    // Les chemins réellement servis par l'API : `/projects/...`, pas la racine
    // `/photos/file/...` qui n'a jamais existé côté serveur.
    url: '/projects/proj/photos/server-1/file',
    thumbnail_url: '/projects/proj/photos/server-1/thumbnail',
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
  beforeEach(() => {
    jest.clearAllMocks();
    mockedObjectUrl.mockResolvedValue('blob:thumb');
  });

  // Après un rechargement, `previewUrl` est nul : la miniature ne peut venir que
  // du serveur, derrière le guard. Un `src` direct y récoltait un 401 — d'où le
  // passage par un fetch porteur du jeton.
  it('charge la miniature d’une photo serveur par un appel authentifié', async () => {
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

    expect(mockedObjectUrl).toHaveBeenCalledWith(
      '/projects/proj/photos/server-1/thumbnail',
    );
    await waitFor(() =>
      expect(screen.getByAltText('room.jpg')).toHaveAttribute(
        'src',
        'blob:thumb',
      ),
    );
  });

  it('affiche l’aperçu local sans rien demander au serveur', () => {
    render(
      <PhotoUploadPanel
        photos={[mockUploadingPhoto]}
        canAddMore={true}
        readyCount={0}
        maxPhotos={5}
        onFiles={noop}
        onRemove={noop}
        onRetry={noop}
      />,
    );

    expect(mockedObjectUrl).not.toHaveBeenCalled();
    expect(screen.getByAltText('test.jpg')).toHaveAttribute('src', 'blob:test');
  });

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
      screen.queryByRole('button', { name: 'Prendre une photo' }),
    ).not.toBeInTheDocument();
  });

  it('gates the dropzone behind the capture guidance screen when there are no photos yet (BACKLOG CV-4)', () => {
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

    expect(screen.getByText('Avant de commencer')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Prendre une photo' }),
    ).not.toBeInTheDocument();
  });

  it('reveals the dropzone after the capture guidance is acknowledged', () => {
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

    fireEvent.click(
      screen.getByRole('button', { name: /Compris, commencer/i }),
    );

    expect(screen.queryByText('Avant de commencer')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Prendre une photo' }),
    ).toBeInTheDocument();
  });

  // PRO-5 : `capture="environment"` sur l'unique input forçait l'appareil photo
  // et supprimait l'accès à la photothèque. Un artisan ayant déjà photographié
  // la pièce devait tout refaire sur place.
  it('offers the photo library alongside the camera (PRO-5)', () => {
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

    fireEvent.click(
      screen.getByRole('button', { name: /Compris, commencer/i }),
    );

    expect(
      screen.getByRole('button', { name: 'Choisir dans la galerie' }),
    ).toBeInTheDocument();
  });
});
