import { render, screen, waitFor } from '@testing-library/react';
import { AuthenticatedImage } from '../AuthenticatedImage';
import { apiObjectUrl } from '@/lib/api';

jest.mock('@/lib/api', () => ({ apiObjectUrl: jest.fn() }));

const mockedObjectUrl = apiObjectUrl as jest.MockedFunction<typeof apiObjectUrl>;

describe('AuthenticatedImage', () => {
  let revoke: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    revoke = jest
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined);
  });

  afterEach(() => revoke.mockRestore());

  // Le cœur du correctif : une balise `<img>` n'envoie pas de Bearer, donc la
  // photo doit être récupérée par un appel authentifié avant d'être affichée.
  it('récupère la ressource par un appel authentifié et l’affiche', async () => {
    mockedObjectUrl.mockResolvedValue('blob:photo-1');

    render(<AuthenticatedImage path="/projects/p1/photos/x/thumbnail" alt="Salon" />);

    expect(mockedObjectUrl).toHaveBeenCalledWith(
      '/projects/p1/photos/x/thumbnail',
    );
    await waitFor(() =>
      expect(screen.getByAltText('Salon')).toHaveAttribute('src', 'blob:photo-1'),
    );
  });

  it('affiche le repli tant que la ressource n’est pas là, et si elle échoue', async () => {
    mockedObjectUrl.mockRejectedValue(new Error('401'));

    render(
      <AuthenticatedImage
        path="/projects/p1/photos/x/file"
        alt="Salon"
        fallback={<span>indisponible</span>}
      />,
    );

    expect(screen.getByText('indisponible')).toBeInTheDocument();
    await waitFor(() => expect(mockedObjectUrl).toHaveBeenCalled());
    expect(screen.queryByAltText('Salon')).not.toBeInTheDocument();
  });

  it('révoque l’object URL au démontage', async () => {
    mockedObjectUrl.mockResolvedValue('blob:photo-1');

    const { unmount } = render(
      <AuthenticatedImage path="/projects/p1/photos/x/file" alt="Salon" />,
    );
    await waitFor(() => expect(screen.getByAltText('Salon')).toBeInTheDocument());

    unmount();

    expect(revoke).toHaveBeenCalledWith('blob:photo-1');
  });

  // Sans cette garde, une grille de photos peint la miniature du voisin au
  // hasard des latences réseau.
  it('ignore et révoque une réponse arrivée après un changement de source', async () => {
    let resolveFirst: (url: string) => void = () => {};
    mockedObjectUrl.mockImplementationOnce(
      () => new Promise<string>((resolve) => (resolveFirst = resolve)),
    );
    mockedObjectUrl.mockResolvedValueOnce('blob:second');

    const { rerender } = render(
      <AuthenticatedImage path="/projects/p1/photos/a/file" alt="Photo" />,
    );
    rerender(<AuthenticatedImage path="/projects/p1/photos/b/file" alt="Photo" />);

    await waitFor(() =>
      expect(screen.getByAltText('Photo')).toHaveAttribute('src', 'blob:second'),
    );

    resolveFirst('blob:first');
    await waitFor(() => expect(revoke).toHaveBeenCalledWith('blob:first'));
    expect(screen.getByAltText('Photo')).toHaveAttribute('src', 'blob:second');
  });
});
