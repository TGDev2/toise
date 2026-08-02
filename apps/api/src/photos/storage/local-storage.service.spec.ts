import { ConfigService } from '@nestjs/config';
import { existsSync, readdirSync, readFileSync } from 'fs';
import * as fsPromises from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { LocalStorageService } from './local-storage.service';

// `fs/promises` expose des propriétés non redéfinissables : `jest.spyOn` y
// échoue, il faut remplacer le module. Tout reste réel sauf `writeFile`, la
// seule opération que ces tests ont besoin d'observer.
jest.mock('fs/promises', () => {
  const actual =
    jest.requireActual<typeof import('fs/promises')>('fs/promises');
  return { ...actual, writeFile: jest.fn(actual.writeFile) };
});

const reelles = jest.requireActual<typeof import('fs/promises')>('fs/promises');
const writeFileMock = fsPromises.writeFile as jest.MockedFunction<
  typeof fsPromises.writeFile
>;

/**
 * Constat 2.15 — le volume `uploads` a deux lecteurs qui ne peuvent pas
 * distinguer un fichier en cours d'écriture d'un fichier complet : le service
 * CV, monté en lecture seule dessus, et le `tar` de la sauvegarde nocturne.
 * `writeFile` au chemin final exposait donc des fichiers tronqués — archivés
 * tels quels, puis restaurés sans que rien ne le signale.
 */
describe('LocalStorageService', () => {
  let basePath: string;
  let service: LocalStorageService;

  const config = (path: string) =>
    ({ get: () => path }) as unknown as ConfigService;

  beforeEach(async () => {
    writeFileMock.mockReset();
    writeFileMock.mockImplementation(reelles.writeFile);
    basePath = await reelles.mkdtemp(join(tmpdir(), 'chiffreo-uploads-'));
    service = new LocalStorageService(config(basePath));
  });

  afterEach(async () => {
    await reelles.rm(basePath, { recursive: true, force: true });
  });

  it('écrit le contenu complet au chemin annoncé', async () => {
    const stored = await service.save(
      Buffer.from('photo'),
      'a/b.jpg',
      'image/jpeg',
    );

    expect(stored).toBe('a/b.jpg');
    expect(readFileSync(join(basePath, 'a/b.jpg'), 'utf8')).toBe('photo');
  });

  it("n'expose jamais le chemin final tant que l'écriture n'est pas finie", async () => {
    const final = join(basePath, 'salon.jpg');
    const observed = { finalExists: true, partials: [] as string[] };

    // Rend l'écriture observable : au moment précis où les octets sont posés
    // sur le disque, le chemin final ne doit rien contenir.
    writeFileMock.mockImplementation(async (...args) => {
      await reelles.writeFile(...args);
      observed.finalExists = existsSync(final);
      observed.partials = readdirSync(basePath).filter((f) =>
        f.endsWith('.part'),
      );
    });

    await service.save(Buffer.from('des octets'), 'salon.jpg', 'image/jpeg');

    expect(observed.finalExists).toBe(false);
    expect(observed.partials).toHaveLength(1);
    // Et une fois `rename` passé, le fichier est là, entier, sans résidu.
    expect(readFileSync(final, 'utf8')).toBe('des octets');
    expect(readdirSync(basePath)).toEqual(['salon.jpg']);
  });

  it('ne laisse aucun temporaire derrière lui quand la sauvegarde échoue', async () => {
    writeFileMock.mockRejectedValue(new Error('disque plein'));

    await expect(
      service.save(Buffer.from('x'), 'salon.jpg', 'image/jpeg'),
    ).rejects.toThrow('disque plein');

    expect(readdirSync(basePath)).toEqual([]);
  });

  it('supprime un fichier existant et tolère son absence', async () => {
    await service.save(Buffer.from('x'), 'salon.jpg', 'image/jpeg');

    await service.delete('salon.jpg');
    expect(existsSync(join(basePath, 'salon.jpg'))).toBe(false);

    await expect(service.delete('salon.jpg')).resolves.toBeUndefined();
  });
});
