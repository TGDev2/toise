import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <Link href="/">
        <Logo height={28} />
      </Link>
      <LoginForm />
    </main>
  );
}
