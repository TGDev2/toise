// Consentement analytics : source unique de vérité.
//
// Il vivait dans `CookieConsent.tsx`, qui n'en faisait rien d'autre que masquer
// son propre bandeau — aucun émetteur ne lisait la valeur. « Refuser » écrivait
// donc `declined` dans `localStorage` pendant que la télémétrie continuait de
// partir, rattachée à un `user_id` dès qu'une session existait.
//
// Le contrat tient en une phrase, et `isAnalyticsAllowed()` est le seul endroit
// où il s'énonce :
//
//   Rien ne part sur le réseau et rien ne se persiste tant que le consentement
//   ne vaut pas `accepted`.
//
// Pas de tampon « en attente de choix » : empiler des événements dans
// `localStorage` avant le choix, ce serait déjà déposer de la télémétrie sur
// l'appareil. Un choix non exprimé se traite donc comme un refus, à ceci près
// qu'il reste révocable dans l'autre sens — d'où `subscribeToConsent`, qui
// permet de compter la session dès l'acceptation plutôt que de l'avoir perdue.

export const CONSENT_KEY = 'chiffreo_cookie_consent';
export const CONSENT_EVENT = 'chiffreo-cookie-consent-change';

export type ConsentValue = 'accepted' | 'declined';

export function readConsent(): ConsentValue | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    return raw === 'accepted' || raw === 'declined' ? raw : null;
  } catch {
    // Stockage refusé (navigation privée, cookies tiers bloqués) : aucun
    // consentement n'est prouvable, donc aucune télémétrie.
    return null;
  }
}

/** Le choix a-t-il été exprimé ? Sert à l'affichage des bandeaux, pas à l'émission. */
export function hasChosenConsent(): boolean {
  return readConsent() !== null;
}

/** Le seul prédicat que doivent consulter les émetteurs de télémétrie. */
export function isAnalyticsAllowed(): boolean {
  return readConsent() === 'accepted';
}

export function setConsent(value: ConsentValue): void {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // Sans persistance, le bandeau réapparaîtra : mieux que de laisser croire
    // à un choix enregistré.
  }
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

/**
 * Notifie à chaque changement de consentement, y compris depuis un autre onglet
 * (`storage`). Retourne une fonction de désinscription.
 */
export function subscribeToConsent(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  window.addEventListener('storage', onChange);
  window.addEventListener(CONSENT_EVENT, onChange);

  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CONSENT_EVENT, onChange);
  };
}
