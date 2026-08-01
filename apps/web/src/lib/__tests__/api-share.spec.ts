import { apiShareOrDownload } from '../api';

jest.mock('../firebase', () => ({
  getFirebaseAuth: () => ({ currentUser: null }),
}));

const PDF = new Blob(['%PDF-1.4'], { type: 'application/pdf' });

function mockFetchOk() {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    blob: () => Promise.resolve(PDF),
  }) as unknown as typeof fetch;
}

describe('apiShareOrDownload', () => {
  let clickSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchOk();
    // jsdom n'implémente ni createObjectURL ni le téléchargement d'ancre.
    URL.createObjectURL = jest.fn(() => 'blob:devis');
    URL.revokeObjectURL = jest.fn();
    clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    clickSpy.mockRestore();
    delete (navigator as { canShare?: unknown }).canShare;
    delete (navigator as { share?: unknown }).share;
  });

  it('shares the file natively when the browser supports it', async () => {
    const share = jest.fn().mockResolvedValue(undefined);
    (navigator as { canShare?: unknown }).canShare = () => true;
    (navigator as { share?: unknown }).share = share;

    const outcome = await apiShareOrDownload('/quotes/1/export/pdf', 'devis.pdf', {
      title: 'Devis D-2026-001',
    });

    expect(outcome).toBe('shared');
    expect(share).toHaveBeenCalledTimes(1);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('falls back to a download when file sharing is unavailable', async () => {
    // Cas des navigateurs desktop et de Firefox : pas de `canShare`.
    const outcome = await apiShareOrDownload('/quotes/1/export/pdf', 'devis.pdf', {
      title: 'Devis D-2026-001',
    });

    expect(outcome).toBe('downloaded');
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('does not download behind the user when the share sheet is dismissed', async () => {
    // Fermer la feuille de partage est un choix : déclencher un téléchargement
    // qu'on n'a pas demandé serait le contraire de ce que l'utilisateur a fait.
    const abort = Object.assign(new Error('cancelled'), { name: 'AbortError' });
    (navigator as { canShare?: unknown }).canShare = () => true;
    (navigator as { share?: unknown }).share = jest.fn().mockRejectedValue(abort);

    const outcome = await apiShareOrDownload('/quotes/1/export/pdf', 'devis.pdf', {
      title: 'Devis D-2026-001',
    });

    expect(outcome).toBe('cancelled');
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('still delivers the PDF when sharing fails for another reason', async () => {
    const notAllowed = Object.assign(new Error('gesture expired'), {
      name: 'NotAllowedError',
    });
    (navigator as { canShare?: unknown }).canShare = () => true;
    (navigator as { share?: unknown }).share = jest
      .fn()
      .mockRejectedValue(notAllowed);

    const outcome = await apiShareOrDownload('/quotes/1/export/pdf', 'devis.pdf', {
      title: 'Devis D-2026-001',
    });

    expect(outcome).toBe('downloaded');
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});
