'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

type Dpo = { dpoName: string; dpoEmail: string; dpoContact?: string | null };
type Ropa = {
  campaign: string; generatedAt: string;
  stats: { supporters: number; withActiveConsent: number; removals: number };
  rows: { operacao: string; finalidade: string; baseLegal: string; dados: string; titulares: string; compartilhamento: string; retencao: string; seguranca: string }[];
};

export default function PrivacidadePage() {
  const [role, setRole] = useState('');
  const [dpo, setDpo] = useState<Dpo>();
  const [ropa, setRopa] = useState<Ropa>();
  const [msg, setMsg] = useState('');
  const canEdit = role === 'CANDIDATO' || role === 'COORD_GERAL';

  useEffect(() => {
    api<{ role: string }>('/auth/me').then((m) => setRole(m.role)).catch(() => {});
    api<Dpo>('/privacy/dpo').then(setDpo).catch((e) => setMsg(e.message));
    api<Ropa>('/privacy/ropa').then(setRopa).catch(() => {});
  }, []);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setMsg('');
    try {
      setDpo(await api<Dpo>('/privacy/dpo', { method: 'PUT', body: JSON.stringify({
        dpoName: f.get('dpoName'), dpoEmail: f.get('dpoEmail'), dpoContact: String(f.get('dpoContact') ?? '') || undefined,
      }) }));
      setMsg('Encarregado atualizado.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Erro');
    }
  }

  const input = 'mt-1 w-full rounded border px-3 py-2 disabled:bg-soft';
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Privacidade e LGPD</h1>
        <nav className="flex gap-4 text-sm text-brand underline">
          <Link href="/privacidade/auditoria">Auditoria</Link>
          {canEdit && <Link href="/privacidade/encerrar">Encerrar campanha</Link>}
        </nav>
      </div>

      <section className="max-w-xl">
        <h2 className="mb-2 font-semibold">Encarregado de dados (DPO)</h2>
        {dpo && (
          <form key={dpo.dpoEmail + dpo.dpoName} onSubmit={save} className="space-y-3">
            <label className="block text-sm">Nome<input name="dpoName" defaultValue={dpo.dpoName} disabled={!canEdit} required minLength={2} className={input} /></label>
            <label className="block text-sm">E-mail<input name="dpoEmail" type="email" defaultValue={dpo.dpoEmail} disabled={!canEdit} required className={input} /></label>
            <label className="block text-sm">Contato para titulares<input name="dpoContact" defaultValue={dpo.dpoContact ?? ''} disabled={!canEdit} className={input} /></label>
            {canEdit && <Button type="submit">Salvar</Button>}
          </form>
        )}
        {msg && <p role="status" className="mt-2 text-sm">{msg}</p>}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Registro das Operações de Tratamento (ROPA)</h2>
          <div className="flex gap-3 text-sm text-brand underline">
            <a href="/api/v1/privacy/ropa.csv" download>CSV</a>
            <a href="/api/v1/privacy/ropa.pdf" download>PDF</a>
          </div>
        </div>
        {ropa && (<>
          <p className="mb-2 text-sm text-mut">
            {ropa.stats.supporters} apoiadores · {ropa.stats.withActiveConsent} com consentimento ativo · {ropa.stats.removals} remoções
          </p>
          <div className="overflow-x-auto rounded border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="bg-soft"><tr>{['Operação', 'Finalidade', 'Base legal', 'Dados', 'Retenção'].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
              <tbody>{ropa.rows.map((r) => (
                <tr key={r.operacao} className="border-t align-top">
                  <td className="px-3 py-2 font-medium">{r.operacao}</td><td className="px-3 py-2">{r.finalidade}</td>
                  <td className="px-3 py-2">{r.baseLegal}</td><td className="px-3 py-2">{r.dados}</td><td className="px-3 py-2">{r.retencao}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>)}
      </section>
    </div>
  );
}
