'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Page<T> = { data: T[]; meta: { page: number; pageSize: number; total: number } };
type Consent = { id: string; supporterName: string; grantedAt: string; channel: string; purpose: string; textVersion: string; revokedAt: string | null };
type Log = { id: string; at: string; role: string | null; resource: string; resourceId: string | null; action: string; outcome: string };

export default function AuditoriaPage() {
  const [tab, setTab] = useState<'consents' | 'logs'>('consents');
  const [page, setPage] = useState(1);
  const [consents, setConsents] = useState<Page<Consent>>();
  const [logs, setLogs] = useState<Page<Log>>();
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    const q = `?page=${page}&pageSize=20`;
    if (tab === 'consents') api<Page<Consent>>('/privacy/consents' + q).then(setConsents).catch((e) => setError(e.message));
    else api<Page<Log>>('/privacy/access-logs' + q).then(setLogs).catch((e) => setError(e.message));
  }, [tab, page]);

  const cur = tab === 'consents' ? consents : logs;
  const pages = cur ? Math.max(1, Math.ceil(cur.meta.total / cur.meta.pageSize)) : 1;
  const fmt = (d: string) => new Date(d).toLocaleString('pt-BR');
  const th = 'px-3 py-2';
  return (
    <div className="space-y-3">
      <Link href="/privacidade" className="text-sm text-brand underline">← Privacidade</Link>
      <h1 className="text-xl font-semibold">Auditoria</h1>
      <div className="flex gap-2 text-sm">
        {(['consents', 'logs'] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); setPage(1); }} className={`rounded px-3 py-1 ${tab === t ? 'bg-brand text-brand-ink' : 'border bg-card'}`}>
            {t === 'consents' ? 'Consentimentos' : 'Logs de acesso'}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="overflow-x-auto rounded border bg-card">
        <table className="w-full text-left text-sm">
          {tab === 'consents' ? (<>
            <thead className="bg-soft"><tr><th className={th}>Apoiador</th><th className={th}>Data</th><th className={th}>Canal</th><th className={th}>Finalidade</th><th className={th}>Situação</th></tr></thead>
            <tbody>{consents?.data.map((c) => (
              <tr key={c.id} className="border-t"><td className={th}>{c.supporterName}</td><td className={th}>{fmt(c.grantedAt)}</td><td className={th}>{c.channel}</td><td className={th}>{c.purpose}</td><td className={th}>{c.revokedAt ? `revogado em ${fmt(c.revokedAt)}` : 'ativo'}</td></tr>
            ))}</tbody>
          </>) : (<>
            <thead className="bg-soft"><tr><th className={th}>Quando</th><th className={th}>Papel</th><th className={th}>Recurso</th><th className={th}>Ação</th><th className={th}>Resultado</th></tr></thead>
            <tbody>{logs?.data.map((l) => (
              <tr key={l.id} className="border-t"><td className={th}>{fmt(l.at)}</td><td className={th}>{l.role ?? '—'}</td><td className={th}>{l.resource}</td><td className={th}>{l.action}</td><td className={th}>{l.outcome}</td></tr>
            ))}</tbody>
          </>)}
        </table>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="disabled:opacity-40">← Anterior</button>
        <span>{page} / {pages}</span>
        <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="disabled:opacity-40">Próxima →</button>
      </div>
    </div>
  );
}
