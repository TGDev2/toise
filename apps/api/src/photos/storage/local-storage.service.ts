import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  mkdir,
  readdir,
  rename,
  rm,
  stat,
  unlink,
  writeFile,
} from 'fs/promises';
import { isAbsolute, join, dirname, relative } from 'path';
import { StoredFile, StorageProvider } from './storage.interface';

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

  async listPrefix(prefix: string): Promise<StoredFile[]> {
    return this.inventory(this.resolveWithinBase(prefix), prefix);
  }

  /**
   * Recense d'abord, efface ensuite : le journal de purge doit dire ce qui est
   * parti, or `rm -r` ne rend rien. L'inventaire est fait sur l'arborescence
   * réelle, pas sur les chemins connus en base — c'est précisément ce que cette
   * méthode apporte.
   */
  async deletePrefix(prefix: string): Promise<StoredFile[]> {
    const root = this.resolveWithinBase(prefix);

    const deleted = await this.inventory(root, prefix);
    await rm(root, { recursive: true, force: true });
    return deleted;
  }

  getAbsolutePath(storedPath: string): string {
    return join(this.basePath, storedPath);
  }

  /**
   * `rm -r` sur un chemin composé à partir d'une entrée extérieure est la seule
   * opération de ce service qui puisse détruire autre chose que ce qu'on vise.
   * Le préfixe est un identifiant de projet, donc jamais vide, jamais absolu et
   * sans remontée — on l'exige plutôt que de l'espérer.
   */
  private resolveWithinBase(prefix: string): string {
    if (!prefix || isAbsolute(prefix)) {
      throw new Error(`Préfixe de stockage invalide : "${prefix}"`);
    }

    const target = join(this.basePath, prefix);
    const inside = relative(this.basePath, target);
    if (inside === '' || inside.startsWith('..') || isAbsolute(inside)) {
      throw new Error(`Préfixe de stockage invalide : "${prefix}"`);
    }

    return target;
  }

  /** Fichiers sous `absolute`, chemins rendus relatifs à la base comme `storage_url`. */
  private async inventory(
    absolute: string,
    storedPrefix: string,
  ): Promise<StoredFile[]> {
    let entries;
    try {
      entries = await readdir(absolute, { withFileTypes: true });
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;
      // Absent : rien à recenser, et la purge reste rejouable.
      if (code === 'ENOENT') return [];
      // Le préfixe désigne un fichier et non un répertoire : cas non produit par
      // le service, mais `rm` l'effacerait — le journal doit le dire.
      if (code === 'ENOTDIR') {
        const { size } = await stat(absolute);
        return [{ path: storedPrefix, bytes: size }];
      }
      throw err;
    }

    const files: StoredFile[] = [];
    for (const entry of entries) {
      const storedPath = `${storedPrefix}/${entry.name}`;
      if (entry.isDirectory()) {
        files.push(
          ...(await this.inventory(join(absolute, entry.name), storedPath)),
        );
        continue;
      }
      const { size } = await stat(join(absolute, entry.name));
      files.push({ path: storedPath, bytes: size });
    }
    return files;
  }
}
