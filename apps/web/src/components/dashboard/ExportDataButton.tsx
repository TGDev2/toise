'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Modal } from '@/components/ui';
import { apiDownload, apiGet, apiPost } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';

type ExportStatus = 'pending' | 'processing' | 'ready' | 'failed';

interface ExportStatusResponse {
  id: string;
  status: ExportStatus;
  error_message: string | null;
}

const POLL_INTERVAL_MS = 2000;

/**
 * Bouton « Télécharger mes données » (E6-2, RGPD art. 20), à côté de la
 * suppression de compte dans les deux variantes du dashboard.
 *
 * Extrait en composant partagé dès ce lot plutôt que dupliqué comme la
 * suppression de compte : la machine à états du polling double le risque de
 * bug si elle est copiée deux fois, et les deux emplacements existent déjà.
 * Action non destructive : pas de `ConfirmDialog`, juste une progression
 * inline dans une modale fermable à tout moment.
 */
export function ExportDataButton() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ExportStatus | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function pollStatus(id: string) {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await apiGet<ExportStatusResponse>(`/auth/me/export/${id}`);
        setStatus(res.status);
        if (res.status === 'ready' || res.status === 'failed') {
          stopPolling();
          if (res.status === 'failed') {
            setError(
              res.error_message ?? "La génération de l'export a échoué.",
            );
          }
        }
      } catch (err: unknown) {
        stopPolling();
        setError(getErrorMessage(err, "Impossible de suivre l'export"));
      }
    }, POLL_INTERVAL_MS);
  }

  async function handleStart() {
    setError('');
    setOpen(true);
    setStatus('pending');
    try {
      const res = await apiPost<ExportStatusResponse>('/auth/me/export', {});
      setRequestId(res.id);
      setStatus(res.status);
      if (res.status === 'ready' || res.status === 'failed') {
        if (res.status === 'failed') {
          setError(res.error_message ?? "La génération de l'export a échoué.");
        }
        return;
      }
      pollStatus(res.id);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Impossible de démarrer l'export"));
      setStatus('failed');
    }
  }

  async function handleDownload() {
    if (!requestId) return;
    setDownloading(true);
    setError('');
    try {
      const date = new Intl.DateTimeFormat('fr-CA').format(new Date());
      await apiDownload(
        `/auth/me/export/${requestId}/download`,
        `toise-export-${date}.zip`,
      );
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Impossible de télécharger l'archive"));
    } finally {
      setDownloading(false);
    }
  }

  function handleClose() {
    stopPolling();
    setOpen(false);
    setStatus(null);
    setRequestId(null);
    setError('');
  }

  return (
    <>
      <Button variant="secondary" onClick={handleStart}>
        Télécharger mes données
      </Button>

      <Modal open={open} onClose={handleClose} title="Export de mes données">
        <div className="text-sm text-stone-600">
          {status === 'pending' || status === 'processing' ? (
            <p>
              Préparation de votre archive (profil, projets, devis, factures,
              photos…). Cela peut prendre quelques instants.
            </p>
          ) : status === 'ready' ? (
            <p>
              Votre archive est prête. Elle contient un fichier{' '}
              <code>data.json</code> documenté ainsi que les PDF de vos devis
              et factures.
            </p>
          ) : (
            <p>La génération de l&apos;export n&apos;a pas abouti.</p>
          )}
        </div>

        {error && (
          <Alert variant="error" className="mt-4">
            {error}
          </Alert>
        )}

        <div className="mt-6 flex gap-3">
          {status === 'ready' && (
            <Button onClick={handleDownload} loading={downloading}>
              Télécharger l&apos;archive
            </Button>
          )}
          {(status === 'pending' || status === 'processing') && (
            <Button variant="secondary" disabled loading>
              Préparation…
            </Button>
          )}
          <Button variant="secondary" onClick={handleClose}>
            Fermer
          </Button>
        </div>
      </Modal>
    </>
  );
}
