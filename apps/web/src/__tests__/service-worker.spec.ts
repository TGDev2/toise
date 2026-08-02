/**
 * Isolation par compte du cache offline (`public/sw.js`).
 *
 * Le service worker est du JS nu, non importable : il est chargé ici dans un
 * contexte `vm` muni de doublures minimales (`caches`, `fetch`, `Request`),
 * puis piloté par les événements que le navigateur lui enverrait.
 *
 * Ce que ces tests tiennent : sur un appareil partagé, un compte ne doit
 * jamais lire hors ligne une réponse mise en cache par un autre — y compris
 * quand personne ne s'est déconnecté entre les deux, ce qui est le cas
 * nominal (on se reconnecte, on ne se déconnecte pas).
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createContext, runInContext } from 'vm';

const SW_PATH = join(__dirname, '..', '..', 'public', 'sw.js');
const APP_ORIGIN = 'https://chiffreo.fr';
const API_ORIGIN = 'https://api.chiffreo.fr';

type Listener = (event: FakeEvent) => void;

interface FakeEvent {
  request?: FakeRequest;
  respondWith: (response: Promise<FakeResponse>) => void;
  waitUntil: (task: Promise<unknown>) => void;
}

interface FakeResponse {
  ok: boolean;
  body: string;
  clone: () => FakeResponse;
}

interface FakeRequest {
  url: string;
  method: string;
  mode: string;
  headers: { get: (name: string) => string | null };
}

function jwtFor(uid: string): string {
  const payload = Buffer.from(JSON.stringify({ user_id: uid, sub: uid })).toString(
    'base64url',
  );
  return `header.${payload}.signature`;
}

function makeRequest(
  url: string,
  { uid, mode = 'cors' }: { uid?: string; mode?: string } = {},
): FakeRequest {
  const headers = new Map<string, string>();
  if (uid) headers.set('authorization', `Bearer ${jwtFor(uid)}`);
  return {
    url,
    method: 'GET',
    mode,
    headers: { get: (name) => headers.get(name.toLowerCase()) ?? null },
  };
}

function makeResponse(body: string): FakeResponse {
  const response: FakeResponse = {
    ok: true,
    body,
    clone: () => makeResponse(body),
  };
  return response;
}

class FakeCache {
  readonly entries = new Map<string, FakeResponse>();

  private key(request: FakeRequest | string): string {
    return typeof request === 'string' ? request : request.url;
  }

  async put(request: FakeRequest, response: FakeResponse): Promise<void> {
    this.entries.set(this.key(request), response);
  }

  async match(request: FakeRequest | string): Promise<FakeResponse | undefined> {
    return this.entries.get(this.key(request));
  }

  async keys(): Promise<string[]> {
    return [...this.entries.keys()];
  }

  async delete(request: FakeRequest | string): Promise<boolean> {
    return this.entries.delete(this.key(request));
  }

  async addAll(): Promise<void> {}
}

class FakeCacheStorage {
  readonly named = new Map<string, FakeCache>();

  async open(name: string): Promise<FakeCache> {
    const existing = this.named.get(name);
    if (existing) return existing;
    const created = new FakeCache();
    this.named.set(name, created);
    return created;
  }

  async keys(): Promise<string[]> {
    return [...this.named.keys()];
  }

  async delete(name: string): Promise<boolean> {
    return this.named.delete(name);
  }

  async match(url: string): Promise<FakeResponse | undefined> {
    for (const cache of this.named.values()) {
      const hit = await cache.match(url);
      if (hit) return hit;
    }
    return undefined;
  }
}

function loadServiceWorker() {
  const listeners = new Map<string, Listener>();
  const caches = new FakeCacheStorage();
  const network = jest.fn<Promise<FakeResponse>, [FakeRequest]>();

  const self = {
    addEventListener: (type: string, listener: Listener) => {
      listeners.set(type, listener);
    },
    location: { origin: APP_ORIGIN },
    clients: { claim: async () => undefined, matchAll: async () => [] },
  };

  const sandbox = {
    self,
    caches,
    fetch: network,
    URL,
    atob: (value: string) => Buffer.from(value, 'base64').toString('binary'),
    console,
  };
  runInContext(readFileSync(SW_PATH, 'utf8'), createContext(sandbox));

  /** Rejoue un `fetch` intercepté. `undefined` = requête non interceptée. */
  const handleFetch = (
    request: FakeRequest,
  ): Promise<FakeResponse> | undefined => {
    let responded: Promise<FakeResponse> | undefined;
    listeners.get('fetch')?.({
      request,
      respondWith: (value) => {
        responded = value;
      },
      waitUntil: (task) => task,
    });
    return responded;
  };

  return { caches, network, handleFetch };
}

describe('service worker — isolation du cache par compte', () => {
  const PROJECT_URL = `${API_ORIGIN}/api/v1/projects/project-de-a`;

  it("ne ressert pas hors ligne la réponse d'un compte à un autre", async () => {
    const { network, handleFetch } = loadServiceWorker();

    // A consulte son projet en ligne : la réponse entre en cache.
    network.mockResolvedValueOnce(makeResponse('projet de A'));
    const online = await handleFetch(makeRequest(PROJECT_URL, { uid: 'uid-a' }));
    expect(online?.body).toBe('projet de A');

    // B se connecte sur le même navigateur sans que A se soit déconnecté,
    // puis le réseau tombe et B rouvre l'URL de A.
    network.mockRejectedValue(new Error('offline'));
    const offlineForB = handleFetch(makeRequest(PROJECT_URL, { uid: 'uid-b' }));

    if (offlineForB === undefined) return; // requête non interceptée : rien ne fuit
    await expect(offlineForB).rejects.toThrow();
  });

  it('ressert bien hors ligne la réponse du compte qui l’a mise en cache', async () => {
    const { network, handleFetch } = loadServiceWorker();

    network.mockResolvedValueOnce(makeResponse('projet de A'));
    await handleFetch(makeRequest(PROJECT_URL, { uid: 'uid-a' }));

    network.mockRejectedValue(new Error('offline'));
    const offlineForA = await handleFetch(
      makeRequest(PROJECT_URL, { uid: 'uid-a' }),
    );

    expect(offlineForA?.body).toBe('projet de A');
  });

  it("n'écrit rien en cache pour une requête sans jeton attribuable", async () => {
    const { caches, network, handleFetch } = loadServiceWorker();

    network.mockResolvedValueOnce(makeResponse('projet anonyme'));
    const responded = handleFetch(makeRequest(PROJECT_URL));
    if (responded) await responded;

    const cached = await caches.match(PROJECT_URL);
    expect(cached).toBeUndefined();
  });

  it('laisse passer les requêtes same-origin sans les mettre en cache', async () => {
    const { handleFetch } = loadServiceWorker();

    const responded = handleFetch(
      makeRequest(`${APP_ORIGIN}/projects/project-de-a`),
    );

    expect(responded).toBeUndefined();
  });
});
