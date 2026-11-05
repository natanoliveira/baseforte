'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';

type Leader = { id: string; name: string; status: string; goal: number; supporters?: number; zones?: string[]; sections?: string[] };

export default function LiderancaPage() {
  const { id } = useParams<{ id: string }>();
  const [l, setL] = useState<Leader>();
  const [err, setErr] = useState('');
  useEffect(() => {
    api<Leader>(`/leaders/${id}`).then(setL).catch((e) => setErr(e.message));
  }, [id]);

  if (err) return <p role="alert" className="text-danger">{err}</p>;
  if (!l) return <p>Carregando…</p>;
  return (
    <div className="space-y-2">
      <Link href="/liderancas" className="text-sm text-brand underline">← Lideranças</Link>
      <h1 className="text-xl font-semibold">{l.name}</h1>
      <p>Status: {l.status} · Meta: {l.goal}{l.supporters != null && ` · Apoiadores: ${l.supporters}`}</p>
      {!!l.zones?.length && <p>Zonas: {l.zones.join(', ')}</p>}
      {!!l.sections?.length && <p>Seções: {l.sections.join(', ')}</p>}
    </div>
  );
}
