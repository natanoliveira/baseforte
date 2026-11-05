'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Leader = { goal: number; supporterCount: number; status: string };
type Rank = { id: string; name: string; goalPct: number | null };
type Data = { supporters: number; leaders: Leader[]; gaps: string[]; ranking: Rank[] };

export default function Painel() {
  const [role, setRole] = useState('');
  const [d, setD] = useState<Data>();

  useEffect(() => {
    api<{ role: string }>('/auth/me').then((m) => {
      setRole(m.role);
      if (m.role === 'AUDITOR') return;
      Promise.all([
        api<{ meta: { total: number } }>('/supporters?pageSize=1'),
        api<{ leaders: Leader[] }>('/leaders/tree'),
        api<{ features: { properties: { name: string } }[] }>('/map/gaps'),
        api<Rank[]>('/leaders/ranking'),
      ]).then(([s, t, g, r]) => setD({ supporters: s.meta.total, leaders: t.leaders, gaps: g.features.map((f) => f.properties.name), ranking: r.slice(0, 5) })).catch(() => {});
    }).catch(() => {});
  }, []);

  if (role === 'AUDITOR') return (
    <div><h1 className="text-3xl">Painel do auditor</h1><p className="mt-2 text-mut">Acesso de leitura a consentimentos, logs e ROPA em <Link className="text-brand underline" href="/privacidade">Privacidade</Link>.</p></div>
  );
  if (!d) return <p className="text-mut">Carregando…</p>;

  const goal = d.leaders.reduce((a, l) => a + l.goal, 0);
  const sup = d.leaders.reduce((a, l) => a + l.supporterCount, 0);
  const pct = goal ? Math.round((sup / goal) * 100) : 0;
  const by = (s: string) => d.leaders.filter((l) => l.status === s).length;

  const kpis = [
    { k: 'Apoiadores', v: d.supporters.toLocaleString('pt-BR'), s: 'com consentimento ativo' },
    { k: 'Lideranças ativas', v: `${by('ATIVO')}`, tot: ` / ${d.leaders.length}`, s: `${by('FRIO')} frias · ${by('INATIVO')} inativas` },
    { k: 'Meta atingida', v: `${pct}%`, bar: Math.min(100, pct) },
  ];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl leading-tight">Painel</h1><p className="mt-1 text-mut">Visão da base da campanha</p></div>
        <div className="flex gap-2">
          <Link href="/mapa" className="rounded-[10px] border bg-card px-4 py-2 text-sm font-semibold">Abrir mapa</Link>
          <Link href="/apoiadores/novo" className="rounded-[10px] bg-brand px-4 py-2 text-sm font-semibold text-brand-ink">Novo apoiador</Link>
        </div>
      </div>

      {!!d.gaps.length && (
        <div className="flex items-start gap-3 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm">
          <span aria-hidden>⚠</span>
          <div><b>{d.gaps.length} bairros sem nenhuma liderança:</b> {d.gaps.join(', ')}. <Link href="/mapa" className="font-semibold text-brand underline">Ver no mapa</Link></div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((x) => (
          <div key={x.k} className="rounded-xl border bg-card p-5 shadow-sm">
            <small className="font-mono text-[11px] uppercase tracking-widest text-mut">{x.k}</small>
            <b className="mt-1 block font-display text-4xl font-normal">{x.v}{x.tot && <span className="text-xl text-mut">{x.tot}</span>}</b>
            {x.s && <span className="text-[13px] text-mut">{x.s}</span>}
            {x.bar != null && <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-soft"><i className="block h-full rounded-full bg-ok" style={{ width: `${x.bar}%` }} /></div>}
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-xl">Ranking de lideranças</h2><Link href="/liderancas" className="font-mono text-xs underline">ver todas →</Link></div>
        <ol className="space-y-3 text-sm">
          {d.ranking.map((r, i) => (
            <li key={r.id}>
              <div className="flex justify-between"><span><span className="mr-2 font-mono text-xs text-mut">{i + 1}</span>{r.name}</span><span className="font-mono text-xs">{r.goalPct ?? '—'}%</span></div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-soft"><i className={`block h-full rounded-full ${(r.goalPct ?? 0) >= 80 ? 'bg-ok' : (r.goalPct ?? 0) >= 40 ? 'bg-cold' : 'bg-danger'}`} style={{ width: `${Math.min(100, r.goalPct ?? 0)}%` }} /></div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
