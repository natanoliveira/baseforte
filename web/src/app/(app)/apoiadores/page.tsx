'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Row = { id: string; name: string; hasActiveConsent: boolean };
type Page = { data: Row[]; meta: { page: number; pageSize: number; total: number } };

export default function ApoiadoresPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [res, setRes] = useState<Page>();
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (q) p.set('q', q);
    api<Page>(`/supporters?${p}`).then(setRes).catch((e) => setError(e.message));
  }, [page, q]);

  async function whatsapp(id: string) {
    try {
      const { url } = await api<{ url: string }>(`/communication/wa-link/${id}`);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    }
  }

  async function copyLink(id: string) {
    try {
      const { url } = await api<{ url: string }>(`/supporters/${id}/removal-link`);
      await navigator.clipboard.writeText(url);
      setNote('Link de descadastro copiado.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    }
  }

  const pages = res ? Math.max(1, Math.ceil(res.meta.total / res.meta.pageSize)) : 1;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Apoiadores</h1>
        <Link href="/apoiadores/novo" className="rounded bg-brand px-3 py-2 text-sm text-brand-ink">Novo apoiador</Link>
      </div>
      <input aria-label="Buscar" placeholder="Buscar por nome" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="w-64 rounded border px-3 py-1.5 text-sm" />
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {note && <p role="status" className="text-sm text-ok">{note}</p>}
      <ul className="divide-y rounded border bg-card">
        {res?.data.map((s) => (
          <li key={s.id} className="flex items-center justify-between px-4 py-2 text-sm">
            <span>{s.name}</span>
            <span className="flex items-center gap-3">
              <button className="text-xs text-mut underline" onClick={() => copyLink(s.id)}>Link de descadastro</button>
              {s.hasActiveConsent
                ? <button className="text-brand underline" onClick={() => whatsapp(s.id)}>WhatsApp</button>
                : <span className="text-xs text-mut">sem consentimento</span>}
            </span>
          </li>
        ))}
        {res && !res.data.length && <li className="px-4 py-3 text-mut">Nenhum apoiador.</li>}
      </ul>
      <div className="flex items-center gap-3 text-sm">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="disabled:opacity-40">← Anterior</button>
        <span>{page} / {pages}</span>
        <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="disabled:opacity-40">Próxima →</button>
      </div>
    </div>
  );
}
