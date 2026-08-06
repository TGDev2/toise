'use client';

import { useState, useCallback } from 'react';
import { apiPost, apiDelete } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';

interface ShareLinkPanelProps {
  projectId: string;
  onClose: () => void;
}

export function ShareLinkPanel({ projectId, onClose }: ShareLinkPanelProps) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const handleGenerateLink = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiPost<{
        share_url: string;
        share_token: string;
        expires_at: string;
      }>(`/projects/${projectId}/shopping-list/share`);
      setShareUrl(result.share_url);
      setExpiresAt(result.expires_at);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de générer le lien'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const handleCopy = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Impossible de copier dans le presse-papier');
    }
  }, [shareUrl]);

  const handleRevoke = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await apiDelete(`/projects/${projectId}/shopping-list/share`);
      setShareUrl(null);
      setExpiresAt(null);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de révoquer le lien'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-lg">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-900">
          Partager la liste
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-stone-400 hover:text-stone-600"
          aria-label="Fermer"
        >
          &times;
        </button>
      </div>

      {error && (
        <p className="mb-3 text-sm text-red-600">{error}</p>
      )}

      {!shareUrl ? (
        <button
          type="button"
          onClick={handleGenerateLink}
          disabled={loading}
          className="w-full rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
        >
          {loading ? 'Génération...' : 'Générer un lien de partage'}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
            >
              {copied ? 'Copié !' : 'Copier'}
            </button>
          </div>
          <button
            type="button"
            onClick={handleRevoke}
            disabled={loading}
            className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            {loading ? 'Révocation...' : 'Révoquer le lien'}
          </button>
        </div>
      )}

      <p className="mt-3 text-xs text-stone-400">
        Toute personne disposant du lien pourra consulter la liste en lecture
        seule, prix d’achat et enseignes compris.
        {expiresAt
          ? ` Il cesse de fonctionner le ${new Intl.DateTimeFormat('fr-FR', {
              dateStyle: 'long',
            }).format(new Date(expiresAt))}.`
          : ''}
      </p>
    </div>
  );
}
