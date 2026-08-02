import { detectImageFormat } from './image-signature';

function withHeader(bytes: number[], size = 64): Buffer {
  const buffer = Buffer.alloc(size);
  Buffer.from(bytes).copy(buffer);
  return buffer;
}

function ftyp(brand: string): Buffer {
  const buffer = Buffer.alloc(64);
  buffer.writeUInt32BE(32, 0); // taille de boite, sans importance ici
  buffer.write('ftyp', 4, 'latin1');
  buffer.write(brand, 8, 'latin1');
  return buffer;
}

describe('detectImageFormat', () => {
  it('reconnaît un JPEG', () => {
    expect(detectImageFormat(withHeader([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      'jpeg',
    );
  });

  it('reconnaît un PNG', () => {
    expect(
      detectImageFormat(
        withHeader([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe('png');
  });

  it('reconnaît les marques HEIF courantes', () => {
    for (const brand of ['heic', 'heix', 'mif1', 'msf1', 'hevc']) {
      expect(detectImageFormat(ftyp(brand))).toBe('heif');
    }
  });

  it('rejette un exécutable, un script et du HTML déguisés en image', () => {
    // Ce sont les charges que le filtre multer laissait passer : il ne lit que
    // le Content-Type annoncé par le client, jamais les octets.
    expect(detectImageFormat(Buffer.from('MZ\x90\x00', 'latin1'))).toBeNull();
    expect(
      detectImageFormat(Buffer.from('<script>alert(1)</script>')),
    ).toBeNull();
    expect(detectImageFormat(Buffer.from('%PDF-1.7'))).toBeNull();
    expect(detectImageFormat(Buffer.from('GIF89a'))).toBeNull();
  });

  it('rejette un ISO-BMFF dont la marque n’est pas une image HEIF', () => {
    expect(detectImageFormat(ftyp('mp42'))).toBeNull();
    expect(detectImageFormat(ftyp('qt  '))).toBeNull();
  });

  it('rejette un tampon trop court pour porter une signature', () => {
    expect(detectImageFormat(Buffer.alloc(0))).toBeNull();
    expect(detectImageFormat(Buffer.from([0xff, 0xd8]))).toBeNull();
    expect(detectImageFormat(Buffer.from([0x89, 0x50, 0x4e]))).toBeNull();
  });
});
