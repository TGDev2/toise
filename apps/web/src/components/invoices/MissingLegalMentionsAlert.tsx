'use client';

import Link from 'next/link';
import { MISSING_LEGAL_MENTION_LABELS } from '@/lib/invoice-types';

interface MissingLegalMentionsAlertProps {
  missingFields: string[];
}

/**
 * Rendu du 400 `MISSING_LEGAL_MENTIONS` : une facture française ne peut pas être
 * émise sans ces mentions. On dit lesquelles manquent et on emmène directement
 * là où on les saisit, plutôt que d'afficher un message d'erreur brut.
 */
export function MissingLegalMentionsAlert({
  missingFields,
}: MissingLegalMentionsAlertProps) {
  return (
    <div
      role="alert"
      className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900"
    >
      <p className="font-semibold">
        Mentions légales manquantes — facture non émise
      </p>
      <p className="mt-1 text-amber-800">
        La loi française impose ces informations sur toute facture. Complétez-les
        pour pouvoir facturer :
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5">
        {missingFields.map((field) => (
          <li key={field}>
            {MISSING_LEGAL_MENTION_LABELS[field] ?? field}
          </li>
        ))}
      </ul>
      <Link
        href="/settings/company"
        className="mt-4 inline-block rounded-full bg-amber-900 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-800"
      >
        Compléter mon profil entreprise
      </Link>
    </div>
  );
}
