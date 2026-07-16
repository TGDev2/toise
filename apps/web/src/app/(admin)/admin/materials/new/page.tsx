'use client';

import {
  MaterialForm,
  type MaterialFormData,
} from '@/components/admin/MaterialForm';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { apiPost } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function NewMaterialPage() {
  const { isAdmin } = useAdminAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  if (!isAdmin) return null;

  const handleSubmit = async (data: MaterialFormData) => {
    setIsLoading(true);
    try {
      await apiPost('/admin/materials', data);
      router.push('/admin/materials');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-[var(--foreground)]">
        Nouveau matériau
      </h1>
      <MaterialForm
        onSubmit={handleSubmit}
        isLoading={isLoading}
        submitLabel="Créer le matériau"
      />
    </div>
  );
}
