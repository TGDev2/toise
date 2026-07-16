'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getErrorMessage } from '@/lib/errors';
import { Alert, Button, Input } from '@/components/ui';
import { OAuthButtons } from './OAuthButtons';

export function LoginForm() {
  const { login, loginWithGoogle, loginWithApple, startGuestSession } =
    useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Échec de la connexion'));
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: () => Promise<void>) => {
    setError('');
    setLoading(true);
    try {
      await provider();
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Échec de la connexion'));
    } finally {
      setLoading(false);
    }
  };

  const handleGuestStart = async () => {
    setLoading(true);
    try {
      await startGuestSession();
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de démarrer en mode invité'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6 rounded-[2rem] border border-stone-200 bg-white p-8 shadow-[0_25px_80px_rgba(67,39,15,0.10)]">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-stone-950">Connexion</h1>
        <p className="mt-2 text-sm text-stone-600">
          Accédez à vos projets EstiMate
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <OAuthButtons
        onGoogle={() => handleOAuth(loginWithGoogle)}
        onApple={() => handleOAuth(loginWithApple)}
        disabled={loading}
      />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-stone-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white px-2 text-stone-500">ou</span>
        </div>
      </div>

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

        <div>
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-stone-700"
            >
              Mot de passe
            </label>
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-strong)]"
            >
              Mot de passe oublié ?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 w-full rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
          />
        </div>

        <Button type="submit" loading={loading} className="w-full">
          Se connecter
        </Button>
      </form>

      <div className="space-y-3 text-center text-sm">
        <p className="text-stone-600">
          Pas encore de compte ?{' '}
          <Link
            href="/register"
            className="font-medium text-[var(--accent)] hover:text-[var(--accent-strong)]"
          >
            Créer un compte
          </Link>
        </p>
        <button
          type="button"
          onClick={handleGuestStart}
          disabled={loading}
          className="text-stone-500 underline hover:text-stone-700"
        >
          Continuer en invité
        </button>
      </div>
    </div>
  );
}
