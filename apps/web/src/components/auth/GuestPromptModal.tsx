'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getErrorMessage } from '@/lib/errors';
import { Alert, Button, Input, Modal } from '@/components/ui';
import { OAuthButtons } from './OAuthButtons';

interface GuestPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function GuestPromptModal({
  isOpen,
  onClose,
  onSuccess,
}: GuestPromptModalProps) {
  const { convertGuestAccount, convertGuestWithGoogle, convertGuestWithApple } =
    useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    setLoading(true);
    try {
      await convertGuestAccount(email, password);
      onSuccess();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Échec de l'inscription"));
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: () => Promise<void>) => {
    setError('');
    setLoading(true);
    try {
      await provider();
      onSuccess();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Échec de l'inscription"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Créez un compte pour sauvegarder"
    >
      <p className="text-sm text-stone-600">
        Vos données de projet seront conservées après inscription.
      </p>

      {error && (
        <Alert variant="error" className="mt-3">
          {error}
        </Alert>
      )}

      <div className="mt-4">
        <OAuthButtons
          onGoogle={() => handleOAuth(convertGuestWithGoogle)}
          onApple={() => handleOAuth(convertGuestWithApple)}
          disabled={loading}
        />
      </div>

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-stone-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white px-2 text-stone-500">ou</span>
        </div>
      </div>

      <form onSubmit={handleEmailRegister} className="space-y-3">
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          aria-label="Email"
        />
        <Input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe (8+ caractères)"
          aria-label="Mot de passe"
        />
        <Input
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirmer le mot de passe"
          aria-label="Confirmer le mot de passe"
        />
        <Button type="submit" loading={loading} className="w-full">
          S&apos;inscrire et sauvegarder
        </Button>
      </form>

      <p className="mt-4 text-center text-xs leading-6 text-stone-500">
        En vous inscrivant, vous acceptez notre{' '}
        <Link
          href="/privacy"
          className="font-medium text-[var(--accent)] hover:text-[var(--accent-strong)]"
        >
          politique de confidentialité
        </Link>
        .
      </p>
    </Modal>
  );
}
