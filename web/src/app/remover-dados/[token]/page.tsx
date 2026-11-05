'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';

type Info = { campaignName: string; alreadyRemoved: boolean };

export default function RemoverDadosPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<Info>();
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Info>(`/public/remove-data/${token}`).then(setInfo).catch(() => setError('Link inválido ou expirado.'));
  }, [token]);

  async function remove() {
    setBusy(true);
    try { await api(`/public/remove-data/${token}`, { method: 'POST' }); setDone(true); }
    catch { setError('Não foi possível concluir. Tente novamente.'); }
    finally { setBusy(false); }
  }

  const removed = done || info?.alreadyRemoved;
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-8 shadow">
        <h1 className="text-xl font-bold text-brand-dark">Remover meus dados</h1>
        {error && <p role="alert" className="text-red-600">{error}</p>}
        {info && !removed && (<>
          <p className="text-sm">Você pode pedir a remoção dos seus dados pessoais da campanha <b>{info.campaignName}</b>. Seu cadastro será anonimizado e você sairá de todas as listas de contato.</p>
          <button onClick={remove} disabled={busy} className="w-full rounded-md bg-red-600 px-4 py-2 font-semibold text-white disabled:opacity-60">
            {busy ? 'Removendo…' : 'Remover meus dados'}
          </button>
        </>)}
        {info && removed && <p role="status" className="text-sm">Seus dados foram removidos. Nenhuma ação adicional é necessária.</p>}
      </div>
    </main>
  );
}
