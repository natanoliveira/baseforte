import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { LogoutButton } from './logout-button';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

async function me() {
  const res = await fetch(`${API_URL}/api/v1/auth/me`, {
    headers: { cookie: cookies().toString() },
    cache: 'no-store',
  });
  return res.ok ? ((await res.json()) as { name: string; role: string }) : null;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await me();
  if (!user) redirect('/login');
  return (
    <div className="flex min-h-screen flex-col">
      <div role="note" className="bg-amber-100 px-4 py-1.5 text-center text-xs text-amber-900">
        O BaseForte não substitui orientação jurídica eleitoral.
      </div>
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <nav className="flex items-center gap-4 text-sm">
          <strong className="text-brand-dark">BaseForte</strong>
          <Link href="/mapa">Mapa</Link>
          <Link href="/liderancas">Lideranças</Link>
          <Link href="/apoiadores">Apoiadores</Link>
          <Link href="/privacidade">Privacidade</Link>
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <span>{user.name} · {user.role}</span>
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
