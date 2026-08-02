import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdir, rename, unlink, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { StorageProvider } from './storage.interface';

@Injectable()
export class LocalStorageService implements StorageProvider {
  private readonly basePath: string;

  constructor(private readonly configService: ConfigService) {
    this.basePath = this.configService.get<string>(
      'storage.localPath',
      './uploads',
    );
  }

  /**
   * Écrit la photo de façon atomique : fichier temporaire dans le même
   * répertoire, puis `rename`.
   *
   * `writeFile` directement au chemin final rendait le fichier visible et
   * tronqué pendant toute la durée de l'écriture. Deux lecteurs partagent ce
   * volume et n'ont aucun moyen de distinguer un fichier en cours d'écriture
   * d'un fichier complet : le service CV (monté en lecture seule sur le même
   * volume) et le `tar` de la sauvegarde nocturne, qui en archivait alors une
   * copie partielle — restaurée telle quelle, sans que rien ne le signale.
   *
   * `rename` dans le même système de fichiers est atomique : le chemin final
   * n'existe jamais qu'entier. Un crash entre les deux laisse un `.part`
   * orphelin, qu'aucune ligne de la base ne référence.
   */
  async save(
    buffer: Buffer,
    filename: string,
    _mimetype: string,
  ): Promise<string> {
    const filePath = join(this.basePath, filename);
    const dir = dirname(filePath);
    await mkdir(dir, { recursive: true });

    const tmpPath = `${filePath}.${randomUUID()}.part`;
    try {
      await writeFile(tmpPath, buffer);
      await rename(tmpPath, filePath);
    } catch (err: unknown) {
      await unlink(tmpPath).catch(() => undefined);
      throw err;
    }

    return filename;
  }

  async delete(storedPath: string): Promise<void> {
    const filePath = join(this.basePath, storedPath);
    try {
      await unlink(filePath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
  }

  getAbsolutePath(storedPath: string): string {
    return join(this.basePath, storedPath);
  }
}
