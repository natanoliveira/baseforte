'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Policy = { policy: 'ANONIMIZAR' | 'APAGAR'; closedAt: string | null };

export default function EncerrarPage() {
  const [p, setP] = useState<Policy>();
  const [campaign, setCampaign] = useState('');
  const [confirm1, setConfirm1] = useState(false);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api<Policy>('/privacy/retention-policy').then(setP).catch((e) => setMsg(e.message));
    api<{ campaign: string }>('/privacy/ropa').then((r) => setCampaign(r.campaign)).catch(() => {});
  }, []);

  async function setPolicy(policy: Policy['policy']) {
    setMsg('');
    try { setP(await api<Policy>('/privacy/retention-policy', { method: 'PUT', body: JSON.stringify({ policy }) })); }
    catch (e) { setMsg(e instanceof Error ? e.message : 'Erro'); }
  }

  async function close() {
    setMsg('');
    try {
      setP(await api<Policy>('/privacy/close-campaign', { method: 'POST', body: JSON.stringify({ confirm1, confirm2: name }) }));
      setMsg('Campanha encerrada. O sistema agora é somente leitura.');
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Erro'); }
  }

  const closed = !!p?.closedAt;
  return (
    <div className="max-w-xl space-y-5">
      <Link href="/privacidade" className="text-sm text-brand underline">← Privacidade</Link>
      <h1 className="text-xl font-semibold">Encerrar campanha</h1>
      <fieldset className="space-y-1 text-sm" disabled={closed}>
        <legend className="font-medium">Ao encerrar, os dados dos apoiadores serão:</legend>
        {(['ANONIMIZAR', 'APAGAR'] as const).map((v) => (
          <label key={v} className="flex items-center gap-2">
            <input type="radio" name="policy" checked={p?.policy === v} onChange={() => setPolicy(v)} />
            {v === 'ANONIMIZAR' ? 'Anonimizados (mantém estatísticas)' : 'Apagados definitivamente'}
          </label>
        ))}
      </fieldset>
      <div className="space-y-3 rounded border border-danger/40 bg-danger/10 p-4 text-sm">
        <p className="font-medium text-danger">Ação irreversível: a campanha passa a ser somente leitura.</p>
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={confirm1} onChange={(e) => setConfirm1(e.target.checked)} disabled={closed} className="mt-1" />
          Entendo que esta ação não pode ser desfeita.
        </label>
        <label className="block">Digite o nome da campanha{campaign && <> (<b>{campaign}</b>)</>} para confirmar
          <input value={name} onChange={(e) => setName(e.target.value)} disabled={closed} className="mt-1 w-full rounded border px-3 py-2" />
        </label>
        <button onClick={close} disabled={closed || !confirm1 || name.trim() !== campaign} className="rounded bg-danger px-4 py-2 font-semibold text-brand-ink disabled:opacity-40">
          Encerrar campanha
        </button>
      </div>
      {closed && <p className="text-sm">Encerrada em {new Date(p!.closedAt!).toLocaleString('pt-BR')}.</p>}
      {msg && <p role="status" className="text-sm">{msg}</p>}
    </div>
  );
}
