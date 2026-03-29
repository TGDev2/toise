'use client';

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  projectName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}

export function DeleteConfirmDialog({
  isOpen,
  projectName,
  onConfirm,
  onCancel,
  isDeleting,
}: DeleteConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 w-full max-w-md rounded-[2rem] border border-stone-200 bg-white p-8 shadow-[0_25px_80px_rgba(67,39,15,0.15)]">
        <h3 className="text-lg font-semibold text-stone-950">
          Supprimer le projet
        </h3>
        <p className="mt-3 text-sm text-stone-600">
          Vous allez supprimer le projet{' '}
          <span className="font-semibold text-stone-800">{projectName}</span>.
          Il sera conserve pendant 30 jours avant suppression definitive.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting ? 'Suppression...' : 'Confirmer la suppression'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="rounded-full border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-700 hover:-translate-y-0.5 hover:bg-white"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
