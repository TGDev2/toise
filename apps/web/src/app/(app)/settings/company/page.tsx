'use client';

import { useAuth } from '@/contexts/AuthContext';
import { apiGet, apiPut } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { Alert, Button, DecimalInput, Input, Skeleton, useToast } from '@/components/ui';
import {
  LegalMentionsFields,
  EMPTY_LEGAL_MENTIONS,
  fromCompanyProfile,
  toLegalMentionsPayload,
} from '@/components/invoices/LegalMentionsFields';
import type { LegalMentions } from '@/components/invoices/LegalMentionsFields';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

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

interface CompanyProfile extends Partial<LegalMentions> {
  raison_sociale: string;
  siret: string;
  address_line1: string;
  address_line2: string | null;
  postal_code: string;
  city: string;
  country: string;
  phone: string | null;
  specialties: string[];
  default_labor_hourly_rate: number | null;
  show_material_brands: boolean;
}

export default function CompanySettingsPage() {
  const { appUser, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [raisonSociale, setRaisonSociale] = useState('');
  const [siret, setSiret] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [defaultLaborHourlyRate, setDefaultLaborHourlyRate] = useState('');
  const [showMaterialBrands, setShowMaterialBrands] = useState(true);
  const [legal, setLegal] = useState<LegalMentions>(EMPTY_LEGAL_MENTIONS);

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
        setDefaultLaborHourlyRate(
          profile.default_labor_hourly_rate != null
            ? String(profile.default_labor_hourly_rate)
            : '',
        );
        setShowMaterialBrands(profile.show_material_brands);
        setLegal(fromCompanyProfile(profile));
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
        ...(defaultLaborHourlyRate.trim()
          ? { default_labor_hourly_rate: Number(defaultLaborHourlyRate) }
          : {}),
        show_material_brands: showMaterialBrands,
        ...toLegalMentionsPayload(legal),
      });
      toast.success('Profil mis à jour avec succès.');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de mettre à jour le profil'));
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-6 h-[32rem] rounded-[2rem]" />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-strong)]"
        >
          &larr; Retour au dashboard
        </Link>
      </div>

      <div className="rounded-[2rem] border border-stone-200 bg-[var(--surface)] p-6 shadow-[0_25px_80px_rgba(67,39,15,0.10)]">
        <h1 className="text-2xl font-semibold text-stone-950">
          Profil entreprise
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          Gérez les informations de votre entreprise.
        </p>

        {error && (
          <Alert variant="error" className="mt-4">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Input
            id="raisonSociale"
            type="text"
            label="Raison sociale"
            required
            value={raisonSociale}
            onChange={(e) => setRaisonSociale(e.target.value)}
          />

          <Input
            id="siret"
            type="text"
            label="SIRET"
            required
            maxLength={14}
            value={siret}
            onChange={(e) =>
              setSiret(e.target.value.replace(/\D/g, '').slice(0, 14))
            }
          />

          <Input
            id="addressLine1"
            type="text"
            label="Adresse"
            required
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
          />

          <Input
            id="addressLine2"
            type="text"
            label="Complément d'adresse"
            value={addressLine2}
            onChange={(e) => setAddressLine2(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              id="postalCode"
              type="text"
              label="Code postal"
              required
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
            />
            <Input
              id="city"
              type="text"
              label="Ville"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>

          <Input
            id="phone"
            type="tel"
            label="Téléphone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
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

          <div className="space-y-2 rounded-3xl border border-stone-200 bg-white/60 p-5">
            <h2 className="text-base font-semibold text-stone-950">
              Chiffrage
            </h2>
            <p className="text-xs text-stone-500">
              Proposé par défaut sur chaque ligne de main-d&apos;œuvre d&apos;un
              devis, modifiable ligne à ligne.
            </p>
            <label htmlFor="defaultLaborHourlyRate" className="mt-2 block text-sm font-medium text-stone-700">
              Taux horaire par défaut (EUR/h)
            </label>
            <DecimalInput
              id="defaultLaborHourlyRate"
              value={defaultLaborHourlyRate}
              onValueChange={setDefaultLaborHourlyRate}
              className="w-full min-h-11 rounded-2xl border border-stone-300 px-4 py-2.5 text-base sm:text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
            {/*
              E1-11 — la traçabilité des ratios cite la source par défaut,
              marque comprise. Un artisan qui pose une autre marque que celle
              sourcée la désactive : la justification technique (ratio,
              norme, date) reste, seul le nom commercial disparaît.
            */}
            <label className="mt-4 flex items-start gap-2">
              <input
                type="checkbox"
                checked={showMaterialBrands}
                onChange={(e) => setShowMaterialBrands(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-stone-300 text-[var(--accent)] focus:ring-[var(--accent)]"
              />
              <span className="text-sm text-stone-700">
                Citer les marques dans les justifications
                <span className="block text-xs text-stone-500">
                  Décoché, la source reste citée sans nom commercial :
                  « selon la fiche technique du fabricant, consultée le
                  … ».
                </span>
              </span>
            </label>
          </div>

          <LegalMentionsFields values={legal} onChange={setLegal} />

          <Button type="submit" loading={saving} className="w-full">
            Enregistrer les modifications
          </Button>
        </form>
      </div>
    </main>
  );
}
