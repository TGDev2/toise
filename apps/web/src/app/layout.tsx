import type { Metadata } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';
import { CookieConsent } from '@/components/CookieConsent';
import './globals.css';

export const metadata: Metadata = {
  title: 'EstiMate - Estimation materiaux renovation',
  description:
    'Estimez precisement vos materiaux de renovation grace a la vision par ordinateur et des calculs intelligents.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          {children}
          <CookieConsent />
        </AuthProvider>
      </body>
    </html>
  );
}
