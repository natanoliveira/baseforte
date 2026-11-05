'use client';
import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';

type Data = { campaign: string; name: string; phone: string | null; cpf: string | null; address: string | null; consents: { grantedAt: string; purpose: string; revokedAt: string | null }[] };
const FIELDS = [['name', 'Nome'], ['phone', 'Telefone'], ['cpf', 'CPF'], ['address', 'Endereço']] as const;

export default function MeusDadosPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<Data>();
  const [form, setForm] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = (d: Data) => { setData(d); setForm({ name: d.name, phone: d.phone ?? '', cpf: d.cpf ?? '', address: d.address ?? '' }); };
  useEffect(() => { api<Data>(`/public/my-data/${token}`).then(load).catch(() => setError('Link inválido ou cadastro já removido.')); }, [token]);

  async function save(e: FormEvent) {
    e.preventDefault(); setMsg(''); setError('');
    const changed = Object.fromEntries(FIELDS.map(([k]) => k).filter((k) => form[k] !== ((data as any)[k] ?? '') && form[k] !== '').map((k) => [k, form[k]]));
    if (!Object.keys(changed).length) return setMsg('Nada para corrigir.');
    try { load(await api<Data>(`/public/my-data/${token}`, { method: 'PATCH', body: JSON.stringify(changed) })); setMsg('Dados corrigidos.'); }
    catch (err: any) { setError(err.message); }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    Object.assign(document.createElement('a'), { href: url, download: 'meus-dados.json' }).click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="grid min-h-screen place-items-center p-4">
      <div className="w-full max-w-md space-y-4 rounded-xl bg-card p-8 shadow">
        <h1 className="text-xl font-bold text-brand-dark">Meus dados</h1>
        {error && <p role="alert" className="text-danger">{error}</p>}
        {data && (<>
          <p className="text-sm text-mut">Dados que a campanha <b>{data.campaign}</b> guarda sobre você. Você pode corrigi-los ou baixar uma cópia.</p>
          <form onSubmit={save} className="space-y-3">
            {FIELDS.map(([k, label]) => (
              <label key={k} className="block text-sm">{label}
                <input value={form[k] ?? ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="mt-1 w-full rounded-md border bg-card px-3 py-2" />
              </label>
            ))}
            <button className="w-full rounded-md bg-brand px-4 py-2 font-semibold text-brand-ink hover:opacity-90">Corrigir dados</button>
          </form>
          {msg && <p role="status" className="text-sm text-ok">{msg}</p>}
          <button onClick={download} className="w-full rounded-md border px-4 py-2 text-sm">Baixar meus dados (JSON)</button>
          <h2 className="pt-2 text-sm font-semibold">Consentimentos</h2>
          <ul className="space-y-1 text-sm text-mut">
            {data.consents.map((c, i) => <li key={i}>{c.purpose} · {new Date(c.grantedAt).toLocaleDateString('pt-BR')}{c.revokedAt ? ' · revogado' : ''}</li>)}
          </ul>
          <a href={`/remover-dados/${token}`} className="block text-center text-sm text-danger underline">Remover meus dados</a>
        </>)}
      </div>
    </main>
  );
}
