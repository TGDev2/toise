import {
  SHARE_TOKEN_TTL_DAYS,
  isShareTokenExpired,
  shareTokenExpiry,
} from './share-token';

const DAY_MS = 24 * 60 * 60 * 1000;

function listAgedDays(days: number) {
  return {
    share_token: 'a'.repeat(64),
    share_token_created_at: new Date(Date.now() - days * DAY_MS),
  };
}

describe('expiration du lien de partage', () => {
  it('laisse vivre un lien récent', () => {
    expect(isShareTokenExpired(listAgedDays(1))).toBe(false);
    expect(isShareTokenExpired(listAgedDays(SHARE_TOKEN_TTL_DAYS - 1))).toBe(
      false,
    );
  });

  it('ferme un lien au-delà de la durée de vie', () => {
    expect(isShareTokenExpired(listAgedDays(SHARE_TOKEN_TTL_DAYS + 1))).toBe(
      true,
    );
    // Le cas du constat : un lien archivé dans un fil de discussion, deux ans
    // plus tard. Il exposait encore `real_unit_price` et `store_name`.
    expect(isShareTokenExpired(listAgedDays(730))).toBe(true);
  });

  it('traite un jeton sans date d’émission comme expiré', () => {
    expect(
      isShareTokenExpired({
        share_token: 'a'.repeat(64),
        share_token_created_at: null,
      }),
    ).toBe(true);
  });

  it('considère l’absence de jeton comme rien à servir', () => {
    expect(
      isShareTokenExpired({ share_token: null, share_token_created_at: null }),
    ).toBe(true);
    expect(
      shareTokenExpiry({ share_token: null, share_token_created_at: null }),
    ).toBeNull();
  });

  it('calcule une péremption à TTL jours de l’émission', () => {
    const created = new Date('2026-01-01T00:00:00.000Z');
    const expiry = shareTokenExpiry({
      share_token: 'a'.repeat(64),
      share_token_created_at: created,
    });

    expect(expiry?.getTime()).toBe(
      created.getTime() + SHARE_TOKEN_TTL_DAYS * DAY_MS,
    );
  });
});
