'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as maplibregl from 'maplibre-gl';
import type { Map } from 'maplibre-gl';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ConsentForm, CONSENT_TEXT, CONSENT_VERSION } from '@/components/ConsentForm';
import { MapView } from '@/components/map/MapView';

type Opt = { id: string; name: string };
type Me = { role: string; leaderId: string | null };

export default function NovoApoiadorPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me>();
  const [leaders, setLeaders] = useState<Opt[]>([]);
  const [hoods, setHoods] = useState<Opt[]>([]);
  const [accepted, setAccepted] = useState(false);
  const [channel, setChannel] = useState('PRESENCIAL');
  const [pos, setPos] = useState<{ lat: number; lng: number }>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const marker = useRef<maplibregl.Marker>();

  useEffect(() => {
    api<Me>('/auth/me').then(setMe).catch(() => {});
    api<{ data: Opt[] }>('/leaders?pageSize=100').then((r) => setLeaders(r.data)).catch(() => {});
    api<Opt[]>('/neighborhoods').then(setHoods).catch(() => {});
  }, []);

  const onReady = useCallback((m: Map) => {
    m.on('click', (e) => {
      setPos({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      marker.current?.remove();
      marker.current = new maplibregl.Marker().setLngLat(e.lngLat).addTo(m);
    });
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!accepted) return setError('Sem consentimento não é possível salvar o cadastro.');
    const f = new FormData(e.currentTarget);
    const text = (k: string) => (String(f.get(k) ?? '').trim() || undefined);
    setBusy(true);
    setError('');
    try {
      await api('/supporters', {
        method: 'POST',
        body: JSON.stringify({
          name: text('name'), phone: text('phone'), cpf: text('cpf'), address: text('address'),
          neighborhoodId: text('neighborhoodId'),
          leaderId: me?.role === 'LIDERANCA' ? undefined : text('leaderId'),
          ...pos,
          consent: { channel, purpose: 'Organização e contato da campanha', textVersion: CONSENT_VERSION, textAccepted: CONSENT_TEXT },
        }),
      });
      router.push('/apoiadores');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setBusy(false);
    }
  }

  const input = 'mt-1 w-full rounded border px-3 py-2';
  return (
    <form onSubmit={onSubmit} className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">Novo apoiador</h1>
        <label className="block text-sm">Nome<input name="name" required minLength={2} className={input} /></label>
        <label className="block text-sm">Telefone<input name="phone" inputMode="tel" className={input} /></label>
        <label className="block text-sm">CPF (opcional)<input name="cpf" className={input} /></label>
        <label className="block text-sm">Endereço (opcional)<input name="address" className={input} /></label>
        <label className="block text-sm">Bairro
          <select name="neighborhoodId" required className={input} defaultValue="">
            <option value="" disabled>Selecione</option>
            {hoods.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </label>
        {me && me.role !== 'LIDERANCA' && (
          <label className="block text-sm">Liderança
            <select name="leaderId" required className={input} defaultValue="">
              <option value="" disabled>Selecione</option>
              {leaders.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>
        )}
        <ConsentForm checked={accepted} onChange={setAccepted} channel={channel} onChannel={setChannel} />
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={busy || !accepted}>{busy ? 'Salvando…' : 'Salvar'}</Button>
      </div>
      <div className="space-y-2">
        <p className="text-sm">Clique no mapa para posicionar o apoiador {pos && <span className="text-slate-500">(posição marcada)</span>}</p>
        <div className="h-96 overflow-hidden rounded border"><MapView onReady={onReady} /></div>
        <p className="text-xs text-slate-500">A posição exata fica criptografada; o mapa público mostra só um ponto deslocado (~200 m).</p>
      </div>
    </form>
  );
}
