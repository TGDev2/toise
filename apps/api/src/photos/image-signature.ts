/**
 * Reconnaissance du format d'une image par ses octets d'en-tête.
 *
 * **Ce que ceci n'est pas.** Ce n'est pas la validation du type stocké :
 * `PhotosService.uploadPhoto` décode déjà le fichier avec `sharp` et enregistre
 * `metadata.format`, pas l'en-tête `Content-Type` du client. Le type servi plus
 * tard par `GET .../file` est donc un type constaté, pas un type déclaré.
 *
 * **Ce que ceci est.** Une barrière *devant* le décodeur. `sharp` s'appuie sur
 * libvips, c'est-à-dire sur des parseurs natifs (libjpeg, libpng, libheif) —
 * exactement la classe de code qu'on ne veut pas exposer à une suite d'octets
 * arbitraire venue d'Internet. Le filtre multer, lui, ne lit que l'en-tête
 * `Content-Type` de la partie multipart, que le client écrit librement : il ne
 * garantit rien sur le contenu. Entre les deux il manquait une vérification qui
 * coûte quelques octets et referme le cas « ce n'est pas une image du tout ».
 *
 * La reconnaissance reste volontairement grossière — un en-tête plausible ne
 * prouve pas un fichier bien formé. C'est `sharp` qui tranche ensuite ; ici on
 * se contente d'écarter ce qui n'a jamais prétendu être une image.
 */
export type DetectedImageFormat = 'jpeg' | 'png' | 'heif';

/** ISO-BMFF : `....ftyp<brand>`. Marques couvrant HEIC/HEIF et leurs variantes. */
const HEIF_BRANDS = new Set([
  'heic',
  'heix',
  'heim',
  'heis',
  'hevc',
  'hevx',
  'hevm',
  'hevs',
  'mif1',
  'msf1',
]);

function isJpeg(buffer: Buffer): boolean {
  // SOI + début d'un marqueur : 0xFF 0xD8 0xFF
  return (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  );
}

function isPng(buffer: Buffer): boolean {
  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG);
}

function isHeif(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  if (buffer.subarray(4, 8).toString('latin1') !== 'ftyp') return false;
  return HEIF_BRANDS.has(buffer.subarray(8, 12).toString('latin1'));
}

/** Format reconnu, ou `null` si les octets n'annoncent aucune image acceptée. */
export function detectImageFormat(buffer: Buffer): DetectedImageFormat | null {
  if (isJpeg(buffer)) return 'jpeg';
  if (isPng(buffer)) return 'png';
  if (isHeif(buffer)) return 'heif';
  return null;
}
