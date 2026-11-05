export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

const BASE = '/api/v1';

async function raw(path: string, init?: RequestInit) {
  return fetch(BASE + path, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res = await raw(path, init);
  if (res.status === 401 && !path.startsWith('/auth/')) {
    if ((await raw('/auth/refresh', { method: 'POST' })).ok) res = await raw(path, init);
    else if (typeof window !== 'undefined') window.location.assign('/login');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.code ?? 'UNKNOWN', body.message ?? 'Erro inesperado');
  return body as T;
}
