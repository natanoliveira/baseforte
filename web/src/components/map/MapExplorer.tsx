'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Map } from 'maplibre-gl';
import { api } from '@/lib/api';
import { MapView } from './MapView';
import { addLayers, GROUPS, GroupKey, setData, toggle } from './layers';

type Opt = { id: string; name: string };
type Panel = {
  neighborhood: Opt; supporters: number; goal: number; pct: number | null;
  leaders: { id: string; name: string; status: string; goal: number; supporters: number }[];
  gaps: { noLeaders: boolean; belowGoal: boolean }; votingPlaces: Opt[];
};
type Filters = { coordinatorId: string; neighborhoodId: string; status: string; goalMin: string; goalMax: string };

const NO_FILTERS: Filters = { coordinatorId: '', neighborhoodId: '', status: '', goalMin: '', goalMax: '' };
const qs = (f: Filters) => {
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => v && p.set(k, v));
  return p.size ? `?${p}` : '';
};

export function MapExplorer() {
  const map = useRef<Map>();
  const [ready, setReady] = useState(false);
  const [filters, setFilters] = useState(NO_FILTERS);
  const [visible, setVisible] = useState<Record<GroupKey, boolean>>({ pins: true, heat: true, choro: true, gaps: true, voting: false });
  const [coordinators, setCoordinators] = useState<Opt[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<Opt[]>([]);
  const [panel, setPanel] = useState<Panel | null>(null);

  const onReady = useCallback((m: Map) => {
    map.current = m;
    addLayers(m);
    m.on('click', 'choro-fill', (e) => {
      const id = e.features?.[0]?.properties?.id;
      if (id) api<Panel>(`/neighborhoods/${id}/panel`).then(setPanel).catch(() => {});
    });
    m.on('click', 'gaps-fill', (e) => {
      const id = e.features?.[0]?.properties?.id;
      if (id) api<Panel>(`/neighborhoods/${id}/panel`).then(setPanel).catch(() => {});
    });
    setReady(true);
  }, []);

  useEffect(() => {
    api<{ coordinators: Opt[] }>('/leaders/tree').then((t) => setCoordinators(t.coordinators)).catch(() => {});
    api<Opt[]>('/neighborhoods').then(setNeighborhoods).catch(() => {});
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const q = qs(filters);
    const hq = qs({ ...NO_FILTERS, neighborhoodId: filters.neighborhoodId });
    const load = (path: string, src: string) => api<GeoJSON.FeatureCollection>(path).then((d) => setData(m, src, d)).catch(() => {});
    load('/map/leaders' + q, 'leaders');
    load('/map/heatmap' + hq, 'heat');
    load('/map/choropleth', 'choro');
    load('/map/gaps', 'gaps');
    load('/map/voting-places', 'voting');
  }, [ready, filters]);

  useEffect(() => {
    const m = map.current;
    if (ready && m) (Object.keys(visible) as GroupKey[]).forEach((g) => toggle(m, g, visible[g]));
  }, [ready, visible]);

  function exportPng() {
    map.current?.getCanvas().toBlob((b) => {
      if (!b) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = 'mapa-baseforte.png';
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  const set = (k: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFilters((f) => ({ ...f, [k]: e.target.value }));
  const field = 'rounded border px-2 py-1 text-sm';

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-end gap-3 border-b bg-white p-3 text-sm">
        <select aria-label="Coordenador" className={field} value={filters.coordinatorId} onChange={set('coordinatorId')}>
          <option value="">Todos os coordenadores</option>
          {coordinators.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select aria-label="Bairro" className={field} value={filters.neighborhoodId} onChange={set('neighborhoodId')}>
          <option value="">Todos os bairros</option>
          {neighborhoods.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
        </select>
        <select aria-label="Status" className={field} value={filters.status} onChange={set('status')}>
          <option value="">Qualquer status</option>
          <option value="ATIVO">Ativo</option><option value="FRIO">Frio</option><option value="INATIVO">Inativo</option>
        </select>
        <input aria-label="Meta mínima" type="number" min={0} placeholder="Meta mín." className={`${field} w-24`} value={filters.goalMin} onChange={set('goalMin')} />
        <input aria-label="Meta máxima" type="number" min={0} placeholder="Meta máx." className={`${field} w-24`} value={filters.goalMax} onChange={set('goalMax')} />
        <button className="text-brand underline" onClick={() => setFilters(NO_FILTERS)}>Limpar</button>
        <button className="ml-auto rounded bg-brand px-3 py-1 text-white" onClick={exportPng}>Exportar PNG</button>
      </div>
      <div className="flex flex-wrap gap-4 border-b bg-slate-50 px-3 py-1.5 text-xs">
        {(Object.keys(GROUPS) as GroupKey[]).map((g) => (
          <label key={g} className="flex items-center gap-1">
            <input type="checkbox" checked={visible[g]} onChange={(e) => setVisible((v) => ({ ...v, [g]: e.target.checked }))} />
            {GROUPS[g].label}
          </label>
        ))}
      </div>
      <div className="relative min-h-0 flex-1">
        <MapView onReady={onReady} />
        {panel && (
          <aside className="absolute right-0 top-0 h-full w-80 overflow-y-auto border-l bg-white p-4 text-sm shadow-lg" aria-label="Painel do bairro">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold">{panel.neighborhood.name}</h2>
              <button aria-label="Fechar" onClick={() => setPanel(null)}>✕</button>
            </div>
            <p className="mt-1">Apoiadores: <b>{panel.supporters}</b> / meta {panel.goal} ({panel.pct ?? '—'}%)</p>
            {panel.gaps.noLeaders && <p className="mt-2 rounded bg-red-50 p-2 text-red-700">Bairro sem nenhuma liderança.</p>}
            {panel.gaps.belowGoal && <p className="mt-2 rounded bg-amber-50 p-2 text-amber-800">Abaixo da meta.</p>}
            <h3 className="mt-4 font-medium">Lideranças</h3>
            <ul className="mt-1 space-y-1">
              {panel.leaders.map((l) => <li key={l.id}>{l.name} · {l.status.toLowerCase()} · {l.supporters}/{l.goal}</li>)}
              {!panel.leaders.length && <li className="text-slate-500">Nenhuma.</li>}
            </ul>
            <h3 className="mt-4 font-medium">Pedidos</h3>
            <p className="text-slate-500">Disponível na fase 2.</p>
            {!!panel.votingPlaces.length && (<>
              <h3 className="mt-4 font-medium">Locais de votação</h3>
              <ul className="mt-1 list-disc pl-5">{panel.votingPlaces.map((v) => <li key={v.id}>{v.name}</li>)}</ul>
            </>)}
            <a className="mt-4 inline-block rounded bg-brand px-3 py-1 text-white" href={`/api/v1/neighborhoods/${panel.neighborhood.id}/report.pdf`} download>
              Baixar relatório PDF
            </a>
          </aside>
        )}
      </div>
    </div>
  );
}
