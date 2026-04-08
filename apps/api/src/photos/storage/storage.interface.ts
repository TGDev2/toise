export interface StorageProvider {
  save(buffer: Buffer, filename: string, mimetype: string): Promise<string>;

  delete(storedPath: string): Promise<void>;

  getAbsolutePath(storedPath: string): string;
}

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';
