import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { RegisterForm } from '@/components/auth/RegisterForm';

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-10">
      <Link href="/">
        <Logo height={28} />
      </Link>
      <RegisterForm />
    </main>
  );
}
