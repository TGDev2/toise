'use client';

import type { InvoiceStatus } from '@/lib/invoice-types';
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_COLORS,
} from '@/lib/invoice-types';

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus;
}

export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  return (
    <span
      className={`inline-block rounded-full px-3 py-0.5 text-xs font-medium ${INVOICE_STATUS_COLORS[status]}`}
    >
      {INVOICE_STATUS_LABELS[status]}
    </span>
  );
}
