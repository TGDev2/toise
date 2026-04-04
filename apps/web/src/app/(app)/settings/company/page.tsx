'use client';

import { useAuth } from '@/contexts/AuthContext';
import { apiGet, apiPut } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

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

interface CompanyProfile {
  raison_sociale: string;
  siret: string;
  address_line1: string;
  address_line2: string | null;
  postal_code: string;
  city: string;
  country: string;
  phone: string | null;
  specialties: string[];
}

export default function CompanySettingsPage() {
  const { appUser, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [raisonSociale, setRaisonSociale] = useState('');
  const [siret, setSiret] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);

  useEffect(() => {
    if (!authLoading && !appUser) {
      router.push('/login');
      return;
    }
    if (!appUser) return;

    apiGet<CompanyProfile>('/company-profiles/me')
      .then((profile) => {
        setRaisonSociale(profile.raison_sociale);
        setSiret(profile.siret);
        setAddressLine1(profile.address_line1);
        setAddressLine2(profile.address_line2 ?? '');
        setPostalCode(profile.postal_code);
        setCity(profile.city);
        setPhone(profile.phone ?? '');
        setSpecialties(profile.specialties);
      })
      .catch(() => {
        setError('Impossible de charger le profil entreprise.');
      })
      .finally(() => setLoading(false));
  }, [appUser, authLoading, router]);

  const toggleSpecialty = (s: string) => {
    setSpecialties((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      await apiPut('/company-profiles/me', {
        raison_sociale: raisonSociale,
        siret,
        address_line1: addressLine1,
        ...(addressLine2 ? { address_line2: addressLine2 } : {}),
        postal_code: postalCode,
        city,
        ...(phone ? { phone } : {}),
        specialties,
      });
      setSuccess('Profil mis a jour avec succes.');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de mettre a jour le profil'));
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Chargement...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-blue-600 hover:text-blue-500"
        >
          &larr; Retour au dashboard
        </Link>
      </div>

      <div className="rounded-[2rem] border border-stone-200 bg-[var(--surface)] p-6 shadow-[0_25px_80px_rgba(67,39,15,0.10)]">
        <h1 className="text-2xl font-semibold text-stone-950">
          Profil entreprise
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          Gerez les informations de votre entreprise.
        </p>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="raisonSociale"
              className="block text-sm font-medium text-gray-700"
            >
              Raison sociale
            </label>
            <input
              id="raisonSociale"
              type="text"
              required
              value={raisonSociale}
              onChange={(e) => setRaisonSociale(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="siret"
              className="block text-sm font-medium text-gray-700"
            >
              SIRET
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
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="addressLine1"
              className="block text-sm font-medium text-gray-700"
            >
              Adresse
            </label>
            <input
              id="addressLine1"
              type="text"
              required
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="postalCode"
                className="block text-sm font-medium text-gray-700"
              >
                Code postal
              </label>
              <input
                id="postalCode"
                type="text"
                required
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label
                htmlFor="city"
                className="block text-sm font-medium text-gray-700"
              >
                Ville
              </label>
              <input
                id="city"
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </button>
        </form>
      </div>
    </main>
  );
}
