import { PATH_METADATA } from '@nestjs/common/constants';
import { PhotosController } from './photos.controller';
import { ProjectPhoto } from './entities/project-photo.entity';

/**
 * Le DTO annonce au navigateur l'URL qu'il devra appeler. Rien ne la reliait aux
 * routes servies : elle disait `/photos/file/...` quand le serveur écoutait sur
 * `/projects/.../file`, et aucun test ne pouvait le voir.
 *
 * Ces tests lisent les métadonnées de route **posées par Nest** et les comparent
 * à l'URL sérialisée. Un renommage de route qui oublierait le DTO — ou
 * l'inverse — tombe ici.
 */

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const PHOTO_ID = '22222222-2222-4222-8222-222222222222';

function routePath(handlerName: keyof PhotosController): string {
  const handler = PhotosController.prototype[handlerName] as () => unknown;
  return Reflect.getMetadata(PATH_METADATA, handler) as string;
}

function controllerPrefix(): string {
  return Reflect.getMetadata(PATH_METADATA, PhotosController) as string;
}

/** L'URL absolue réellement servie, reconstruite depuis les métadonnées Nest. */
function servedUrl(handlerName: keyof PhotosController): string {
  return `/${controllerPrefix()}/${routePath(handlerName)}`
    .replace(':projectId', PROJECT_ID)
    .replace(':photoId', PHOTO_ID);
}

function makePhoto(overrides: Partial<ProjectPhoto> = {}): ProjectPhoto {
  return {
    id: PHOTO_ID,
    project_id: PROJECT_ID,
    original_filename: 'salon.jpg',
    mime_type: 'image/jpeg',
    size_bytes: 1024,
    status: 'ready',
    sort_order: 0,
    thumbnail_url: 'project/thumb_abc.jpg',
    created_at: new Date('2026-08-02T00:00:00.000Z'),
    ...overrides,
  } as ProjectPhoto;
}

/** `toDto` est privée : on l'atteint comme le fait le contrôleur lui-même. */
function toDto(photo: ProjectPhoto) {
  return (
    PhotosController.prototype as unknown as {
      toDto: (p: ProjectPhoto) => {
        url: string;
        thumbnail_url: string | null;
      };
    }
  ).toDto(photo);
}

describe('PhotosController — contrat d’URL', () => {
  it('sérialise exactement la route servie pour le fichier', () => {
    expect(toDto(makePhoto()).url).toBe(servedUrl('servePhoto'));
  });

  it('sérialise exactement la route servie pour la miniature', () => {
    expect(toDto(makePhoto()).thumbnail_url).toBe(servedUrl('serveThumbnail'));
  });

  it('publie des URL sous le préfixe du contrôleur, pas une racine inventée', () => {
    const dto = toDto(makePhoto());

    expect(dto.url.startsWith('/projects/')).toBe(true);
    expect(dto.thumbnail_url!.startsWith('/projects/')).toBe(true);
  });

  it('n’annonce pas de miniature quand aucune n’a été produite', () => {
    expect(toDto(makePhoto({ thumbnail_url: null })).thumbnail_url).toBeNull();
  });
});
