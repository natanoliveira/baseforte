'use client';
import { api } from '@/lib/api';

export function LogoutButton() {
  return (
    <button
      className="text-brand underline"
      onClick={async () => {
        await api('/auth/logout', { method: 'POST' }).catch(() => {});
        window.location.assign('/login');
      }}
    >
      Sair
    </button>
  );
}
