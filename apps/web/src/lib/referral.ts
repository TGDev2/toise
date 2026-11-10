/** Clé localStorage portant un code de parrainage capturé via `?ref=` en
 * attendant que l'utilisateur ait un compte pour le rédimer (COM-3). */
export const REFERRAL_CODE_STORAGE_KEY = 'toise_referral_code';

export function captureReferralCodeFromUrl(): void {
  if (typeof window === 'undefined') return;
  const ref = new URLSearchParams(window.location.search).get('ref');
  if (ref) {
    localStorage.setItem(REFERRAL_CODE_STORAGE_KEY, ref);
  }
}
