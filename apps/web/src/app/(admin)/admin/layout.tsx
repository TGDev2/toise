'use client';

import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Skeleton } from '@/components/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { appUser, isLoading, isAdmin } = useAdminAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-[var(--background)]">
        <aside className="w-64 border-r border-[var(--foreground)]/10 bg-[var(--surface)] p-6">
          <Skeleton className="h-6 w-32" />
        </aside>
        <main className="flex-1 p-8">
          <Skeleton className="h-40 rounded-2xl" />
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      <aside className="w-64 border-r border-[var(--foreground)]/10 bg-[var(--surface)] p-6">
        <h1 className="mb-8 text-xl font-bold text-[var(--foreground)]">
          Admin Toisé
        </h1>
        <nav className="space-y-2">
          <Link
            href="/admin/analytics"
            className="block rounded-lg px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)]/10"
          >
            Tableau de bord
          </Link>
          <Link
            href="/admin/materials"
            className="block rounded-lg px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)]/10"
          >
            Catalogue matériaux
          </Link>
          <Link
            href="/admin/community"
            className="block rounded-lg px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)]/10"
          >
            Modération galerie
          </Link>
        </nav>
        <div className="mt-auto pt-8 text-xs text-[var(--foreground)]/50">
          {appUser?.email}
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
