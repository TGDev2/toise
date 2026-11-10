import { ApiError, apiPost } from './api';
import { isAnalyticsAllowed, subscribeToConsent } from './analytics-consent';

// Télémétrie d'adoption PWA (MOB-1), préalable à l'arbitrage MOB-2.
//
// Tout ce qui suit est subordonné à `isAnalyticsAllowed()` : sans consentement
// accordé, rien n'est envoyé et rien n'est écrit dans `localStorage`. Le tampon
// ci-dessous n'existe qu'à l'intérieur du périmètre consenti.
//
// Pourquoi ne pas réutiliser `useAnalytics` : son `track` est un
// `apiPost(...).catch(() => {})`, l'événement est perdu en silence en cas
// d'échec réseau. Or ces événements-ci se déclenchent exactement quand le réseau
// est le plus mauvais — en mode standalone, hors ligne, sur mobile. Les envoyer
// sans tampon biaiserait toutes les métriques vers zéro pour précisément la
// population qu'on cherche à mesurer : un utilisateur installé consultant hors
// ligne serait indiscernable d'un utilisateur absent. Le tampon n'est pas un
// confort, c'est une condition de justesse de la mesure.

const QUEUE_KEY = 'toise_pwa_events';

// File volontairement bornée : au-delà, on abandonne les plus anciens plutôt que
// de laisser `localStorage` croître sans limite sur un appareil durablement hors
// ligne. Un échantillon tronqué reste exploitable, un quota saturé casserait le
// reste de l'app (projets locaux, consentement).
const MAX_QUEUED_EVENTS = 50;

export type PwaEventName =
  | 'pwa_session_start'
  | 'pwa_install_prompted'
  | 'pwa_install_accepted'
  | 'pwa_install_dismissed'
  | 'pwa_installed'
  | 'pwa_offline_view';

interface QueuedEvent {
  event_name: PwaEventName;
  properties: Record<string, unknown>;
}

let flushing = false;

function readQueue(): QueuedEvent[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedEvent[]) : [];
  } catch {
    // JSON corrompu ou `localStorage` indisponible (mode privé, quota) : on
    // repart d'une file vide plutôt que de propager l'erreur à l'appelant.
    return [];
  }
}

function writeQueue(events: QueuedEvent[]): void {
  try {
    if (events.length === 0) {
      localStorage.removeItem(QUEUE_KEY);
      return;
    }
    localStorage.setItem(QUEUE_KEY, JSON.stringify(events));
  } catch {
    // Quota dépassé ou stockage refusé : la télémétrie ne doit jamais faire
    // échouer le parcours utilisateur.
  }
}

function enqueue(event: QueuedEvent): void {
  const queue = readQueue();
  queue.push(event);
  writeQueue(queue.slice(-MAX_QUEUED_EVENTS));
}

// Un échec déterministe (400 : nom d'événement hors allow-list) ne doit pas être
// réessayé, sinon la file ne se vide jamais. Seuls le réseau et les 5xx le
// justifient — même distinction que `isRetryableUploadError` dans usePhotoUpload.
function isRetryable(err: unknown): boolean {
  if (!(err instanceof ApiError)) return true;
  if (err.code === 'NETWORK_ERROR') return true;
  const status = err.details.statusCode;
  return typeof status !== 'number' || status >= 500;
}

async function send(event: QueuedEvent): Promise<boolean> {
  try {
    await apiPost('/public/analytics/events', {
      event_name: event.event_name,
      properties: event.properties,
    });
    return true;
  } catch (err) {
    if (!isRetryable(err)) return true; // abandon définitif : ne pas ré-empiler
    return false;
  }
}

/**
 * Vide la file, dans l'ordre d'émission. S'arrête au premier échec réessayable
 * pour ne pas marteler un réseau absent et préserver la chronologie.
 *
 * Sans consentement accordé, la file est **purgée** au lieu d'être envoyée :
 * elle peut dater d'une session où le consentement l'était, et la laisser
 * dormir sur l'appareil reviendrait à conserver la télémétrie qu'on vient de
 * refuser. C'est aussi ce qui donne son effet immédiat au bouton « Refuser ».
 */
export async function flushPwaEvents(): Promise<void> {
  if (flushing || typeof window === 'undefined') return;
  if (!isAnalyticsAllowed()) {
    writeQueue([]);
    return;
  }
  flushing = true;
  try {
    let queue = readQueue();
    while (queue.length > 0) {
      const delivered = await send(queue[0]);
      if (!delivered) break;
      queue = queue.slice(1);
      writeQueue(queue);
    }
  } finally {
    flushing = false;
  }
}

/**
 * Émet un événement PWA. `occurred_at` est figé à l'émission : un événement
 * rejoué au retour du réseau doit rester daté du moment où il s'est produit, pas
 * de celui où il a fini par partir.
 */
export function trackPwaEvent(
  eventName: PwaEventName,
  properties: Record<string, unknown> = {},
): void {
  if (typeof window === 'undefined') return;
  // Avant toute chose : ni envoi, ni écriture. Empiler « en attendant le choix »
  // serait déjà déposer de la télémétrie sur l'appareil.
  if (!isAnalyticsAllowed()) return;

  const event: QueuedEvent = {
    event_name: eventName,
    properties: { ...properties, occurred_at: new Date().toISOString() },
  };

  // Hors ligne : inutile de tenter, on empile directement.
  if (navigator.onLine === false) {
    enqueue(event);
    return;
  }

  void send(event).then((delivered) => {
    if (!delivered) enqueue(event);
  });
}

/**
 * Réconcilie la file avec la réalité au retour du réseau **et** à chaque
 * changement de consentement : `flushPwaEvents` envoie si le consentement est
 * accordé, purge sinon. Retourne une fonction de désinscription.
 */
export function registerPwaEventFlush(): () => void {
  const reconcile = () => {
    void flushPwaEvents();
  };
  window.addEventListener('online', reconcile);
  const unsubscribeConsent = subscribeToConsent(reconcile);
  return () => {
    window.removeEventListener('online', reconcile);
    unsubscribeConsent();
  };
}
