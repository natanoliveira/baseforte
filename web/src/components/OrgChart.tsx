'use client';
import { DndContext, DragEndEvent, useDraggable, useDroppable } from '@dnd-kit/core';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';

export type Coord = { id: string; name: string };
export type TreeLeader = {
  id: string; name: string; parentId: string | null; coordinatorId: string | null;
  goal: number; supporterCount: number; status: string;
};
const DOT: Record<string, string> = { ATIVO: 'bg-ok', FRIO: 'bg-accent/150', INATIVO: 'bg-off' };

function Drop({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <div ref={setNodeRef} className={`${className} ${isOver ? 'ring-2 ring-brand' : ''}`}>{children}</div>;
}

function Card({ l }: { l: TreeLeader }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: l.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: transform ? `translate(${transform.x}px,${transform.y}px)` : undefined }}
      className={`flex items-center gap-2 rounded border bg-card px-2 py-1 text-sm ${isDragging ? 'z-10 shadow-lg' : ''}`}
    >
      <span {...listeners} {...attributes} aria-label={`Arrastar ${l.name}`} className="cursor-grab select-none px-1 text-mut">⠿</span>
      <span className={`h-2 w-2 rounded-full ${DOT[l.status] ?? DOT.INATIVO}`} />
      <Link href={`/liderancas/${l.id}`} className="hover:underline">{l.name}</Link>
      <span className="text-xs text-mut">{l.supporterCount}/{l.goal}</span>
    </div>
  );
}

function Branch({ parent, all }: { parent: TreeLeader; all: TreeLeader[] }) {
  const kids = all.filter((k) => k.parentId === parent.id);
  return (
    <li>
      <Drop id={`leader:${parent.id}`} className="inline-block rounded"><Card l={parent} /></Drop>
      {!!kids.length && <ul className="ml-6 mt-1 space-y-1 border-l pl-3">{kids.map((k) => <Branch key={k.id} parent={k} all={all} />)}</ul>}
    </li>
  );
}

export function OrgChart({ coordinators, leaders, onMoved }: { coordinators: Coord[]; leaders: TreeLeader[]; onMoved: () => void }) {
  const [error, setError] = useState('');

  async function onDragEnd(e: DragEndEvent) {
    const over = e.over?.id as string | undefined;
    if (!over) return;
    const [kind, target] = over.split(':');
    const id = String(e.active.id);
    if (target === id) return;
    setError('');
    try {
      await api(`/leaders/${id}/move`, { method: 'POST', body: JSON.stringify(kind === 'coord' ? { coordinatorId: target } : { parentId: target }) });
      onMoved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao mover');
    }
  }

  return (
    <DndContext onDragEnd={onDragEnd}>
      {error && <p role="alert" className="mb-2 text-sm text-danger">{error}</p>}
      <div className="space-y-4">
        {coordinators.map((c) => (
          <Drop key={c.id} id={`coord:${c.id}`} className="rounded-lg border bg-card p-3">
            <h3 className="mb-2 font-semibold text-brand-dark">{c.name}</h3>
            <ul className="space-y-1">
              {leaders.filter((l) => !l.parentId && l.coordinatorId === c.id).map((l) => <Branch key={l.id} parent={l} all={leaders} />)}
            </ul>
          </Drop>
        ))}
      </div>
    </DndContext>
  );
}
