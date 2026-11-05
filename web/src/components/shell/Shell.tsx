'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type User = { name: string; role: string };
type Item = { href: string; label: string; icon: string; roles?: string[] };
const FIELD = ['CANDIDATO', 'COORD_GERAL', 'COORD_REGIAO', 'LIDERANCA'];
const GROUPS: { title: string; items: Item[] }[] = [
  { title: 'Visão geral', items: [
    { href: '/', label: 'Painel', icon: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10', roles: FIELD },
    { href: '/mapa', label: 'Mapa', icon: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14', roles: FIELD },
  ] },
  { title: 'Base', items: [
    { href: '/liderancas', label: 'Lideranças', icon: 'M9 3h6v5H9zM3 16h6v5H3zM15 16h6v5h-6zM12 8v4M6 16v-4h12v4', roles: FIELD },
    { href: '/apoiadores', label: 'Apoiadores', icon: 'M9 4.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6M16 4.5a3.5 3.5 0 010 7M18 14c2.2.6 3.5 2.6 3.5 5', roles: FIELD },
  ] },
  { title: 'Conformidade', items: [
    { href: '/privacidade', label: 'Privacidade', icon: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM9 12l2 2 4-4', roles: ['CANDIDATO', 'COORD_GERAL', 'COORD_REGIAO', 'AUDITOR'] },
  ] },
];

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 flex-none" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

export function Shell({ user, children }: { user: User; children: React.ReactNode }) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => { try { setCollapsed(localStorage.getItem('bf-sb') === '1'); } catch {} }, []);
  useEffect(() => setOpen(false), [path]);

  const toggle = () => setCollapsed((c) => { try { localStorage.setItem('bf-sb', c ? '0' : '1'); } catch {} return !c; });
  const theme = () => {
    const d = document.documentElement;
    const next = d.dataset.theme === 'dark' ? 'light' : 'dark';
    d.dataset.theme = next;
    try { localStorage.setItem('bf-theme', next); } catch {}
  };
  const logout = async () => { await api('/auth/logout', { method: 'POST' }).catch(() => {}); window.location.assign('/login'); };
  const active = (h: string) => (h === '/' ? path === '/' : path.startsWith(h));
  const lbl = collapsed ? 'md:hidden' : '';
  const ib = 'grid h-9 w-9 place-items-center rounded-[10px] border bg-card hover:border-brand';

  return (
    <div className="flex min-h-screen">
      {open && <div className="fixed inset-0 z-20 bg-black/50 md:hidden" onClick={() => setOpen(false)} />}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-[260px] flex-col overflow-hidden bg-sb p-3 text-brand-ink transition-all duration-300 md:sticky md:top-0 md:h-screen md:translate-x-0 ${open ? '' : '-translate-x-full'} ${collapsed ? 'md:w-[76px]' : ''}`}
        aria-label="Navegação principal"
      >
        <div className={`flex items-center gap-3 px-2 pb-4 pt-1 ${collapsed ? 'md:justify-center md:px-0' : ''}`}>
          <b className="grid h-9 w-9 flex-none place-items-center rounded-[10px] bg-accent font-display text-xl font-normal text-[#2A1C00]">B</b>
          <span className={`font-display text-[22px] ${lbl}`}>BaseForte</span>
        </div>
        <nav className="flex-1 overflow-y-auto">
          {GROUPS.map((g) => {
            const items = g.items.filter((i) => i.roles?.includes(user.role));
            if (!items.length) return null;
            return (
              <div key={g.title}>
                <div className={`px-3 pb-1.5 pt-3.5 font-mono text-[11px] uppercase tracking-[.12em] opacity-55 ${lbl}`}>{g.title}</div>
                {items.map((i) => (
                  <Link
                    key={i.href} href={i.href} title={collapsed ? i.label : undefined}
                    className={`relative flex items-center gap-3.5 rounded-[10px] px-3 py-2.5 text-sm transition-colors hover:bg-white/10 ${active(i.href) ? 'bg-white/15 font-semibold' : 'opacity-80'} ${collapsed ? 'md:justify-center' : ''}`}
                  >
                    <Icon d={i.icon} />
                    <span className={lbl}>{i.label}</span>
                    {active(i.href) && <span className="absolute -right-3 top-1/2 h-[22px] w-1 -translate-y-1/2 rounded-l bg-accent" />}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>
        <div className={`flex items-center gap-2.5 rounded-xl bg-white/10 p-2.5 ${collapsed ? 'md:justify-center md:p-2' : ''}`}>
          <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-full bg-accent font-semibold text-[#2A1C00]">{user.name.slice(0, 1)}</span>
          <div className={`min-w-0 text-[13px] leading-tight ${lbl}`}>
            <div className="truncate">{user.name}</div>
            <small className="opacity-65">{user.role}</small>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-paper/90 px-4 py-2.5 backdrop-blur md:px-7">
          <button className={`${ib} md:hidden`} aria-label="Abrir menu" onClick={() => setOpen(true)}><Icon d="M4 7h16M4 12h16M4 17h16" /></button>
          <button className={`${ib} hidden md:grid`} aria-label="Recolher ou expandir menu" onClick={toggle}><Icon d="M3 4h18v16H3zM9 4v16" /></button>
          <div className="flex-1" />
          <button className={ib} aria-label="Alternar tema" onClick={theme}><Icon d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" /></button>
          <button className={ib} aria-label="Sair" title="Sair" onClick={logout}><Icon d="M9 4H4v16h5M16 8l4 4-4 4M20 12H9" /></button>
        </header>
        <div role="note" className="border-b bg-soft px-3 py-1 text-center text-[12.5px] text-mut">
          O BaseForte não substitui orientação jurídica eleitoral.
        </div>
        <main className="mx-auto w-full max-w-[1320px] flex-1 p-4 md:p-7">{children}</main>
      </div>
    </div>
  );
}
