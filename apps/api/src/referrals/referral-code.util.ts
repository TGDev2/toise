import { randomInt } from 'crypto';

/**
 * Alphabet sans caractères visuellement ambigus (0/O, 1/I/L) : un code de
 * parrainage se partage à l'oral ou sur un écran non retouché.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

export function generateReferralCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}
