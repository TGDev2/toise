import { Skeleton } from '@/components/ui';

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <Skeleton className="h-40 rounded-[2rem]" />
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 rounded-[2rem]" />
        <Skeleton className="h-48 rounded-[2rem]" />
      </div>
    </main>
  );
}
