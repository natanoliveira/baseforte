import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes } from 'react';

export function Button({ className, ...p }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn('rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60', className)}
      {...p}
    />
  );
}
