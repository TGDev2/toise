/** Un fichier du volume, tel qu'il part au journal de purge. */
export interface StoredFile {
  path: string;
  bytes: number;
}

export interface StorageProvider {
  save(buffer: Buffer, filename: string, mimetype: string): Promise<string>;

  delete(storedPath: string): Promise<void>;

  /**
   * Recense ce qui vit sous `prefix`, sans rien effacer.
   *
   * Existe pour que le mode simulation de la purge annonce **exactement** ce
   * qu'un vrai passage effacerait : un décompte reconstitué depuis les lignes
   * `project_photos` manquerait précisément ce que `deletePrefix` apporte — les
   * fichiers qu'aucune ligne ne référence.
   */
  listPrefix(prefix: string): Promise<StoredFile[]>;

  /**
   * Efface tout ce qui vit sous `prefix` et rend la liste de ce qui est parti.
   *
   * Les photos d'un projet sont toutes rangées sous `<projectId>/`
   * (`PhotosService.uploadPhoto` et `generateThumbnail`), ce qui rend l'effacement
   * par préfixe strictement plus complet que l'effacement des chemins connus en
   * base : il emporte aussi ce qu'aucune ligne ne référence — les `.part`
   * orphelins qu'un crash entre `writeFile` et `rename` laisse derrière lui, et
   * les vignettes dont la mise à jour de `thumbnail_url` a échoué.
   *
   * **Idempotent** : un préfixe absent n'est pas une erreur. C'est ce qui rend la
   * purge rejouable après une panne.
   */
  deletePrefix(prefix: string): Promise<StoredFile[]>;

  getAbsolutePath(storedPath: string): string;
}

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';
