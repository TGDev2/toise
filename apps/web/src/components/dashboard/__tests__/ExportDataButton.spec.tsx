import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportDataButton } from '../ExportDataButton';
import { apiDownload, apiGet, apiPost } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  apiPost: jest.fn(),
  apiGet: jest.fn(),
  apiDownload: jest.fn(),
}));

const mockApiPost = apiPost as jest.MockedFunction<typeof apiPost>;
const mockApiGet = apiGet as jest.MockedFunction<typeof apiGet>;
const mockApiDownload = apiDownload as jest.MockedFunction<typeof apiDownload>;

describe('ExportDataButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("démarre l'export, attend qu'il soit prêt puis déclenche le téléchargement", async () => {
    const user = userEvent.setup({ delay: null });
    mockApiPost.mockResolvedValue({ id: 'req-1', status: 'pending' } as never);
    mockApiGet.mockResolvedValueOnce({
      id: 'req-1',
      status: 'ready',
    } as never);
    mockApiDownload.mockResolvedValue(undefined);

    render(<ExportDataButton />);

    await user.click(screen.getByRole('button', { name: 'Télécharger mes données' }));

    await waitFor(() =>
      expect(mockApiPost).toHaveBeenCalledWith('/auth/me/export', {}),
    );
    expect(
      screen.getByText(/Préparation de votre archive/i),
    ).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/auth/me/export/req-1'));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Télécharger l'archive/i }),
      ).toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: /Télécharger l'archive/i }));

    await waitFor(() =>
      expect(mockApiDownload).toHaveBeenCalledWith(
        '/auth/me/export/req-1/download',
        expect.stringMatching(/^chiffreo-export-\d{4}-\d{2}-\d{2}\.zip$/),
      ),
    );
  });

  it("affiche l'erreur quand la génération échoue", async () => {
    const user = userEvent.setup({ delay: null });
    mockApiPost.mockResolvedValue({
      id: 'req-2',
      status: 'failed',
      error_message: 'volume indisponible',
    } as never);

    render(<ExportDataButton />);

    await user.click(screen.getByRole('button', { name: 'Télécharger mes données' }));

    await waitFor(() =>
      expect(screen.getByText('volume indisponible')).toBeInTheDocument(),
    );
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('arrête le sondage à la fermeture de la modale', async () => {
    const user = userEvent.setup({ delay: null });
    mockApiPost.mockResolvedValue({ id: 'req-3', status: 'pending' } as never);
    mockApiGet.mockResolvedValue({ id: 'req-3', status: 'processing' } as never);

    render(<ExportDataButton />);
    await user.click(screen.getByRole('button', { name: 'Télécharger mes données' }));
    await waitFor(() => expect(mockApiPost).toHaveBeenCalled());

    // Deux boutons portent le nom accessible « Fermer » : la croix générique
    // de `Modal` et le bouton du pied de la fenêtre — les deux déclenchent le
    // même `handleClose`, on prend le second (le bouton explicite).
    const closeButtons = screen.getAllByRole('button', { name: 'Fermer' });
    await user.click(closeButtons[closeButtons.length - 1]);
    mockApiGet.mockClear();

    await act(async () => {
      jest.advanceTimersByTime(10_000);
      await Promise.resolve();
    });

    expect(mockApiGet).not.toHaveBeenCalled();
  });
});
