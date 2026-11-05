'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: f.get('email'), password: f.get('password') }) });
      router.replace('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setBusy(false);
    }
  }

  const input = 'mt-1 w-full rounded-[10px] border bg-paper px-3 py-2 outline-none focus:border-brand';
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-8 shadow-lg">
        <div className="flex items-center gap-3">
          <b className="grid h-10 w-10 place-items-center rounded-[10px] bg-accent font-display text-2xl font-normal text-[#2A1C00]">B</b>
          <h1 className="text-2xl">BaseForte</h1>
        </div>
        <p className="text-sm text-mut">Gestão de lideranças e campanha.</p>
        <label className="block text-sm">E-mail
          <input name="email" type="email" required autoComplete="username" className={input} />
        </label>
        <label className="block text-sm">Senha
          <input name="password" type="password" required autoComplete="current-password" className={input} />
        </label>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <Button type="submit" disabled={busy} className="w-full">{busy ? 'Entrando…' : 'Entrar'}</Button>
      </form>
    </main>
  );
}
