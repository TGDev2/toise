'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiGet } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { Alert, Button, Input } from '@/components/ui';

interface SsoDiscovery {
  provider_id: string;
  protocol: 'saml' | 'oidc';
}

/**
 * Connexion SSO d'entreprise (BACKLOG PLAT-6).
 *
 * Flux SP-initiated en deux temps : l'adresse professionnelle sert à découvrir
 * le fournisseur (`GET /sso/discover`), puis la fenêtre Firebase prend le relais.
 * L'identifiant de fournisseur n'est jamais saisi par l'utilisateur — il est émis
 * par l'API au moment où le fournisseur est créé.
 *
 * Le panneau est replié par défaut : la très grande majorité des comptes se
 * connectent par mot de passe ou par Google, et l'ouvrir d'emblée ferait payer
 * une étape supplémentaire à tout le monde pour une minorité d'entreprises.
 */
export function SsoLoginForm() {
  const { loginWithSso } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const discovery = await apiGet<SsoDiscovery>(
        `/sso/discover?email=${encodeURIComponent(email)}`,
      );
      await loginWithSso(discovery.provider_id);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(
        getErrorMessage(
          err,
          "Aucune connexion d'entreprise n'est configurée pour ce domaine.",
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-center text-sm text-stone-500 underline hover:text-stone-700"
      >
        Utiliser le SSO de mon entreprise
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <Alert variant="error">{error}</Alert>}

      <Input
        id="sso-email"
        type="email"
        label="Email professionnel"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="vous@votre-entreprise.com"
      />

      <Button type="submit" loading={loading} variant="secondary" className="w-full">
        Continuer avec le SSO
      </Button>
    </form>
  );
}
