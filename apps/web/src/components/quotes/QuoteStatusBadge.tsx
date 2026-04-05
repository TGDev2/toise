'use client';

import type { QuoteStatus } from '@/lib/quote-types';
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_COLORS } from '@/lib/quote-types';

interface QuoteStatusBadgeProps {
  status: QuoteStatus;
}

export function QuoteStatusBadge({ status }: QuoteStatusBadgeProps) {
  return (
    <span
      className={`inline-block rounded-full px-3 py-0.5 text-xs font-medium ${QUOTE_STATUS_COLORS[status]}`}
    >
      {QUOTE_STATUS_LABELS[status]}
    </span>
  );
}
