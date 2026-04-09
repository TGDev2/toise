'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiDelete, apiGet, apiPost } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import type {
  CommunityComment,
  PaginatedComments,
} from '@/lib/community-types';
import { useAuth } from '@/contexts/AuthContext';

interface CommunityCommentsProps {
  communityProjectId: string;
}

export function CommunityComments({
  communityProjectId,
}: CommunityCommentsProps) {
  const { appUser } = useAuth();
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchComments = useCallback(async () => {
    try {
      const result = await apiGet<PaginatedComments>(
        `/community/${communityProjectId}/comments?limit=50`,
      );
      setComments(result.data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de charger les commentaires'));
    } finally {
      setLoading(false);
    }
  }, [communityProjectId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await apiPost(`/community/${communityProjectId}/comments`, {
        content: newComment.trim(),
      });
      setNewComment('');
      await fetchComments();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de poster le commentaire'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await apiDelete(`/community/comments/${commentId}`);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de supprimer le commentaire'));
    }
  };

  const formatDate = (dateStr: string) =>
    new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateStr));

  return (
    <div>
      <h3 className="text-lg font-semibold text-stone-950">
        Commentaires ({comments.length})
      </h3>

      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}

      {/* Comment form */}
      {appUser && (
        <form onSubmit={handleSubmit} className="mt-4">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Ajouter un commentaire..."
            maxLength={2000}
            rows={3}
            className="w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm text-stone-900 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="submit"
              disabled={!newComment.trim() || submitting}
              className="rounded-full bg-stone-950 px-5 py-2 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Envoi...' : 'Publier'}
            </button>
          </div>
        </form>
      )}

      {!appUser && (
        <p className="mt-4 text-sm text-stone-500">
          Connectez-vous pour commenter.
        </p>
      )}

      {/* Comments list */}
      {loading ? (
        <p className="mt-4 text-sm text-stone-500">Chargement...</p>
      ) : (
        <div className="mt-4 space-y-4">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="rounded-2xl border border-stone-200 bg-white p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-stone-700">
                  {comment.user_display_name}
                </span>
                <span className="text-xs text-stone-400">
                  {formatDate(comment.created_at)}
                </span>
              </div>
              <p className="mt-2 text-sm text-stone-600">{comment.content}</p>
              {appUser && comment.is_owner && (
                <button
                  type="button"
                  onClick={() => handleDelete(comment.id)}
                  className="mt-2 text-xs text-red-500 hover:text-red-700"
                >
                  Supprimer
                </button>
              )}
            </div>
          ))}
          {comments.length === 0 && (
            <p className="text-sm text-stone-400">
              Aucun commentaire pour le moment.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
