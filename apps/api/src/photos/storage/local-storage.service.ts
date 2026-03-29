import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, unlink } from 'fs/promises';
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

  async save(
    buffer: Buffer,
    filename: string,
    _mimetype: string,
  ): Promise<string> {
    const filePath = join(this.basePath, filename);
    const dir = dirname(filePath);
    await mkdir(dir, { recursive: true });

    const { writeFile } = await import('fs/promises');
    await writeFile(filePath, buffer);

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
