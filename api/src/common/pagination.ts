export interface Page<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number };
}

export function parsePage(q: { page?: string; pageSize?: string }) {
  const page = Math.max(1, Number(q.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 20));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function toPage<T>(data: T[], total: number, page: number, pageSize: number): Page<T> {
  return { data, meta: { page, pageSize, total } };
}
