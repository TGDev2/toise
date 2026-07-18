'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth, type CompanyProfilePayload } from '@/contexts/AuthContext';
import { getErrorMessage } from '@/lib/errors';
import { Alert, Button, Input } from '@/components/ui';
import { OAuthButtons } from './OAuthButtons';

const SPECIALTIES = [
  'Peinture',
  'Carrelage',
  'Parquet',
  'Cloison',
  'Plomberie',
  'Électricité',
  'Maçonnerie',
  'Menuiserie',
  'Isolation',
  'Toiture',
];

function getPasswordStrength(password: string): {
  label: string;
  color: string;
  width: string;
} {
  if (password.length < 8) {
    return { label: 'Trop court', color: 'bg-red-500', width: 'w-1/4' };
  }

  let score = 0;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) {
    return { label: 'Faible', color: 'bg-red-500', width: 'w-1/4' };
  }
  if (score === 2) {
    return { label: 'Moyen', color: 'bg-yellow-500', width: 'w-2/4' };
  }
  if (score === 3) {
    return { label: 'Bon', color: 'bg-[var(--accent)]', width: 'w-3/4' };
  }

  return { label: 'Fort', color: 'bg-green-500', width: 'w-full' };
}

type AccountType = 'particulier' | 'professionnel';

export function RegisterForm() {
  const { register, loginWithGoogle, loginWithApple } = useAuth();
  const router = useRouter();
  const [accountType, setAccountType] = useState<AccountType>('particulier');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Company profile fields
  const [raisonSociale, setRaisonSociale] = useState('');
  const [siret, setSiret] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);

  const strength = getPasswordStrength(password);

  const toggleSpecialty = (s: string) => {
    setSpecialties((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
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

    if (accountType === 'professionnel') {
      if (!raisonSociale.trim()) {
        setError('La raison sociale est obligatoire');
        return;
      }
      if (!/^\d{14}$/.test(siret)) {
        setError('Le SIRET doit contenir exactement 14 chiffres');
        return;
      }
      if (!addressLine1.trim() || !postalCode.trim() || !city.trim()) {
        setError("L'adresse complète est obligatoire");
        return;
      }
    }

    setLoading(true);
    try {
      let companyProfile: CompanyProfilePayload | undefined;
      if (accountType === 'professionnel') {
        companyProfile = {
          raison_sociale: raisonSociale,
          siret,
          address_line1: addressLine1,
          ...(addressLine2 ? { address_line2: addressLine2 } : {}),
          postal_code: postalCode,
          city,
          ...(phone ? { phone } : {}),
          ...(specialties.length > 0 ? { specialties } : {}),
        };
      }
      await register(email, password, undefined, companyProfile);
      setSuccess(true);
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
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Échec de l'inscription"));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="w-full max-w-md space-y-4 text-center">
        <div className="rounded-[2rem] border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-6">
          <h2 className="text-lg font-semibold text-[var(--accent-strong)]">
            Vérifiez votre email
          </h2>
          <p className="mt-2 text-sm text-stone-700">
            Un email de confirmation a été envoyé à <strong>{email}</strong>.
            Cliquez sur le lien pour activer votre compte.
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
        <h1 className="text-2xl font-bold text-stone-950">Créer un compte</h1>
        <p className="mt-2 text-sm text-stone-600">
          Commencez à estimer vos matériaux
        </p>
      </div>

      {/* Account type toggle */}
      <div className="flex rounded-full border border-stone-300 p-1">
        <button
          type="button"
          onClick={() => setAccountType('particulier')}
          className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
            accountType === 'particulier'
              ? 'bg-[var(--accent)] text-white'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          Particulier
        </button>
        <button
          type="button"
          onClick={() => setAccountType('professionnel')}
          className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
            accountType === 'professionnel'
              ? 'bg-[var(--accent)] text-white'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          Professionnel
        </button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {accountType === 'particulier' && (
        <>
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
        </>
      )}

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
          <Input
            id="password"
            type="password"
            label="Mot de passe"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8 caractères minimum"
          />
          {password.length > 0 && (
            <div className="mt-2">
              <div className="h-1.5 w-full rounded-full bg-stone-200">
                <div
                  className={`h-1.5 rounded-full ${strength.color} ${strength.width} transition-all`}
                />
              </div>
              <p className="mt-1 text-xs text-stone-500">{strength.label}</p>
            </div>
          )}
        </div>

        <Input
          id="confirmPassword"
          type="password"
          label="Confirmer le mot de passe"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        {/* Company profile fields (professional only) */}
        {accountType === 'professionnel' && (
          <div className="space-y-4 rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <h3 className="text-sm font-semibold text-stone-800">
              Informations entreprise
            </h3>

            <Input
              id="raisonSociale"
              type="text"
              label="Raison sociale *"
              required
              value={raisonSociale}
              onChange={(e) => setRaisonSociale(e.target.value)}
              placeholder="Nom de votre entreprise"
            />

            <Input
              id="siret"
              type="text"
              label="SIRET *"
              required
              maxLength={14}
              value={siret}
              onChange={(e) =>
                setSiret(e.target.value.replace(/\D/g, '').slice(0, 14))
              }
              placeholder="14 chiffres"
              hint={
                siret.length > 0 && siret.length < 14
                  ? `${siret.length}/14 chiffres`
                  : undefined
              }
            />

            <Input
              id="addressLine1"
              type="text"
              label="Adresse *"
              required
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              placeholder="Numéro et rue"
            />

            <Input
              id="addressLine2"
              type="text"
              label="Complément d'adresse"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              placeholder="Bâtiment, étage..."
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                id="postalCode"
                type="text"
                label="Code postal *"
                required
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="75001"
              />
              <Input
                id="city"
                type="text"
                label="Ville *"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Paris"
              />
            </div>

            <Input
              id="phone"
              type="tel"
              label="Téléphone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="06 12 34 56 78"
            />

            <div>
              <span className="block text-sm font-medium text-stone-700">
                Spécialités
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {SPECIALTIES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSpecialty(s)}
                    aria-pressed={specialties.includes(s)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      specialties.includes(s)
                        ? 'bg-[var(--accent)]/10 text-[var(--accent-strong)] ring-1 ring-[var(--accent)]/40'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <Button type="submit" loading={loading} className="w-full">
          S&apos;inscrire
        </Button>
      </form>

      <p className="text-center text-xs leading-6 text-stone-500">
        En vous inscrivant, vous acceptez nos{' '}
        <Link
          href="/cgu"
          className="font-medium text-[var(--accent)] hover:text-[var(--accent-strong)]"
        >
          conditions générales d&apos;utilisation
        </Link>{' '}
        et notre{' '}
        <Link
          href="/privacy"
          className="font-medium text-[var(--accent)] hover:text-[var(--accent-strong)]"
        >
          politique de confidentialité
        </Link>
        .
      </p>

      <p className="text-center text-sm text-stone-600">
        Déjà un compte ?{' '}
        <Link
          href="/login"
          className="font-medium text-[var(--accent)] hover:text-[var(--accent-strong)]"
        >
          Se connecter
        </Link>
      </p>
    </div>
  );
}
