'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth, type CompanyProfilePayload } from '@/contexts/AuthContext';
import { getErrorMessage } from '@/lib/errors';
import { OAuthButtons } from './OAuthButtons';

const SPECIALTIES = [
  'Peinture',
  'Carrelage',
  'Parquet',
  'Cloison',
  'Plomberie',
  'Electricite',
  'Maconnerie',
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
    return { label: 'Bon', color: 'bg-blue-500', width: 'w-3/4' };
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
      setError('Le mot de passe doit contenir au moins 8 caracteres');
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
        setError("L'adresse complete est obligatoire");
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
      setError(getErrorMessage(err, "Echec de l'inscription"));
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
      setError(getErrorMessage(err, "Echec de l'inscription"));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="w-full max-w-md space-y-4 text-center">
        <div className="rounded-lg bg-green-50 p-6">
          <h2 className="text-lg font-semibold text-green-800">
            Vérifiez votre email
          </h2>
          <p className="mt-2 text-sm text-green-700">
            Un email de confirmation a été envoyé à <strong>{email}</strong>.
            Cliquez sur le lien pour activer votre compte.
          </p>
        </div>
        <Link
          href="/login"
          className="text-sm font-medium text-blue-600 hover:text-blue-500"
        >
          Retour a la connexion
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Créer un compte</h1>
        <p className="mt-2 text-sm text-gray-600">
          Commencez à estimer vos matériaux
        </p>
      </div>

      {/* Account type toggle */}
      <div className="flex rounded-lg border border-gray-300 p-1">
        <button
          type="button"
          onClick={() => setAccountType('particulier')}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            accountType === 'particulier'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Particulier
        </button>
        <button
          type="button"
          onClick={() => setAccountType('professionnel')}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            accountType === 'professionnel'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Professionnel
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {accountType === 'particulier' && (
        <>
          <OAuthButtons
            onGoogle={() => handleOAuth(loginWithGoogle)}
            onApple={() => handleOAuth(loginWithApple)}
            disabled={loading}
          />

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-2 text-gray-500">ou</span>
            </div>
          </div>
        </>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="vous@exemple.com"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700"
          >
            Mot de passe
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="8 caracteres minimum"
          />
          {password.length > 0 && (
            <div className="mt-2">
              <div className="h-1.5 w-full rounded-full bg-gray-200">
                <div
                  className={`h-1.5 rounded-full ${strength.color} ${strength.width} transition-all`}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">{strength.label}</p>
            </div>
          )}
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-gray-700"
          >
            Confirmer le mot de passe
          </label>
          <input
            id="confirmPassword"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Company profile fields (professional only) */}
        {accountType === 'professionnel' && (
          <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h3 className="text-sm font-semibold text-gray-800">
              Informations entreprise
            </h3>

            <div>
              <label
                htmlFor="raisonSociale"
                className="block text-sm font-medium text-gray-700"
              >
                Raison sociale *
              </label>
              <input
                id="raisonSociale"
                type="text"
                required
                value={raisonSociale}
                onChange={(e) => setRaisonSociale(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Nom de votre entreprise"
              />
            </div>

            <div>
              <label
                htmlFor="siret"
                className="block text-sm font-medium text-gray-700"
              >
                SIRET *
              </label>
              <input
                id="siret"
                type="text"
                required
                maxLength={14}
                value={siret}
                onChange={(e) =>
                  setSiret(e.target.value.replace(/\D/g, '').slice(0, 14))
                }
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="14 chiffres"
              />
              {siret.length > 0 && siret.length < 14 && (
                <p className="mt-1 text-xs text-gray-500">
                  {siret.length}/14 chiffres
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="addressLine1"
                className="block text-sm font-medium text-gray-700"
              >
                Adresse *
              </label>
              <input
                id="addressLine1"
                type="text"
                required
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Numero et rue"
              />
            </div>

            <div>
              <label
                htmlFor="addressLine2"
                className="block text-sm font-medium text-gray-700"
              >
                Complement d&apos;adresse
              </label>
              <input
                id="addressLine2"
                type="text"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Batiment, etage..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="postalCode"
                  className="block text-sm font-medium text-gray-700"
                >
                  Code postal *
                </label>
                <input
                  id="postalCode"
                  type="text"
                  required
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="75001"
                />
              </div>
              <div>
                <label
                  htmlFor="city"
                  className="block text-sm font-medium text-gray-700"
                >
                  Ville *
                </label>
                <input
                  id="city"
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Paris"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-medium text-gray-700"
              >
                Telephone
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="06 12 34 56 78"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Specialites
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {SPECIALTIES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSpecialty(s)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      specialties.includes(s)
                        ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Inscription...' : "S'inscrire"}
        </button>
      </form>

      <p className="text-center text-xs leading-6 text-gray-500">
        En vous inscrivant, vous acceptez notre{' '}
        <Link href="/privacy" className="font-medium text-blue-600 hover:text-blue-500">
          politique de confidentialite
        </Link>
        .
      </p>

      <p className="text-center text-sm text-gray-600">
        Deja un compte ?{' '}
        <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
