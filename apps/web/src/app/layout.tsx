import type { Metadata } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';
import { FeatureGateProvider } from '@/contexts/FeatureGateContext';
import { PaywallModal } from '@/components/paywall/PaywallModal';
import { CookieConsent } from '@/components/CookieConsent';
import { ToastProvider } from '@/components/ui/Toast';
import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Chiffréo — Estimation de matériaux de rénovation',
    template: '%s | Chiffréo',
  },
  description:
    'Estimez précisément vos matériaux de rénovation grâce à la vision par ordinateur et des calculs intelligents.',
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: 'Chiffréo',
    title: 'Chiffréo — Estimation de matériaux de rénovation',
    description:
      'Scannez votre pièce, sélectionnez vos travaux, obtenez une liste d\'achat précise.',
  },
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
            </FeatureGateProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
