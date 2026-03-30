'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ShoppingListMaterials } from '@/components/shopping-list/ShoppingListMaterials';
import { ShoppingListComplements } from '@/components/shopping-list/ShoppingListComplements';
import type {
  ShoppingListMaterialItem,
  ShoppingListComplementaryItem,
} from '@/lib/shopping-list-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

interface SharedShoppingListData {
  project_name: string;
  room_name: string;
  dimensions: {
    length_cm: number;
    width_cm: number;
    height_cm: number;
  } | null;
  material_items: ShoppingListMaterialItem[];
  complementary_items: ShoppingListComplementaryItem[];
  created_at: string;
  updated_at: string;
}

export default function SharedShoppingListPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [data, setData] = useState<SharedShoppingListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_URL}/shared/shopping-list/${token}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError('Ce lien de partage est invalide ou a expire.');
          } else {
            setError('Impossible de charger la liste.');
          }
          return;
        }
        const json = await res.json();
        setData(json);
      } catch {
        setError('Erreur de connexion au serveur.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [token]);

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`${API_URL}/shared/shopping-list/${token}/pdf`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `liste-courses-${data?.project_name || 'liste'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError('Impossible de telecharger le PDF.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Chargement...</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-stone-900">
            Liste introuvable
          </h1>
          <p className="mt-2 text-stone-500">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-500">
            Lecture seule
          </span>
        </div>
        <h1 className="mt-2 text-3xl font-semibold text-stone-950">
          Liste de courses
        </h1>
        <p className="mt-1 text-sm text-stone-500">{data.project_name}</p>
        {data.dimensions && (
          <p className="mt-1 text-sm text-stone-400">
            {data.dimensions.length_cm} x {data.dimensions.width_cm} x{' '}
            {data.dimensions.height_cm} cm
            {data.room_name ? ` — ${data.room_name}` : ''}
          </p>
        )}
      </div>

      <div className="mb-6">
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={downloading}
          className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50 disabled:opacity-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
            <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
          </svg>
          {downloading ? 'Telechargement...' : 'Telecharger PDF'}
        </button>
      </div>

      <section className="mb-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-900">
            Materiaux a acheter
          </h2>
          <span className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-600">
            {data.material_items.length} article
            {data.material_items.length > 1 ? 's' : ''}
          </span>
        </div>
        <ShoppingListMaterials items={data.material_items} readOnly />
      </section>

      {data.complementary_items.length > 0 && (
        <section className="mb-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
          <ShoppingListComplements items={data.complementary_items} readOnly />
        </section>
      )}

      <footer className="mt-8 border-t border-stone-100 pt-4 text-center">
        <p className="text-xs text-stone-400">
          Liste generee par EstiMate
        </p>
      </footer>
    </main>
  );
}
