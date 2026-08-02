'use client';

import { useEffect } from 'react';
import {
  flushPwaEvents,
  registerPwaEventFlush,
  trackPwaEvent,
} from '@/lib/pwa-analytics';

// Une seule mesure de session par onglet : `sessionStorage` survit aux navigations
// internes mais pas à la fermeture, ce qui correspond à la définition de session
// qu'on veut compter.
const SESSION_KEY = 'chiffreo_pwa_session_tracked';

function detectPlatform(): 'ios' | 'android' | 'desktop' {
  const ua = navigator.userAgent;
  // iPadOS 13+ s'annonce comme un Mac : on le distingue par la présence du tactile,
  // sinon toute une population iOS serait comptée en desktop.
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

// La mesure d'une session ne doit jamais empêcher l'app de fonctionner :
// `sessionStorage` lève quand le stockage est bloqué (navigation privée, cookies
// tiers refusés). Sans cette garde, une exception ici priverait l'utilisateur du
// service worker — on sacrifie la mesure, jamais la fonctionnalité.
function trackSessionOnce(): void {
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    return;
  }

  // `install_eligible` vaut false sur iOS, où `beforeinstallprompt` n'existe
  // pas : c'est ce qui permet de distinguer « n'a pas voulu installer » de
  // « n'a jamais pu se voir proposer l'installation ».
  trackPwaEvent('pwa_session_start', {
    display_mode: isStandalone() ? 'standalone' : 'browser',
    platform: detectPlatform(),
    install_eligible: 'onbeforeinstallprompt' in window,
  });
}

export function ServiceWorkerRegister() {
  useEffect(() => {
    // L'enregistrement passe en premier : c'est la fonctionnalité, le reste n'est
    // que de l'instrumentation.
    const hasServiceWorker = 'serviceWorker' in navigator;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'offline-view') {
        trackPwaEvent('pwa_offline_view', { url: event.data.url });
      }
    };

    if (hasServiceWorker) {
      navigator.serviceWorker.addEventListener('message', onMessage);
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error("Échec de l'enregistrement du service worker :", err);
      });
    }

    // Le flush précède la nouvelle session : des événements peuvent dater d'une
    // session hors ligne précédente.
    void flushPwaEvents();
    const unregisterFlush = registerPwaEventFlush();
    trackSessionOnce();

    return () => {
      unregisterFlush();
      if (hasServiceWorker) {
        navigator.serviceWorker.removeEventListener('message', onMessage);
      }
    };
  }, []);

  return null;
}
