'use client';

import { useState } from 'react';
import { apiPost } from '@/lib/api';
import type { ToggleLikeResponse } from '@/lib/community-types';

interface CommunityLikeButtonProps {
  communityProjectId: string;
  initialLiked: boolean;
  initialCount: number;
  disabled?: boolean;
}

export function CommunityLikeButton({
  communityProjectId,
  initialLiked,
  initialCount,
  disabled = false,
}: CommunityLikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    if (disabled || loading) return;
    setLoading(true);
    try {
      const result = await apiPost<ToggleLikeResponse>(
        `/community/${communityProjectId}/like`,
      );
      setLiked(result.liked);
      setCount(result.likes_count);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={disabled || loading}
      className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
        liked
          ? 'bg-red-50 text-red-600 hover:bg-red-100'
          : 'border border-stone-300 text-stone-600 hover:bg-stone-100'
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill={liked ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={liked ? 0 : 1.5}
        className="h-5 w-5"
      >
        <path d="M9.653 16.915l-.005-.003-.019-.01a20.759 20.759 0 01-1.162-.682 22.045 22.045 0 01-2.582-1.9C4.045 12.733 2 10.352 2 7.5a4.5 4.5 0 018-2.828A4.5 4.5 0 0118 7.5c0 2.852-2.044 5.233-3.885 6.82a22.049 22.049 0 01-3.744 2.582l-.019.01-.005.003h-.002a.723.723 0 01-.692 0h-.002z" />
      </svg>
      {count}
    </button>
  );
}
