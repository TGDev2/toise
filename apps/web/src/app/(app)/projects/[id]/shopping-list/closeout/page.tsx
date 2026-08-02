'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useFeatureGates } from '@/contexts/FeatureGateContext';
import { apiGet, apiPost } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import type {
  CloseoutLine,
  CloseoutRequest,
  CloseoutResponse,
} from '@/lib/closeout-types';
import { CloseoutRows } from '@/components/shopping-list/CloseoutRows';
import { CloseoutSummaryPanel } from '@/components/shopping-list/CloseoutSummaryPanel';
import { Alert, Skeleton, StickyActionBar } from '@/components/ui';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * DATA-5 — clôture de chantier.
 *
 * Le contrat de l'écran : une correction par ligne, aucune saisie de prix, et
 * une réponse immédiate. C'est ce qui le distingue de la finalisation
 * budgétaire, qui réclamait un prix sur chaque article sans rien rendre — et
 * n'était donc jamais remplie, laissant sans données le carnet du logement,
 * le benchmark de coûts, les facteurs de perte appris et le partage
 * communauté.
 *
 * Le calcul (surplus, reprenabilité, échéance, écart de perte) est fait par le
 * serveur : c'est là que vivent les conditions sourcées des enseignes, et il
 * n'en existe pas de copie ici.
 */
export default function CloseoutPage() {
  const { appUser, isLoading } = useAuth();
  const { isFeatureAllowed, showPaywall } = useFeatureGates();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const closeoutAllowed = isFeatureAllowed('project_closeout');

  const [data, setData] = useState<CloseoutResponse | null>(null);
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [purchasedOn, setPurchasedOn] = useState('');
  const [declarations, setDeclarations] = useState<Map<string, number>>(
    new Map(),
  );

  useEffect(() => {
    if (!isLoading && !appUser) router.push('/login');
  }, [isLoading, appUser, router]);

  const load = useCallback(async () => {
    try {
      const [project, closeout] = await Promise.all([
        apiGet<{ name: string }>(`/projects/${projectId}`),
        apiGet<CloseoutResponse>(`/projects/${projectId}/shopping-list/closeout`),
      ]);
      setProjectName(project.name);
      setData(closeout);
      setPurchasedOn(closeout.closeout.purchased_on ?? '');
    } catch (err) {
      setError(
        getErrorMessage(err, 'Impossible de charger la clôture du chantier.'),
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (appUser && closeoutAllowed) void load();
    else if (appUser) setLoading(false);
  }, [appUser, closeoutAllowed, load]);

  /**
   * Les corrections en cours sont fusionnées sur la vue serveur avant l'envoi.
   * Le montant récupérable n'est recalculé qu'au retour du serveur : afficher
   * une estimation locale demanderait de dupliquer ici les conditions de
   * reprise, c'est-à-dire de créer la seconde source que tout ce lot évite.
   */
  const lines: CloseoutLine[] = useMemo(() => {
    if (!data) return [];
    return data.closeout.lines.map((line) =>
      declarations.has(line.item_id)
        ? { ...line, purchased_units: declarations.get(line.item_id)! }
        : line,
    );
  }, [data, declarations]);

  const handleDeclare = (line: CloseoutLine, units: number) => {
    setDeclarations((prev) => new Map(prev).set(line.item_id, units));
  };

  const buildPayload = (): CloseoutRequest => {
    const materials: { material_id: string; purchased_units: number }[] = [];
    const complements: {
      complementary_material_id: string;
      purchased_quantity: number;
    }[] = [];

    for (const line of lines) {
      const units = declarations.get(line.item_id) ?? line.purchased_units;
      if (units === null || units === undefined) continue;
      if (line.kind === 'material') {
        materials.push({ material_id: line.item_id, purchased_units: units });
      } else {
        complements.push({
          complementary_material_id: line.item_id,
          purchased_quantity: units,
        });
      }
    }

    return {
      ...(purchasedOn ? { purchased_on: purchasedOn } : {}),
      material_items: materials,
      complementary_items: complements,
    };
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      const response = await apiPost<CloseoutResponse>(
        `/projects/${projectId}/shopping-list/closeout`,
        buildPayload(),
      );
      setData(response);
      setDeclarations(new Map());
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible d’enregistrer la clôture.'));
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || loading) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-6 h-40 rounded-[2rem]" />
        <Skeleton className="mt-6 h-64 rounded-[2rem]" />
      </main>
    );
  }

  if (!closeoutAllowed) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <Alert variant="error">
          La clôture de chantier n’est pas disponible sur votre compte.{' '}
          <button
            type="button"
            className="underline"
            onClick={() => showPaywall('project_closeout')}
          >
            En savoir plus
          </button>
        </Alert>
      </main>
    );
  }

  const declaredCount = lines.filter(
    (line) => line.purchased_units !== null,
  ).length;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-8 sm:px-6">
      <h1 className="text-2xl font-semibold text-stone-950 sm:text-3xl">
        Clôturer {projectName ? `« ${projectName} »` : 'le chantier'}
      </h1>
      <p className="mt-2 text-sm text-stone-600">
        Une seule correction par ligne : combien vous en avez acheté. Aucun prix
        n’est nécessaire.
      </p>

      {error && (
        <div className="mt-6">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-stone-200 bg-white px-5 py-4">
        <label
          htmlFor="purchased-on"
          className="text-sm font-medium text-stone-700"
        >
          Date de vos achats
        </label>
        <input
          id="purchased-on"
          type="date"
          value={purchasedOn}
          onChange={(e) => setPurchasedOn(e.target.value)}
          className="mt-2 block min-h-11 rounded-xl border border-stone-300 px-3 text-base sm:text-sm"
        />
        <p className="mt-2 text-xs text-stone-500">
          Sert à calculer les échéances de reprise. Sans elle, nous affichons
          les conditions sans date.
        </p>
      </div>

      {data && (
        <div className="mt-6">
          <CloseoutSummaryPanel summary={data.closeout} />
        </div>
      )}

      <div className="mt-6">
        <CloseoutRows lines={lines} onDeclare={handleDeclare} />
      </div>

      <StickyActionBar>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving || declaredCount === 0}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-stone-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving
            ? 'Enregistrement...'
            : data?.is_finalized
              ? 'Mettre à jour la clôture'
              : 'Clôturer le chantier'}
        </button>
      </StickyActionBar>
    </main>
  );
}
