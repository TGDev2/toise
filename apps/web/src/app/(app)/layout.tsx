import { PaymentIssueBanner } from '@/components/subscription/PaymentIssueBanner';

/**
 * Chrome de l'espace authentifié.
 *
 * Le bandeau d'impayé vit ici et non dans le layout racine : celui-ci couvre
 * aussi la vitrine (`/pricing`, `/artisans`, les calculateurs publics) et
 * l'administration, où un bandeau de facturation n'a rien à faire — et où
 * `useSubscription` déclencherait un appel API sur des pages publiques.
 */
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <PaymentIssueBanner />
      {children}
    </>
  );
}
