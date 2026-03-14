import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Check, Copy } from 'lucide-react';
import { useClipboard } from '@/hooks/useClipboard';

export function CodeWithCopy({ cmd, note }: Readonly<{ cmd: string; note: string }>) {
  const { copy, copied } = useClipboard();
  return (
    <div className="group flex items-start justify-between gap-3 rounded-xl bg-slate-100 p-4 font-mono text-sm transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700">
      <div className="min-w-0 flex-1">
        <div className="break-all text-slate-800 dark:text-slate-200">{cmd}</div>
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{note}</div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Copy command"
        onClick={() => copy(cmd)}
        className="h-8 w-8 shrink-0 opacity-0 transition-opacity hover:bg-slate-300 group-hover:opacity-100 dark:hover:bg-slate-600"
      >
        {copied === cmd ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
      </Button>
    </div>
  );
}
