import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';
import { FeatureGateProvider } from '@/contexts/FeatureGateContext';
import { PaywallModal } from '@/components/paywall/PaywallModal';
import { CookieConsent } from '@/components/CookieConsent';
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { ToastProvider } from '@/components/ui/Toast';
import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Toisé — Estimation de matériaux de rénovation',
    template: '%s | Toisé',
  },
  description:
    'Calculez une base de commande de matériaux à partir de la géométrie réelle de vos pièces et de ratios sourcés, à valider avant d\'acheter.',
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: 'Toisé',
    title: 'Toisé — Estimation de matériaux de rénovation',
    description:
      'Mesurez votre pièce, sélectionnez vos travaux, obtenez une liste d\'achats chiffrée et sourcée, à valider avant d\'acheter.',
  },
};

// PRO-5 : `viewportFit: 'cover'` est le prérequis technique des barres d'action
// collantes du tunnel — sans lui `env(safe-area-inset-*)` vaut 0 et le CTA passe
// sous la barre home des iPhone à encoche. `themeColor` réaligne la barre de
// statut sur `manifest.ts`, qui déclarait déjà cette couleur de son côté.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#1d6b57',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          <AuthProvider>
            <FeatureGateProvider>
              {children}
              <PaywallModal />
              <CookieConsent />
              <InstallPrompt />
              <ServiceWorkerRegister />
            </FeatureGateProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
