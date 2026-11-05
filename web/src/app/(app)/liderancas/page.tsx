'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Coord, OrgChart, TreeLeader } from '@/components/OrgChart';

type Rank = { rank: number; id: string; name: string; goal: number; supporters: number; goalPct: number | null; score: number };

export default function LiderancasPage() {
  const [tree, setTree] = useState<{ coordinators: Coord[]; leaders: TreeLeader[] }>();
  const [ranking, setRanking] = useState<Rank[]>([]);

  const load = useCallback(() => {
    api<{ coordinators: Coord[]; leaders: TreeLeader[] }>('/leaders/tree').then(setTree).catch(() => {});
    api<Rank[]>('/leaders/ranking').then(setRanking).catch(() => {});
  }, []);
  useEffect(load, [load]);

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <section>
        <h1 className="mb-3 text-xl font-semibold">Pirâmide de lideranças</h1>
        <p className="mb-3 text-sm text-mut">Arraste uma liderança para um coordenador ou outra liderança para reatribuir.</p>
        {tree ? <OrgChart coordinators={tree.coordinators} leaders={tree.leaders} onMoved={load} /> : <p>Carregando…</p>}
      </section>
      <section>
        <h2 className="mb-3 text-xl font-semibold">Ranking</h2>
        <ol className="space-y-1 text-sm">
          {ranking.slice(0, 20).map((r) => (
            <li key={r.id} className="flex justify-between rounded border bg-card px-3 py-1">
              <span>{r.rank}. {r.name}</span>
              <span className="text-mut">{r.goalPct ?? '—'}% da meta</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
