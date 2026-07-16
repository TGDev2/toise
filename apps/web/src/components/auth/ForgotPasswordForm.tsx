'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getErrorMessage } from '@/lib/errors';
import { Alert, Button, Input } from '@/components/ui';

export function ForgotPasswordForm() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Une erreur est survenue'));
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="w-full max-w-md space-y-4 text-center">
        <div className="rounded-[2rem] border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-6">
          <h2 className="text-lg font-semibold text-[var(--accent-strong)]">
            Email envoyé
          </h2>
          <p className="mt-2 text-sm text-stone-700">
            Si un compte existe avec l&apos;adresse <strong>{email}</strong>,
            vous recevrez un lien de réinitialisation valide pendant 1 heure.
          </p>
        </div>
        <Link
          href="/login"
          className="text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-strong)]"
        >
          Retour à la connexion
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-6 rounded-[2rem] border border-stone-200 bg-white p-8 shadow-[0_25px_80px_rgba(67,39,15,0.10)]">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-stone-950">
          Mot de passe oublié
        </h1>
        <p className="mt-2 text-sm text-stone-600">
          Entrez votre email pour recevoir un lien de réinitialisation
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="email"
          type="email"
          label="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vous@exemple.com"
        />

        <Button type="submit" loading={loading} className="w-full">
          Envoyer le lien
        </Button>
      </form>

      <p className="text-center text-sm text-stone-600">
        <Link
          href="/login"
          className="font-medium text-[var(--accent)] hover:text-[var(--accent-strong)]"
        >
          Retour à la connexion
        </Link>
      </p>
    </div>
  );
}
