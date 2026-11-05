import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Shell } from '@/components/shell/Shell';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

async function me() {
  const res = await fetch(`${API_URL}/api/v1/auth/me`, { headers: { cookie: cookies().toString() }, cache: 'no-store' });
  return res.ok ? ((await res.json()) as { name: string; role: string }) : null;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await me();
  if (!user) redirect('/login');
  return <Shell user={user}>{children}</Shell>;
}
