import { getFirebaseAuth } from './firebase';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export class ApiError extends Error {
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

function throwApiError(error: Record<string, unknown>, status: number): never {
  const message = (error.message as string) ?? `HTTP ${status}`;
  const code = (error.error as string) ?? null;
  throw new ApiError(message, code, error);
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const user = typeof window !== 'undefined' ? getFirebaseAuth().currentUser : null;
  if (!user) return { 'Content-Type': 'application/json' };

  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }));
    throwApiError(error, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function apiGet<T>(path: string): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, { headers });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }));
    throwApiError(error, res.status);
  }

  return res.json();
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }));
    throwApiError(error, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PATCH',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }));
    throwApiError(error, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function apiUpload<T>(
  path: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<T> {
  const user = typeof window !== 'undefined' ? getFirebaseAuth().currentUser : null;
  const token = user ? await user.getIdToken() : null;

  const formData = new FormData();
  formData.append('file', file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}${path}`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        let error: Record<string, unknown>;
        try {
          error = JSON.parse(xhr.responseText) as Record<string, unknown>;
        } catch {
          error = { message: `HTTP ${xhr.status}` };
        }
        try {
          throwApiError(error, xhr.status);
        } catch (err) {
          reject(err as Error);
        }
      }
    };

    xhr.onerror = () => reject(new ApiError('Erreur réseau', 'NETWORK_ERROR'));
    xhr.send(formData);
  });
}

export async function apiDownload(path: string, filename: string): Promise<void> {
  const user = typeof window !== 'undefined' ? getFirebaseAuth().currentUser : null;
  const headers: HeadersInit = {};
  if (user) {
    const token = await user.getIdToken();
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { headers });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Download failed' }));
    throwApiError(error, res.status);
  }

  triggerBlobDownload(await res.blob(), filename);
}

/**
 * Récupère une ressource protégée et la publie comme `blob:` URL utilisable par
 * une balise `<img>` (PHOTO-*).
 *
 * Une balise image n'envoie jamais d'en-tête `Authorization` : poser une URL
 * d'API privée dans son `src` donne un 401, quoi qu'on écrive dans le chemin.
 * L'alternative — une URL signée côté serveur — demanderait un secret, une
 * expiration et une exemption de guard, soit une nouvelle surface d'attaque pour
 * un problème d'affichage. Ici on réutilise le chemin d'authentification déjà en
 * place (cf. `apiDownload`), et le `Cache-Control: private` posé par l'API
 * continue de jouer puisque `fetch` passe par le cache HTTP.
 *
 * **L'appelant est responsable du `URL.revokeObjectURL`** : sans quoi le blob
 * reste en mémoire jusqu'au rechargement de la page.
 */
export async function apiObjectUrl(path: string): Promise<string> {
  const user =
    typeof window !== 'undefined' ? getFirebaseAuth().currentUser : null;
  const headers: HeadersInit = {};
  if (user) {
    headers['Authorization'] = `Bearer ${await user.getIdToken()}`;
  }

  const res = await fetch(`${API_URL}${path}`, { headers });

  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ message: 'Ressource indisponible' }));
    throwApiError(error, res.status);
  }

  return URL.createObjectURL(await res.blob());
}

/** Résultat d'`apiShareOrDownload`, pour que l'appelant adapte son message. */
export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

/**
 * Envoie un document via la feuille de partage native, sinon le télécharge
 * (PRO-5).
 *
 * `apiDownload` dépose un blob dans « Téléchargements » : sur un téléphone, chez
 * le client, ça n'est pas « le devis envoyé avant de partir » — il faut ensuite
 * ouvrir une app mail, retrouver le fichier, le joindre. La Web Share API passe
 * le PDF directement à WhatsApp, Mail ou SMS en une étape.
 *
 * Repli en cascade, jamais d'impasse : navigateur sans `canShare({ files })`
 * (Firefox, tous les navigateurs desktop) → téléchargement. Un `AbortError` est
 * en revanche un choix de l'utilisateur (feuille de partage fermée) et ne doit
 * PAS déclencher un téléchargement qu'il n'a pas demandé.
 */
export async function apiShareOrDownload(
  path: string,
  filename: string,
  share: { title: string; text?: string },
): Promise<ShareOutcome> {
  const headers: HeadersInit = {};
  const user = typeof window !== 'undefined' ? getFirebaseAuth().currentUser : null;
  if (user) {
    headers['Authorization'] = `Bearer ${await user.getIdToken()}`;
  }

  const res = await fetch(`${API_URL}${path}`, { headers });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Download failed' }));
    throwApiError(error, res.status);
  }

  const blob = await res.blob();
  const file = new File([blob], filename, { type: 'application/pdf' });

  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file], ...share });
      return 'shared';
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return 'cancelled';
      // Toute autre erreur (NotAllowedError quand le geste utilisateur a
      // expiré pendant le téléchargement, par exemple) retombe sur le
      // téléchargement plutôt que de laisser l'artisan sans document.
    }
  }

  triggerBlobDownload(blob, filename);
  return 'downloaded';
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function apiDelete(path: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    method: 'DELETE',
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }));
    throwApiError(error, res.status);
  }
}
